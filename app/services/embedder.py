"""
Embedder service — wraps google-genai for query-time embedding.

At build time (ingest.py), embeddings are batch-computed separately.
At runtime, this module embeds one query at a time for retrieval.

Task type asymmetry (IMPORTANT):
  - Indexing: task_type="RETRIEVAL_DOCUMENT"
  - Querying: task_type="RETRIEVAL_QUERY"
Using the wrong task_type degrades retrieval quality.
"""
import threading
import time

import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import EMBEDDING_MODEL, OUTPUT_DIM

# Load .env for local development — no-op in production and when already loaded
load_dotenv()

# Lazy client — initialized on first use so that importing this module
# does not require GOOGLE_API_KEY to be set at import time.
# The client picks up GOOGLE_API_KEY from environment automatically.
# Never pass the key as a constructor argument.
_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


# ── TTL embedding cache (PERF-01) ────────────────────────────────────────────
# Caches query_text → (embedding_vector, timestamp) to avoid duplicate Google
# API calls (~500ms each) for repeated identical queries within 60 seconds.
_embed_cache: dict[str, tuple[list[float], float]] = {}
_embed_lock = threading.Lock()
EMBED_CACHE_TTL = 60.0  # seconds


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
)
def embed_query(text: str) -> list[float]:
    """
    Embed a single query string for semantic search.

    Uses an in-memory TTL cache (60s) to avoid redundant Google API calls
    for repeated identical queries. Thread-safe via threading.Lock.

    Returns a list of OUTPUT_DIM floats, L2-normalized for cosine similarity
    via FAISS IndexFlatIP.

    Args:
        text: The user's natural language query.

    Returns:
        list[float] of length OUTPUT_DIM (768).
    """
    now = time.time()

    # Check cache under lock (fast path for cache hits)
    with _embed_lock:
        cached = _embed_cache.get(text)
        if cached is not None:
            vec, ts = cached
            if now - ts < EMBED_CACHE_TTL:
                return vec

    # Cache miss or stale — call Google API outside the lock
    result = _get_client().models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=OUTPUT_DIM,
        ),
    )
    vector = np.array(result.embeddings[0].values, dtype=np.float32).reshape(1, -1)
    # Normalize: truncated-dim vectors are NOT pre-normalized by Google.
    import faiss
    faiss.normalize_L2(vector)
    result_vec = vector[0].tolist()

    # Store in cache and evict stale entries
    with _embed_lock:
        _embed_cache[text] = (result_vec, time.time())
        # Evict entries older than TTL to prevent unbounded growth
        now2 = time.time()
        stale_keys = [k for k, (_, ts) in _embed_cache.items() if now2 - ts > EMBED_CACHE_TTL]
        for k in stale_keys:
            del _embed_cache[k]

    return result_vec
