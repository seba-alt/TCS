#!/usr/bin/env python3
"""
Offline ingestion: Expert DB table -> FAISS index + metadata JSON.

Run AFTER scripts/tag_experts.py has tagged experts:
  python scripts/ingest.py

NEVER call this at API startup — it takes 60+ seconds and hits the embedding API.

Source: SQLAlchemy Expert table (NOT experts.csv — tags written by tag_experts.py
are included in the embedding text only when reading from DB).

Only tagged experts (tags IS NOT NULL) are indexed. Experts with no bio are
excluded from tagging and therefore excluded from the FAISS index.

Index promotion: written to staging path first, count assertion checked,
then atomically renamed to production path. Prevents a partial write from
corrupting the production index.
"""
import json
import sys
import time
from pathlib import Path

import faiss
import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

# Load .env for local development — no-op in production
load_dotenv()

# Import app modules — must run from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import (  # noqa: E402
    EMBEDDING_MODEL,
    FAISS_INDEX_PATH,
    INGEST_BATCH_SIZE,
    METADATA_PATH,
    OUTPUT_DIM,
)
from app.database import SessionLocal  # noqa: E402
from app.models import Expert  # noqa: E402
from sqlalchemy import select  # noqa: E402

client = genai.Client()

STAGING_PATH = FAISS_INDEX_PATH.with_suffix(".staging")


def load_tagged_experts() -> list[dict]:
    """
    Load all Expert rows where tags IS NOT NULL.
    Returns list of dicts for use in expert_to_text() and metadata.
    """
    with SessionLocal() as db:
        experts = db.scalars(
            select(Expert).where(Expert.tags.isnot(None))
        ).all()
        return [
            {
                "id": e.id,
                "username": e.username,
                "First Name": e.first_name,
                "Last Name": e.last_name,
                "Job Title": e.job_title,
                "Company": e.company,
                "Bio": e.bio,
                "Hourly Rate": e.hourly_rate,
                "Currency": e.currency,
                "Profile URL": e.profile_url,
                "Profile URL with UTM": e.profile_url_utm,
                "tags": json.loads(e.tags or "[]"),
                "findability_score": e.findability_score,
                "photo_url": e.photo_url,
                "category": e.category,
            }
            for e in experts
        ]


def expert_to_text(expert: dict) -> str:
    """
    Construct semantically rich embedding text from an expert dict.
    Tags are appended as 'Domains: tag1, tag2, tag3.' for richer semantic signal.
    """
    first = str(expert.get("First Name") or "").strip()
    last = str(expert.get("Last Name") or "").strip()
    name = f"{first} {last}".strip()
    title = str(expert.get("Job Title") or "").strip()
    company = str(expert.get("Company") or "").strip()
    bio = str(expert.get("Bio") or "").strip()
    tags: list[str] = expert.get("tags") or []

    parts = []
    if name:
        parts.append(f"{name}.")
    if title and company:
        parts.append(f"{title} at {company}.")
    elif title:
        parts.append(f"{title}.")
    elif company:
        parts.append(f"Works at {company}.")
    if bio:
        parts.append(bio)
    if tags:
        parts.append(f"Domains: {', '.join(tags)}.")

    return " ".join(parts) if parts else name or expert.get("username", "Unknown expert")


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    reraise=True,
)
def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of texts with tenacity retry for 429 rate limit errors.
    Returns list of OUTPUT_DIM-length float vectors.
    """
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=OUTPUT_DIM,
        ),
    )
    return [e.values for e in result.embeddings]


def build_index(experts: list[dict]) -> tuple[faiss.IndexFlatIP, list[dict]]:
    """
    Embed all experts in batches and build a FAISS IndexFlatIP.
    Applies L2 normalization (required for truncated-dim cosine similarity).
    """
    all_vectors: list[list[float]] = []
    total = len(experts)

    for i in range(0, total, INGEST_BATCH_SIZE):
        batch = experts[i:i + INGEST_BATCH_SIZE]
        texts = [expert_to_text(e) for e in batch]

        try:
            vectors = embed_batch(texts)
        except Exception as e:
            print(f"[error] Batch {i}-{i + len(batch)} failed after retries: {e}")
            raise

        all_vectors.extend(vectors)

        done = min(i + INGEST_BATCH_SIZE, total)
        print(f"  Embedded {done}/{total} experts ({done * 100 // total}%)")

        if i + INGEST_BATCH_SIZE < total:
            time.sleep(0.5)

    matrix = np.array(all_vectors, dtype=np.float32)
    faiss.normalize_L2(matrix)

    index = faiss.IndexFlatIP(OUTPUT_DIM)
    index.add(matrix)

    return index, experts  # Return original experts dicts as metadata


def main() -> None:
    # Clean up any stale staging file from a previous crashed run
    if STAGING_PATH.exists():
        STAGING_PATH.unlink()
        print(f"Removed stale staging file: {STAGING_PATH}")

    print("Loading tagged experts from DB...")
    experts = load_tagged_experts()
    actual_count = len(experts)

    if actual_count == 0:
        print("[error] No tagged experts found in DB. Run scripts/tag_experts.py first.")
        sys.exit(1)

    print(f"  {actual_count} tagged experts loaded (of 1558 total; {1558 - actual_count} skipped — no bio or untagged)")
    print()
    print(f"Embedding {actual_count} experts in batches of {INGEST_BATCH_SIZE}...")
    print(f"  Model: {EMBEDDING_MODEL}, dim: {OUTPUT_DIM}")
    print()

    index, metadata = build_index(experts)

    # Crash-safe promotion: write to staging, assert count, then rename to production path
    FAISS_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)

    print()
    print("Writing index to staging path...")
    faiss.write_index(index, str(STAGING_PATH))
    print(f"  Staging: {STAGING_PATH} ({index.ntotal} vectors)")

    # Assert before promoting — never overwrite production with a mismatched index
    assert index.ntotal == actual_count, (
        f"Index count mismatch: {index.ntotal} != {actual_count}. "
        f"Staging file kept at {STAGING_PATH} for inspection."
    )

    STAGING_PATH.rename(FAISS_INDEX_PATH)
    print(f"  Promoted to: {FAISS_INDEX_PATH}")

    # Write metadata.json — includes tags for each expert (preserves retriever.py lookup pattern)
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=None, default=str)
    print(f"  Metadata: {METADATA_PATH} ({len(metadata)} records)")

    print()
    print(f"Ingestion complete: {index.ntotal} experts indexed at {OUTPUT_DIM} dims.")


if __name__ == "__main__":
    main()
