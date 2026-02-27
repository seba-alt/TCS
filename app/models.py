"""
SQLAlchemy ORM models.

Conversation: persists every user interaction for lead capture and analytics.
Email is required — the chat endpoint enforces this at request validation time.
"""
import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )


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
    hyde_triggered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    feedback_applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    hyde_bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    otr_at_k: Mapped[float | None] = mapped_column(Float, nullable=True)
    # source: origin of the search — "chat" (email gate flow) or "sage" (Sage co-pilot)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True, default="chat")


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
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    findability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )


class NewsletterSubscriber(Base):
    """
    Stores email addresses submitted via the newsletter gate.
    Unique constraint on email prevents duplicates — use INSERT OR IGNORE (on_conflict_do_nothing)
    at the query layer for idempotency.

    # Migration note: if moving to Postgres, switch to sqlalchemy.dialects.postgresql.insert
    """

    __tablename__ = "newsletter_subscribers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="gate")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )


class UserEvent(Base):
    """
    Records user behavior events for marketplace intelligence (Phase 30).
    event_type allowlist: card_click, sage_query, filter_change.
    Auto-created by Base.metadata.create_all at startup — no migration needed.
    Composite index on (event_type, created_at) for Phase 31 aggregation queries.
    """
    __tablename__ = "user_events"
    __table_args__ = (
        Index("ix_user_events_type_created", "event_type", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # payload: JSON blob — shape varies by event_type (see events.py for schema)
    payload: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )


class AppSetting(Base):
    """
    Runtime configuration overrides for search intelligence.
    Key naming matches the env var names (SCREAMING_SNAKE_CASE) for clarity.
    When a row exists, it overrides the env var fallback.
    When no row exists for a key, search_intelligence.get_settings() falls back to the env var.

    Valid keys:
        QUERY_EXPANSION_ENABLED   — bool, env fallback: QUERY_EXPANSION_ENABLED or "false"
        FEEDBACK_LEARNING_ENABLED — bool, env fallback: FEEDBACK_LEARNING_ENABLED or "false"
        SIMILARITY_THRESHOLD      — float 0.0-1.0, env fallback: SIMILARITY_THRESHOLD or "0.60"
        STRONG_RESULT_MIN         — int 1-10, env fallback: STRONG_RESULT_MIN or "3"
        FEEDBACK_BOOST_CAP        — float 0.0-0.50, env fallback: FEEDBACK_BOOST_CAP or "0.20"
    """

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )
