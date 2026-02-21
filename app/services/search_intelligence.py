"""
Search intelligence layer: HyDE query expansion + feedback re-ranking.

Both features are gated by settings read from the DB on every request:
    QUERY_EXPANSION_ENABLED   — enables HyDE (Hypothetical Document Embeddings)
    FEEDBACK_LEARNING_ENABLED — enables feedback-weighted re-ranking

Settings are read via get_settings(db) on every retrieve_with_intelligence() call.
This ensures a POST /api/admin/settings change takes effect on the very next chat
request with no Railway redeploy required.

retrieve_with_intelligence() is SYNCHRONOUS. It MUST NOT be async because it
calls synchronous genai.Client() and embed_query(). Call it from chat.py via
loop.run_in_executor(None, lambda: retrieve_with_intelligence(...)) — same pattern
as retriever.retrieve(). The HyDE timeout (asyncio.wait_for) is handled by the
caller in chat.py; this module does not manage asyncio timeouts.

All 5 settings fall back to env vars (or hardcoded defaults) when no DB row exists.
"""
import os
import json
import numpy as np
import faiss
import structlog

from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.services.embedder import embed_query
from app.services.retriever import retrieve, RetrievedExpert, TOP_K
from app.models import Feedback

log = structlog.get_logger()

# ── Safety constant ────────────────────────────────────────────────────────────

# Abort HyDE LLM call after this many seconds (gemini-2.5-flash socket hang bug —
# see RESEARCH.md Pitfall 4). Enforced by asyncio.wait_for in chat.py caller.
# This is a hang-protection guard, NOT a tuneable setting — keep hardcoded.
HYDE_TIMEOUT_SECONDS = 5.0

# ── DB-backed settings ────────────────────────────────────────────────────────


def get_settings(db: Session) -> dict:
    """
    Read all 5 intelligence settings from the DB, falling back to env vars.

    Called on every retrieve_with_intelligence() invocation — never cached.
    This ensures a POST /api/admin/settings change takes effect on the next request
    with no Railway redeploy required.

    Returns a dict with native Python types (bool, float, int) ready to use directly.

    Valid keys and their defaults:
        QUERY_EXPANSION_ENABLED   — bool,  default: "false"
        FEEDBACK_LEARNING_ENABLED — bool,  default: "false"
        SIMILARITY_THRESHOLD      — float, default: "0.60"
        STRONG_RESULT_MIN         — int,   default: "3"
        FEEDBACK_BOOST_CAP        — float, default: "0.20"
    """
    from app.models import AppSetting  # deferred import — avoids circular import at module load

    rows = {row.key: row.value for row in db.scalars(select(AppSetting)).all()}

    def _db_or_env(key: str, default: str) -> str:
        return rows.get(key, os.getenv(key, default))

    def _bool(key: str, default: str) -> bool:
        return _db_or_env(key, default).lower().strip() in ("true", "1", "yes")

    def _float(key: str, default: str) -> float:
        try:
            return float(_db_or_env(key, default))
        except (ValueError, TypeError):
            return float(default)

    def _int(key: str, default: str) -> int:
        try:
            return int(_db_or_env(key, default))
        except (ValueError, TypeError):
            return int(default)

    return {
        "QUERY_EXPANSION_ENABLED": _bool("QUERY_EXPANSION_ENABLED", "false"),
        "FEEDBACK_LEARNING_ENABLED": _bool("FEEDBACK_LEARNING_ENABLED", "false"),
        "SIMILARITY_THRESHOLD": _float("SIMILARITY_THRESHOLD", "0.60"),
        "STRONG_RESULT_MIN": _int("STRONG_RESULT_MIN", "3"),
        "FEEDBACK_BOOST_CAP": _float("FEEDBACK_BOOST_CAP", "0.20"),
    }

# ── HyDE — lazy singleton client ──────────────────────────────────────────────

_hyde_client: genai.Client | None = None


def _get_hyde_client() -> genai.Client:
    """Return a shared synchronous genai.Client, creating it on first use."""
    global _hyde_client
    if _hyde_client is None:
        _hyde_client = genai.Client()
    return _hyde_client

