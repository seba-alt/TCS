"""
Retrieval service — embeds a query and searches the FAISS index for expert candidates.

Key design decisions (from CONTEXT.md):
- Returns up to TOP_K=5 candidates (the LLM picks the best 3 from these)
- Experts missing name, title, company, or hourly_rate are omitted from results
- Experts missing profile_url are included — profile_url is set to None
- SIMILARITY_THRESHOLD: candidates below this score are flagged as low-confidence
- The retriever does NOT make the final "clarification vs match" decision — it returns
  scores; the LLM service makes that call (per CONTEXT.md dual-check requirement)
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import faiss
import numpy as np

from app.config import OUTPUT_DIM
from app.services.embedder import embed_query

if TYPE_CHECKING:
    pass

# How many candidates to retrieve from FAISS before LLM selection.
# Retrieve more than 3 to give the LLM room to skip low-quality matches.
TOP_K = 5

# Cosine similarity threshold (inner product on L2-normalized vectors = cosine similarity).
# Candidates below this score trigger the dual low-confidence check path in the LLM service.
# 0.65 is conservative — tune down if too many valid queries are flagged as low-confidence.
SIMILARITY_THRESHOLD = 0.65


@dataclass
class RetrievedExpert:
    """A single expert candidate returned from FAISS search."""
    name: str
    title: str
    company: str
    hourly_rate: str
    profile_url: str | None
    score: float
    raw: dict = field(repr=False)  # Original metadata dict for LLM context


def retrieve(query: str, faiss_index: faiss.IndexFlatIP, metadata: list[dict]) -> list[RetrievedExpert]:
    """
    Embed query, search FAISS, filter incomplete experts, return ranked candidates.

    Args:
        query: Natural language user query.
        faiss_index: Loaded FAISS index from app.state.faiss_index.
        metadata: Position-aligned metadata list from app.state.metadata.

    Returns:
        List of RetrievedExpert, sorted by score descending, length 0-TOP_K.
        An empty list means no valid candidates found — triggers clarification response.
    """
    # 1. Embed the query (L2-normalized 768-dim vector)
    vector = np.array(embed_query(query), dtype=np.float32).reshape(1, -1)

    # 2. Search FAISS — retrieve TOP_K nearest neighbors
    k = min(TOP_K, faiss_index.ntotal)
    scores, indices = faiss_index.search(vector, k)
    scores = scores[0].tolist()
    indices = indices[0].tolist()

    # 3. Build candidate list, skipping incomplete experts
    candidates: list[RetrievedExpert] = []
    for score, idx in zip(scores, indices):
        if idx < 0:  # FAISS returns -1 for unfilled slots when index has fewer than k vectors
            continue
        row = metadata[idx]

        # CONTEXT.md rule: omit experts missing name, title, company, or hourly_rate
        def _get(row: dict, *keys: str) -> str | None:
            for k in keys:
                v = row.get(k) or row.get(k.replace("_", " "))
                if v and str(v).strip() and str(v).strip().lower() not in ("nan", "none", ""):
                    return str(v).strip()
            return None

        name = _get(row, "name", "Name", "expert_name")
        title = _get(row, "title", "Title", "job_title", "position")
        company = _get(row, "company", "Company", "organization", "employer")
        hourly_rate = _get(row, "hourly_rate", "hourly rate", "rate", "Rate", "price")

        if not all([name, title, company, hourly_rate]):
            continue  # Skip experts missing required fields

        # CONTEXT.md rule: include expert even if profile_url is missing; just omit the link
        profile_url = _get(row, "profile_url", "profile url", "url", "URL", "link")

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
