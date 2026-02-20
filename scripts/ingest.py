#!/usr/bin/env python3
"""
Offline ingestion: experts.csv -> FAISS index + metadata JSON.

Run ONCE before starting the API server:
  python scripts/ingest.py

NEVER call this at API startup — it takes 60+ seconds and hits the embedding API.

Prerequisites:
  1. GOOGLE_API_KEY set in environment (or .env file)
  2. data/experts.csv exists
  3. Run scripts/validate_csv.py first to confirm column names
"""
import json
import sys
import time
from pathlib import Path

import faiss
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

# Load .env for local development — no-op in production
load_dotenv()

# Import shared constants — OUTPUT_DIM must match embedder.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import (
    EMBEDDING_MODEL,
    FAISS_INDEX_PATH,
    INGEST_BATCH_SIZE,
    METADATA_PATH,
    OUTPUT_DIM,
)

client = genai.Client()


def expert_to_text(row: dict) -> str:
    """
    Construct semantically rich embedding text from a CSV row.

    IMPORTANT: Adjust field names below to match your actual CSV columns.
    Run scripts/validate_csv.py first to see the exact column names.

    Field weight rationale:
    - title/role carries the most retrieval signal
    - company provides industry/context signal
    - bio is truncated to 300 chars to prevent long bios dominating the vector
    """
    # Common column name candidates — update after running validate_csv.py
    title = row.get("title") or row.get("job_title") or row.get("role") or ""
    company = row.get("company") or row.get("organization") or row.get("employer") or ""
    industry = row.get("industry") or row.get("sector") or row.get("category") or ""
    bio = row.get("bio") or row.get("description") or row.get("about") or row.get("summary") or ""

    bio_truncated = str(bio)[:300] if bio else ""

    parts = []
    if title:
        parts.append(f"{title} at {company}." if company else title + ".")
    if industry:
        parts.append(f"Industry: {industry}.")
    if bio_truncated:
        parts.append(bio_truncated)

    return " ".join(parts) if parts else str(row)


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
            task_type="RETRIEVAL_DOCUMENT",  # Different from RETRIEVAL_QUERY at runtime
            output_dimensionality=OUTPUT_DIM,
        ),
    )
    return [e.values for e in result.embeddings]


def build_index(df: pd.DataFrame) -> tuple[faiss.IndexFlatIP, list[dict]]:
    """
    Embed all experts in batches and build a FAISS IndexFlatIP.
    Applies L2 normalization (required for truncated-dim cosine similarity).
    """
    all_vectors: list[list[float]] = []
    metadata: list[dict] = []
    total = len(df)

    for i in range(0, total, INGEST_BATCH_SIZE):
        batch = df.iloc[i:i + INGEST_BATCH_SIZE]
        texts = [expert_to_text(row.to_dict()) for _, row in batch.iterrows()]

        try:
            vectors = embed_batch(texts)
        except Exception as e:
            print(f"[error] Batch {i}-{i + len(batch)} failed after retries: {e}")
            raise

        all_vectors.extend(vectors)
        for _, row in batch.iterrows():
            metadata.append(row.to_dict())

        done = min(i + INGEST_BATCH_SIZE, total)
        print(f"  Embedded {done}/{total} experts ({done * 100 // total}%)")

        # Throttle slightly to stay within rate limits
        if i + INGEST_BATCH_SIZE < total:
            time.sleep(0.5)

    # L2 normalize: REQUIRED for cosine similarity via IndexFlatIP on truncated dims.
    # Full 3072-dim vectors are pre-normalized; 768-dim vectors are NOT.
    matrix = np.array(all_vectors, dtype=np.float32)
    faiss.normalize_L2(matrix)

    index = faiss.IndexFlatIP(OUTPUT_DIM)
    index.add(matrix)

    return index, metadata


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/experts.csv")

    if not csv_path.exists():
        print(f"[error] CSV not found: {csv_path}")
        print("  Place experts.csv in data/ and run: python scripts/validate_csv.py first")
        sys.exit(1)

    print(f"Loading CSV: {csv_path}")
    try:
        df = pd.read_csv(csv_path, encoding="utf-8-sig")
    except UnicodeDecodeError:
        df = pd.read_csv(csv_path, encoding="latin-1")

    print(f"  {len(df)} experts loaded, {len(df.columns)} columns")
    print(f"  Columns: {list(df.columns)}")
    print()

    print(f"Embedding {len(df)} experts in batches of {INGEST_BATCH_SIZE}...")
    print(f"  Model: {EMBEDDING_MODEL}, dim: {OUTPUT_DIM}")
    print()

    index, metadata = build_index(df)

    # Ensure data directory exists
    FAISS_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)

    print()
    print("Writing index to disk...")
    faiss.write_index(index, str(FAISS_INDEX_PATH))
    print(f"  FAISS index: {FAISS_INDEX_PATH} ({index.ntotal} vectors)")

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=None, default=str)
    print(f"  Metadata:    {METADATA_PATH} ({len(metadata)} records)")

    print()
    print(f"Ingestion complete: {index.ntotal} experts indexed at {OUTPUT_DIM} dims.")


if __name__ == "__main__":
    main()