# ── Public API ────────────────────────────────────────────────────────────────


def retrieve_with_intelligence(
    query: str,
    faiss_index,
    metadata: list[dict],
    db: Session,
) -> tuple[list[RetrievedExpert], dict]:
    """
    Retrieval with optional HyDE expansion and feedback re-ranking.

    Run this function in a thread pool via run_in_executor (same pattern as
    retriever.retrieve() in chat.py). Do NOT call it from an async context
    without wrapping in run_in_executor — genai.Client() is synchronous.

    Args:
        query:       Natural language user query.
        faiss_index: Loaded FAISS index from app.state.faiss_index.
        metadata:    Position-aligned metadata list from app.state.metadata.
        db:          SQLAlchemy Session for feedback table access.

    Returns:
        (candidates, intelligence_meta)
        intelligence_meta always contains:
            {
                "hyde_triggered": bool,      # True if HyDE ran and produced a bio
                "hyde_bio": str | None,      # The generated bio text, or None
                "feedback_applied": bool,    # True if feedback re-ranking ran
            }
    """
    # Read all settings from DB on every call (fallback to env vars when no DB row)
    settings = get_settings(db)
    query_expansion_enabled = settings["QUERY_EXPANSION_ENABLED"]
    feedback_learning_enabled = settings["FEEDBACK_LEARNING_ENABLED"]
    strong_result_min = settings["STRONG_RESULT_MIN"]
    similarity_threshold = settings["SIMILARITY_THRESHOLD"]
    feedback_boost_cap = settings["FEEDBACK_BOOST_CAP"]

    # Step 1: Initial FAISS retrieval
    candidates = retrieve(query, faiss_index, metadata)
    intelligence: dict = {
        "hyde_triggered": False,
        "hyde_bio": None,
        "feedback_applied": False,
    }

    # Step 2: HyDE expansion — only when enabled and query is weak
    if query_expansion_enabled and _is_weak_query(candidates, strong_result_min, similarity_threshold):
        bio = _generate_hypothetical_bio(query)
        if bio is not None:
            original_vec = embed_query(query)
            blended_vec = _blend_embeddings(original_vec, bio)
            hyde_candidates = _search_with_vector(blended_vec, faiss_index, metadata)
            candidates = _merge_candidates(candidates, hyde_candidates)
            intelligence["hyde_triggered"] = True
            intelligence["hyde_bio"] = bio
            log.info("hyde.triggered", query_preview=query[:60])

    # Step 3: Feedback re-ranking — only when enabled
    if feedback_learning_enabled:
        candidates = _apply_feedback_boost(candidates, db, feedback_boost_cap)
        intelligence["feedback_applied"] = True

    return candidates, intelligence

# ── Internal helpers ──────────────────────────────────────────────────────────


def _is_weak_query(
    candidates: list[RetrievedExpert],
    strong_result_min: int,
    similarity_threshold: float,
) -> bool:
    """
    Return True when the first FAISS pass produced too few strong results.

    A query is considered weak when fewer than strong_result_min candidates
    score >= similarity_threshold. HyDE is only triggered for weak queries.
    """
    strong = sum(1 for c in candidates if c.score >= similarity_threshold)
    return strong < strong_result_min


def _generate_hypothetical_bio(query: str) -> str | None:
    """
    Generate a hypothetical expert bio shaped to match the FAISS embedding space.

    Returns None on any failure — the caller falls back to the original candidates.
    The bio is first-person and domain-specific to land in the expert-bio region of
    the embedding space rather than the question/problem region.
    """
    prompt = (
        f"Write a short professional bio (2-3 sentences) for an expert consultant "
        f"who would be the perfect answer to this problem:\n\n"
        f"\"{query}\"\n\n"
        f"Write the bio in first person. Focus on domain expertise, not generic skills. "
        f"Example style: 'I am a tax attorney specializing in EU VAT compliance for "
        f"e-commerce companies. I have advised 50+ startups on cross-border tax structures.'"
    )
    try:
        response = _get_hyde_client().models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=200,
            ),
        )
        bio = (response.text or "").strip()
        return bio if bio else None
    except Exception as exc:
        log.warning("hyde.generation_failed", error=str(exc))
        return None


