"""
SQLAlchemy ORM models.

Conversation: persists every user interaction for lead capture and analytics.
Email is required — the chat endpoint enforces this at request validation time.
"""
import datetime

from sqlalchemy import Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    # history: JSON-serialized list of prior {role, content} dicts for multi-turn context.
    # Empty list ("[]") for first-turn queries.
    history: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    response_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "match" | "clarification"
    response_narrative: Mapped[str] = mapped_column(Text, nullable=True)
    # experts: JSON-serialized list of expert dicts (name, title, company, hourly_rate, profile_url).
    # Empty list ("[]") for clarification responses.
    response_experts: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    top_match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    gap_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")


class EmailLead(Base):
    """
    Stores email addresses submitted via the email gate for lead capture.
    Unique constraint on email prevents duplicates — use INSERT OR IGNORE (on_conflict_do_nothing)
    at the query layer for idempotency.

    # Migration note: if moving to Postgres, switch to sqlalchemy.dialects.postgresql.insert
    """

    __tablename__ = "email_leads"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )


class Feedback(Base):
    """
    Records thumbs up/down votes on expert result sets.
    Linked to a Conversation via conversation_id (no FK — consistent with schema style).
    Switching votes creates a new record (latest wins for analytics; history preserved).
    Auto-created by Base.metadata.create_all at startup — no migration script needed.
    """

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(index=True, nullable=False)
    vote: Mapped[str] = mapped_column(String(4), nullable=False)           # "up" | "down"
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)  # from email gate if provided
    expert_ids: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON list of profile_url|name
    reasons: Mapped[str | None] = mapped_column(Text, nullable=True)       # JSON list of checkbox labels
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)       # free-text from modal
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )


class Expert(Base):
    """
    Expert profiles — seeded from experts.csv on first startup, then managed via admin API.
    The experts.csv is also appended when new experts are added via POST /api/admin/experts,
    so the FAISS ingestion pipeline (scripts/ingest.py) can pick up new entries.
    """

    __tablename__ = "experts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, default="")
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    job_title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    company: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    bio: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hourly_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="EUR")
    profile_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    profile_url_utm: Mapped[str] = mapped_column(String(600), nullable=False, default="")
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
