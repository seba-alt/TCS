"""
Shared expert enrichment utilities: tag generation and findability scoring.

Used by:
  - scripts/tag_experts.py  (batch run; async variant calls Gemini async)
  - app/routers/admin.py    (sync call on POST /api/admin/experts)

tag_expert_sync() uses the sync google-genai client — ONLY call from sync
FastAPI route handlers. For async batch context, use the async pattern in
scripts/tag_experts.py directly.
"""
import json
from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from app.models import Expert


def compute_findability_score(expert: "Expert", tags: list[str] | None = None) -> float:
    """
    Compute 0-100 findability score per FIND-01 formula:
      Bio presence/length : 40 pts (linear scale, 500 chars = max)
      Tags present        : 25 pts
      Profile URL present : 15 pts
      Job title present   : 10 pts
      Hourly rate > 0     : 10 pts
    """
    score = 0.0

    bio = (expert.bio or "").strip()
    if bio:
        score += min(40.0, len(bio) / 500 * 40)

    effective_tags = tags if tags is not None else json.loads(expert.tags or "[]")
    if effective_tags:
        score += 25.0

    if (expert.profile_url or "").strip():
        score += 15.0

    if (expert.job_title or "").strip():
        score += 10.0

    if expert.hourly_rate and expert.hourly_rate > 0:
        score += 10.0

    return round(score, 1)


def tag_expert_sync(expert: "Expert") -> list[str]:
    """
    Call Gemini 2.5 Flash synchronously to generate domain tags for one expert.
    Returns normalized (lowercase, stripped) tag list.
    Raises on API failure — caller is responsible for try/except.
    Uses sync client — safe to call from sync FastAPI routes.
    """
    from google import genai
    from google.genai import types
    from pydantic import BaseModel

    class ExpertTags(BaseModel):
        tags: List[str]

    client = genai.Client()
    prompt = (
        f"Generate 3-8 concise domain expertise tags for this professional consultant.\n\n"
        f"Name: {expert.username}\n"
        f"Job Title: {expert.job_title or 'N/A'}\n"
        f"Bio: {expert.bio}\n\n"
        f"Example tags: 'machine learning', 'tax law', 'veterinary', 'crypto', "
        f"'real estate', 'supply chain', 'fundraising', 'climate tech'\n\n"
        f"Return tags that reflect their actual domain — not generic business terms."
    )
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExpertTags,
            temperature=0.2,
        ),
    )
    data = ExpertTags.model_validate_json(response.text)
    return [t.lower().strip() for t in data.tags if t.strip()]