def _blend_embeddings(original_vec: list[float], hyde_text: str) -> list[float]:
    """
    Embed the hypothetical bio, average with the original query vector, and
    L2-normalize the result.

    CRITICAL: The average of two unit vectors is NOT itself a unit vector.
    faiss.normalize_L2 is MANDATORY here — without it, IndexFlatIP scores are
    corrupted (scores become incomparable to the SIMILARITY_THRESHOLD baseline).

    Args:
        original_vec: L2-normalized query embedding from embed_query().
        hyde_text:    Hypothetical bio text to embed.

    Returns:
        L2-normalized blended vector (same dimension as original_vec).
    """
    hyde_vec = embed_query(hyde_text)  # Already L2-normalized by embed_query()
    orig = np.array(original_vec, dtype=np.float32)
    hyp = np.array(hyde_vec, dtype=np.float32)
    blended = (orig + hyp) / 2.0
    blended = blended.reshape(1, -1)
    faiss.normalize_L2(blended)  # MANDATORY — averaged vectors are NOT unit length
    return blended[0].tolist()


def _search_with_vector(
    blended_vec: list[float],
    faiss_index,
    metadata: list[dict],
) -> list[RetrievedExpert]:
    """
    Search FAISS with a pre-built vector (instead of a query string).

    Replicates the core search logic from retriever.retrieve() but accepts a
    pre-computed, L2-normalized vector. Filters incomplete experts the same way.

    Args:
        blended_vec:  L2-normalized vector to search with.
        faiss_index:  Loaded FAISS index from app.state.faiss_index.
        metadata:     Position-aligned metadata list from app.state.metadata.

    Returns:
        List of RetrievedExpert sorted by score descending, length 0-TOP_K.
    """
    vector = np.array(blended_vec, dtype=np.float32).reshape(1, -1)
    k = min(TOP_K, faiss_index.ntotal)
    scores, indices = faiss_index.search(vector, k)
    scores = scores[0].tolist()
    indices = indices[0].tolist()

    candidates: list[RetrievedExpert] = []
    for score, idx in zip(scores, indices):
        if idx < 0:
            continue
        row = metadata[idx]

        def _get(row: dict, *keys: str) -> str | None:
            for k in keys:
                for candidate in (k, k.replace("_", " ")):
                    v = row.get(candidate)
                    if v is None:
                        v = next((row[rk] for rk in row if rk.lower() == candidate.lower()), None)
                    if v and str(v).strip() and str(v).strip().lower() not in ("nan", "none", ""):
                        return str(v).strip()
            return None

        first = _get(row, "First Name", "first_name", "first name")
        last = _get(row, "Last Name", "last_name", "last name")
        if first and last:
            name = f"{first} {last}"
        else:
            name = _get(row, "name", "Name", "expert_name", "Full Name", "full_name")

        title = _get(row, "Job Title", "job_title", "title", "Title", "position", "Role")
        company = _get(row, "company", "Company", "organization", "employer")
        hourly_rate = _get(row, "Hourly Rate", "hourly_rate", "hourly rate", "rate", "Rate", "price")
        bio = _get(row, "Bio", "bio", "description", "about", "summary")

        if not name or not hourly_rate or not bio:
            continue

        profile_url = _get(row, "Profile URL with UTM", "profile_url_with_utm", "Link", "profile_url", "url", "URL")

        candidates.append(RetrievedExpert(
            name=name,
            title=title,
            company=company,
            hourly_rate=hourly_rate,
            profile_url=profile_url,
            score=score,
            raw=row,
        ))

    return candidates


