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

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import faiss
import numpy as np

from app.services.embedder import embed_query

if TYPE_CHECKING:
    pass

# How many candidates to retrieve from FAISS before LLM selection.
# Retrieve more than 3 to give the LLM room to skip low-quality matches.
TOP_K = 5

# Cosine similarity threshold (inner product on L2-normalized vectors = cosine similarity).
# Candidates below this score trigger the dual low-confidence check path in the LLM service.
# 0.65 is conservative — tune down if too many valid queries are flagged as low-confidence.
SIMILARITY_THRESHOLD = 0.60


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
                # Try exact key, then underscore→space, then case-insensitive scan
                for candidate in (k, k.replace("_", " ")):
                    v = row.get(candidate)
                    if v is None:
                        # Case-insensitive fallback
                        v = next((row[rk] for rk in row if rk.lower() == candidate.lower()), None)
                    if v and str(v).strip() and str(v).strip().lower() not in ("nan", "none", ""):
                        return str(v).strip()
            return None

        # Handle split first/last name fields
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

        # Require name, hourly_rate, and bio — without a bio we can't verify the match
        if not name or not hourly_rate or not bio:
            continue

        # Use pre-tagged UTM URL from CSV; fall back to plain profile URL or Link column
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
