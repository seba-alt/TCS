"""
LLM generation service — calls Gemini to produce structured expert recommendations.

Key design decisions (from CONTEXT.md):
- Model: gemini-2.5-flash (NOT gemini-2.0-flash — deprecated, shutdown June 2026)
- Response format: JSON mode via response_mime_type="application/json"
- Response schema: {"type": "match"|"clarification", "narrative": str, "experts": [...]}
- "Why them" style: 1-2 sentences, query-specific, grounded in title/company/domain
- Low-confidence path: BOTH score threshold AND LLM judgment — score check runs first (fast)
- Retry: up to 3 attempts with exponential backoff on Gemini API failure
- History: last N messages as context (sliding window, configurable via HISTORY_WINDOW)
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field

import structlog
from google import genai
from google.genai import types

from app.services.retriever import RetrievedExpert, SIMILARITY_THRESHOLD

log = structlog.get_logger()

GENERATION_MODEL = "gemini-2.5-flash"  # Do NOT use gemini-2.0-flash (deprecated)
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # seconds; doubles each retry (1s, 2s, 4s)

# Number of prior conversation turns to include as context.
# Each "turn" = one user query + one assistant response.
# Configurable: set HISTORY_WINDOW=0 to disable multi-turn context.
HISTORY_WINDOW = 3


@dataclass
class Expert:
    name: str
    title: str
    company: str
    hourly_rate: str
    profile_url: str | None


@dataclass
class ChatResponse:
    type: str  # "match" | "clarification"
    narrative: str
    experts: list[Expert] = field(default_factory=list)


# Lazy Gemini client (same pattern as embedder.py — deferred so module imports without API key)
_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


def _build_prompt(
    query: str,
    candidates: list[RetrievedExpert],
    history: list[dict],
    is_low_confidence: bool,
) -> str:
    """Build the Gemini prompt from query, candidates, and conversation history."""
    history_text = ""
    if history:
        turns = history[-HISTORY_WINDOW * 2:]  # Each turn = 2 entries (user + assistant)
        history_text = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in turns
        )
        history_text = f"\n\nConversation history (most recent {HISTORY_WINDOW} turns):\n{history_text}"

    candidates_text = "\n".join(
        f"- {c.name} | {c.title} at {c.company} | Rate: {c.hourly_rate} | "
        f"URL: {c.profile_url or 'N/A'} | Similarity: {c.score:.3f}"
        for c in candidates
    )

    if is_low_confidence or not candidates:
        return f"""You are a professional concierge matching users with expert consultants.

The user's query did not produce high-confidence expert matches from the database.
Query: "{query}"{history_text}

Retrieved candidates (low confidence — scores below {SIMILARITY_THRESHOLD}):
{candidates_text if candidates else "(none)"}

First, evaluate whether these candidates actually address the user's problem. If the match quality is poor, respond with type="clarification" and ask one targeted follow-up question to better understand their need. If candidates are usable despite low scores, respond with type="match" and recommend the best 3.

Return a JSON object with exactly these fields:
- "type": "clarification" or "match"
- "narrative": your response text (for clarification: a single follow-up question; for match: 1-2 sentence intro then 3 expert recommendations)
- "experts": for "match" — array of exactly 3 objects; for "clarification" — empty array []

Each expert object: {{"name": str, "title": str, "company": str, "hourly_rate": str, "profile_url": str or null}}

For match responses: each "Why them" explanation must be 1-2 sentences, reference the expert's specific title/company/domain, and tie directly to what the user asked. No hallucinated details — only use the data provided above."""

    return f"""You are a professional concierge matching users with expert consultants.

User query: "{query}"{history_text}

Top candidate experts from our database:
{candidates_text}

Select the 3 best-matched experts from this list. Write a response with:
1. A brief 1-2 sentence intro acknowledging the user's need
2. For each of the 3 experts: a "Why them:" explanation of 1-2 sentences that references their specific title, company, or domain and explains why they fit this exact query. No hallucinated details — only use the data provided above.

Return a JSON object with exactly these fields:
- "type": "match"
- "narrative": the full combined text (intro + all 3 expert explanations as one prose block)
- "experts": array of exactly 3 objects: {{"name": str, "title": str, "company": str, "hourly_rate": str, "profile_url": str or null}}"""


def generate_response(
    query: str,
    candidates: list[RetrievedExpert],
    history: list[dict],
) -> ChatResponse:
    """
    Generate expert recommendations or a clarifying question via Gemini.

    Args:
        query: The user's natural language query.
        candidates: Retrieved expert candidates from the retriever service.
        history: Prior conversation turns [{role: "user"|"assistant", content: str}].
                 Sliding window — pass the full history; this function trims to HISTORY_WINDOW.

    Returns:
        ChatResponse with type, narrative, and experts list.

    Raises:
        RuntimeError: If all retries are exhausted and Gemini still fails.
    """
    # Score-based low-confidence check (fast path — runs before calling LLM)
    is_low_confidence = (
        not candidates
        or all(c.score < SIMILARITY_THRESHOLD for c in candidates)
    )

    prompt = _build_prompt(query, candidates, history, is_low_confidence)

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            response = _get_client().models.generate_content(
                model=GENERATION_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,  # Low temperature for consistent structured output
                ),
            )
            raw_json = response.text
            data = json.loads(raw_json)

            response_type = data.get("type", "match")
            narrative = data.get("narrative", "")
            experts_raw = data.get("experts", [])

            experts = [
                Expert(
                    name=e.get("name", ""),
                    title=e.get("title", ""),
                    company=e.get("company", ""),
                    hourly_rate=e.get("hourly_rate", ""),
                    profile_url=e.get("profile_url") or None,
                )
                for e in experts_raw
            ]

            log.info(
                "llm.generate_response",
                type=response_type,
                expert_count=len(experts),
                attempt=attempt + 1,
            )
            return ChatResponse(type=response_type, narrative=narrative, experts=experts)

        except Exception as exc:
            last_error = exc
            delay = RETRY_BASE_DELAY * (2 ** attempt)
            log.warning(
                "llm.generate_response.retry",
                attempt=attempt + 1,
                max_retries=MAX_RETRIES,
                delay=delay,
                error=str(exc),
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(delay)

    raise RuntimeError(
        f"Gemini generation failed after {MAX_RETRIES} attempts: {last_error}"
    )