def _merge_candidates(
    original: list[RetrievedExpert],
    hyde_candidates: list[RetrievedExpert],
) -> list[RetrievedExpert]:
    """
    Merge original and HyDE candidates, deduplicating by profile_url.

    For duplicates, the higher score wins. Experts without a profile_url are
    deduped by name as a fallback key. Results are re-sorted descending by score
    and trimmed to TOP_K.

    Args:
        original:        Candidates from the initial FAISS pass.
        hyde_candidates: Candidates from the HyDE-blended FAISS pass.

    Returns:
        Merged, deduplicated, sorted list of up to TOP_K RetrievedExpert items.
    """
    seen: dict[str, RetrievedExpert] = {}

    def _key(expert: RetrievedExpert) -> str:
        return expert.profile_url if expert.profile_url else expert.name

    for expert in original + hyde_candidates:
        key = _key(expert)
        if key not in seen or expert.score > seen[key].score:
            seen[key] = expert

    merged = sorted(seen.values(), key=lambda e: e.score, reverse=True)
    return merged[:TOP_K]


def _apply_feedback_boost(
    candidates: list[RetrievedExpert],
    db: Session,
    feedback_boost_cap: float = 0.20,
) -> list[RetrievedExpert]:
    """
    Re-rank candidates using cumulative thumbs up/down feedback signals.

    Cold-start guard: experts with fewer than 10 global feedback interactions
    receive no boost (prevents statistical noise from sparse data — SEARCH-05).

    Boost formula (uses feedback_boost_cap, default 0.20):
        ratio = up / (up + down)
        boost_factor = feedback_boost_cap * 2   # ratio range 0.0-1.0, cap range 0.0-0.50
        if ratio > 0.5: multiplier = 1.0 + (ratio - 0.5) * boost_factor  (max 1 + cap)
        if ratio < 0.5: multiplier = 1.0 - (0.5 - ratio) * boost_factor  (min 1 - cap)
        if ratio == 0.5: multiplier = 1.0 (no change)

    Graceful degradation: any DB error returns candidates unchanged and logs a
    warning. Never raises — SEARCH-06 requires feedback to never block search.

    Args:
        candidates:        Current candidate list (may have been HyDE-merged).
        db:                SQLAlchemy Session for feedback table access.
        feedback_boost_cap: Max fractional score adjustment (0.0–0.50). DB-controlled.

    Returns:
        Re-ranked candidates (or original list on DB failure).
    """
    try:
        urls = [c.profile_url for c in candidates if c.profile_url]
        url_set = set(urls)

        # Guard: return early if no candidates have a profile_url to look up.
        # Also avoids empty .in_() query (same pattern as Phase 09-01 decision).
        if not url_set:
            return candidates

        # Load all up/down feedback rows — SQLite has no JSON indexing so we
        # filter expert_ids in Python. Acceptable for small feedback tables.
        rows = db.scalars(
            select(Feedback).where(Feedback.vote.in_(["up", "down"]))
        ).all()

        # Accumulate per-URL vote counts
        counts: dict[str, dict[str, int]] = {u: {"up": 0, "down": 0} for u in url_set}

        for row in rows:
            expert_ids = json.loads(row.expert_ids or "[]")
            for eid in expert_ids:
                if eid in url_set:
                    counts[eid][row.vote] = counts[eid].get(row.vote, 0) + 1

        # Compute multipliers for experts that meet the cold-start threshold
        boost_factor = feedback_boost_cap * 2  # ratio range 0.0-1.0, cap range 0.0-0.50
        multipliers: dict[str, float] = {}
        for url in url_set:
            up = counts[url]["up"]
            down = counts[url]["down"]
            total = up + down
            if total < 10:
                # Cold-start guard — do not boost experts with sparse feedback
                continue
            ratio = up / total
            if ratio > 0.5:
                boost = (ratio - 0.5) * boost_factor  # max feedback_boost_cap at ratio=1.0
                multipliers[url] = 1.0 + boost
            elif ratio < 0.5:
                penalty = (0.5 - ratio) * boost_factor  # max feedback_boost_cap at ratio=0.0
                multipliers[url] = 1.0 - penalty

        # Apply multipliers in-place (dataclass fields are mutable)
        for candidate in candidates:
            if candidate.profile_url and candidate.profile_url in multipliers:
                candidate.score *= multipliers[candidate.profile_url]

        # Re-sort after applying all multipliers
        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates

    except Exception as exc:
        log.warning("feedback.score_load_failed", error=str(exc))
        return candidates  # Degrade gracefully — never raise (SEARCH-06)
