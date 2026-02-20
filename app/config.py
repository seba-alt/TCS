"""
Shared configuration constants.

OUTPUT_DIM must match between ingest.py (build-time) and embedder.py (runtime).
Changing OUTPUT_DIM requires re-running ingest.py to rebuild the FAISS index.
"""
from pathlib import Path

# Embedding model — text-embedding-004 is SHUT DOWN (Jan 14, 2026). Do not use.
EMBEDDING_MODEL = "gemini-embedding-001"

# Truncate from 3072 to 768 dims: 75% storage savings, 0.26% quality loss.
# IMPORTANT: 768-dim vectors are NOT pre-normalized. ingest.py and embedder.py
# must both call faiss.normalize_L2() before FAISS operations.
OUTPUT_DIM = 768

# Batch size for embedding API calls during ingestion.
# 100 is conservative — backoff handles rate limit 429s.
INGEST_BATCH_SIZE = 100

# Absolute paths to data files — avoids CWD-relative path failures.
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FAISS_INDEX_PATH = DATA_DIR / "faiss.index"
METADATA_PATH = DATA_DIR / "metadata.json"
