"""
Shared admin code: auth, helpers, constants, Pydantic models, ingest state.

This module is imported by all admin sub-modules. It MUST NOT import from
any sibling sub-module to avoid circular imports.
"""
import asyncio as _asyncio
import csv
import io
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import faiss
import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import APIRouter, Depends, HTTPException, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import structlog

from app.config import FAISS_INDEX_PATH, METADATA_PATH
from app.database import get_db, SessionLocal
from app.limiter import limiter
from app.models import AdminUser, Conversation, Expert, LeadClick
from app.services.tagging import compute_findability_score, tag_expert_sync

log = structlog.get_logger()

# ── Ingest job state ──────────────────────────────────────────────────────────

# admin.py lives at app/routers/admin.py -> parent.parent.parent = project root
PROJECT_ROOT = METADATA_PATH.parent.parent

_ingest: dict = {
    "status": "idle",
    "log": "",
    "error": None,
    "started_at": None,
    "last_rebuild_at": None,          # Phase 24: set on successful FAISS rebuild completion
    "expert_count_at_rebuild": None,  # Phase 24 + 25: expert count at last full rebuild
}
_ingest_lock = _asyncio.Lock()


def _run_tag_job() -> None:
    """Background thread: run only tag_experts.py (tags + scores, no FAISS rebuild)."""
    global _ingest
    _ingest["log"] = ""
    _ingest["error"] = None
    _ingest["started_at"] = time.time()
    try:
        r = subprocess.run(
            [sys.executable, "scripts/tag_experts.py"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        _ingest["log"] += r.stdout + r.stderr
        if r.returncode != 0:
            raise RuntimeError(f"tag_experts.py exited {r.returncode}:\n{r.stderr}")
        _ingest["status"] = "done"
    except Exception as exc:
        _ingest["status"] = "error"
        _ingest["error"] = str(exc)


def _run_ingest_job(app) -> None:
    """Background thread: run tag_experts.py + ingest.py then hot-reload FAISS+metadata."""
    global _ingest
    _ingest["log"] = ""
    _ingest["error"] = None
    _ingest["started_at"] = time.time()
    try:
        # Step 1: tag experts with Gemini
        r1 = subprocess.run(
            [sys.executable, "scripts/tag_experts.py"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        _ingest["log"] += r1.stdout + r1.stderr
        if r1.returncode != 0:
            raise RuntimeError(f"tag_experts.py exited {r1.returncode}:\n{r1.stderr}")

        # Step 2: rebuild FAISS index
        r2 = subprocess.run(
            [sys.executable, "scripts/ingest.py"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        _ingest["log"] += r2.stdout + r2.stderr
        if r2.returncode != 0:
            raise RuntimeError(f"ingest.py exited {r2.returncode}:\n{r2.stderr}")

        # Step 3: hot-reload app.state
        app.state.faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            app.state.metadata = json.load(f)

        # Phase 14: rebuild FTS5 index after bulk tag update
        from sqlalchemy import text as _fts_text  # noqa: PLC0415
        with SessionLocal() as _fts_db:
            _fts_db.execute(_fts_text("INSERT INTO experts_fts(experts_fts) VALUES('rebuild')"))
            _fts_db.commit()
        log.info("fts5.rebuild_complete")

        # Phase 14: refresh username-to-FAISS-position mapping after hot-reload
        _new_mapping: dict[str, int] = {}
        for _pos, _row in enumerate(app.state.metadata):
            _uname = _row.get("Username") or _row.get("username") or ""
            if _uname:
                _new_mapping[_uname] = _pos
        app.state.username_to_faiss_pos = _new_mapping
        log.info("fts5.username_mapping_refreshed", count=len(_new_mapping))

        # Phase 56: rebuild expert_tags after ingest
        from app.services.tag_sync import sync_all_expert_tags  # noqa: PLC0415
        with SessionLocal() as _tag_db:
            sync_all_expert_tags(_tag_db)

        _ingest["last_rebuild_at"] = time.time()
        _ingest["expert_count_at_rebuild"] = len(app.state.metadata)
        _ingest["status"] = "done"
    except Exception as exc:
        _ingest["status"] = "error"
        _ingest["error"] = str(exc)


# ── Auth ─────────────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("JWT_SECRET", "")
ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
_pwd = PasswordHash([BcryptHasher()])
_bearer = HTTPBearer(auto_error=False)

GAP_THRESHOLD = 0.60  # Matches SIMILARITY_THRESHOLD in retriever.py

EXPERTS_CSV_PATH = METADATA_PATH.parent / "experts.csv"

INDUSTRY_KEYWORDS = {
    "Finance":     ["finance", "cfo", "accountant", "banker", "investment", "fintech", "trading", "corporate finance", "private equity", "venture capital"],
    "Technology":  ["engineer", "developer", "cto", "software", "data", "ai", "ml", "saas", "product", "web", "devops", "tech"],
    "Healthcare":  ["health", "medical", "doctor", "pharma", "wellness", "biotech"],
    "Real Estate": ["real estate", "property", "construction", "renovation", "architecture"],
    "Marketing":   ["marketing", "cmo", "brand", "social media", "growth", "seo", "content", "digital marketing"],
    "Sales":       ["sales", "revenue", "business development", "account management"],
    "Operations":  ["operations", "coo", "supply chain", "logistics", "procurement", "process"],
    "Legal":       ["legal", "lawyer", "attorney", "compliance", "gdpr", "regulatory"],
    "HR":          ["hr", "human resources", "recruiter", "talent", "coaching", "people"],
    "Strategy":    ["strategy", "consulting", "advisor", "entrepreneur", "founder", "ceo", "board"],
    "Sports":      ["sport", "football", "fitness", "athlete", "coach", "esports"],
    "Media":       ["media", "journalism", "publishing", "entertainment", "film", "music"],
    "Food":        ["food", "restaurant", "chef", "culinary", "catering", "hospitality", "f&b", "food service", "beverage"],
}


def _auto_industry_tags(job_title: str, bio: str = "", company: str = "") -> list[str]:
    """Return up to 3 matching industry tags from job title + bio + company."""
    text = f"{job_title} {bio} {company}".lower()
    matched = []
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            matched.append(industry)
        if len(matched) == 3:
            break
    return matched


CATEGORY_KEYWORDS = {
    "Finance": ["finance", "cfo", "accountant", "banker", "investment", "fintech", "trading"],
    "Marketing": ["marketing", "cmo", "brand", "social media", "growth", "seo", "content"],
    "Tech": ["engineer", "developer", "cto", "software", "data", "ai", "ml", "product"],
    "Sales": ["sales", "revenue", "business development", "account"],
    "HR": ["hr", "human resources", "recruiter", "talent", "coaching", "people"],
    "Legal": ["legal", "lawyer", "attorney", "compliance", "gdpr"],
    "Operations": ["operations", "coo", "supply chain", "logistics", "procurement"],
    "Sports": ["sport", "football", "fitness", "athlete", "coach"],
    "Food": ["food", "restaurant", "chef", "culinary", "catering", "hospitality", "f&b"],
    "Healthcare": ["health", "medical", "doctor", "pharma", "wellness"],
    "Real Estate": ["real estate", "property", "construction", "renovation"],
    "Strategy": ["strategy", "consulting", "advisor", "entrepreneur", "founder", "ceo"],
}


def _require_admin(credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer)) -> str:
    """Dependency: validate JWT from Authorization: Bearer header."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise InvalidTokenError
        return username
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# Auth router — no authentication required (used by the login page)
auth_router = APIRouter(prefix="/api/admin")

# Main router — all endpoints require JWT Bearer token
router = APIRouter(prefix="/api/admin", dependencies=[Depends(_require_admin)])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_gap(row: Conversation) -> bool:
    """Return True if the conversation qualifies as a gap.
    NULL top_match_score = no candidates found = gap by definition.
    """
    return (
        row.top_match_score is None or row.top_match_score < GAP_THRESHOLD
    ) or row.response_type == "clarification"


def _auto_categorize(job_title: str) -> Optional[str]:
    """Return first matching category for a job title, or None."""
    jt = job_title.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in jt for kw in keywords):
            return category
    return None


def _serialize_expert(e: Expert) -> dict:
    return {
        "username": e.username,
        "first_name": e.first_name,
        "last_name": e.last_name,
        "job_title": e.job_title,
        "company": e.company,
        "bio": e.bio,
        "hourly_rate": e.hourly_rate,
        "profile_url": e.profile_url,
        "category": e.category,
        "tags": json.loads(e.tags or "[]"),
        "findability_score": e.findability_score,
        "photo_url": e.photo_url,
        "industry_tags": json.loads(e.industry_tags) if e.industry_tags else [],
    }


# ── Auth endpoint (no auth required) ─────────────────────────────────────────

class AuthBody(BaseModel):
    username: str
    password: str


@auth_router.post("/auth")
@limiter.limit("5/minute")
def authenticate(body: AuthBody, request: Request):
    """
    Authenticate with username and password, returns a JWT token.
    Rate limited to 5 attempts per minute per IP.

    Returns 200 {"token": "<jwt>"} on success, else 401.
    """
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    with SessionLocal() as db:
        user = db.scalar(select(AdminUser).where(AdminUser.username == body.username))
    if not user or not _pwd.verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    token = jwt.encode({"sub": user.username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token}


# ── Lead Click Capture (public, no auth required) ────────────────────────────

class LeadClickRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=320)
    expert_username: str = Field(..., min_length=1, max_length=100)
    search_query: str = Field(default="", max_length=2000)


@auth_router.post("/lead-clicks", status_code=202)
def record_lead_click(body: LeadClickRequest, db: Session = Depends(get_db)):
    """
    Record a lead click — fires when an email-identified user clicks an expert card.
    Public endpoint (no admin auth required), fire-and-forget from the frontend.
    Returns 202 Accepted immediately after DB write.
    """
    record = LeadClick(
        email=body.email,
        expert_username=body.expert_username,
        search_query=body.search_query,
    )
    db.add(record)
    db.commit()
    return {"status": "accepted"}
