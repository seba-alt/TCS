"""
Embedder service — wraps google-genai for query-time embedding.

At build time (ingest.py), embeddings are batch-computed separately.
At runtime, this module embeds one query at a time for retrieval.

Task type asymmetry (IMPORTANT):
  - Indexing: task_type="RETRIEVAL_DOCUMENT"
  - Querying: task_type="RETRIEVAL_QUERY"
Using the wrong task_type degrades retrieval quality.
"""
import numpy as np
from google import genai
from google.genai import types

from app.config import EMBEDDING_MODEL, OUTPUT_DIM

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


def embed_query(text: str) -> list[float]:
    """
    Embed a single query string for semantic search.

    Returns a list of OUTPUT_DIM floats, L2-normalized for cosine similarity
    via FAISS IndexFlatIP.

    Args:
        text: The user's natural language query.

    Returns:
        list[float] of length OUTPUT_DIM (768).
    """
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
    return vector[0].tolist()
