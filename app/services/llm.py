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
    why_them: str = ""


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

    def _candidate_line(c: "RetrievedExpert") -> str:
        role = c.title or ""
        at_company = f" at {c.company}" if c.company else ""
        role_part = f"{role}{at_company}" if role else (c.company or "Independent")
        bio = str(c.raw.get("Bio") or "").strip()
        bio_part = f" | Bio: {bio[:400]}" if bio else ""
        return (
            f"- {c.name} | {role_part} | Rate: {c.hourly_rate} | "
            f"URL: {c.profile_url or 'N/A'} | Similarity: {c.score:.3f}{bio_part}"
        )

    candidates_text = "\n".join(_candidate_line(c) for c in candidates)

    allowed_names = "\n".join(f"  - {c.name}" for c in candidates) if candidates else "  (none)"

    if is_low_confidence or not candidates:
        return f"""You are a professional concierge matching users with expert consultants.

The user's query did not produce high-confidence expert matches from the database.
Query: "{query}"{history_text}

Retrieved candidates (low confidence — scores below {SIMILARITY_THRESHOLD}):
{candidates_text if candidates else "(none)"}

STRICT RULE: You may ONLY recommend experts from the list above. Never invent or suggest anyone not listed.

Evaluate whether these candidates actually address the user's problem.
- If match quality is poor → type="clarification", ask one targeted follow-up question, experts=[]
- If candidates are usable → type="match", pick the best available (up to 3)

Return JSON:
- "type": "clarification" or "match"
- "narrative": clarification question OR 1-2 sentence intro (no expert explanations in narrative)
- "experts": array of matched experts (empty for clarification); each must be a name from the allowed list above

Each expert object: {{"name": str, "title": str, "company": str, "hourly_rate": str, "profile_url": str or null, "why_them": str}}
Copy name, title, company, hourly_rate, profile_url exactly as shown above — do not alter them."""

    return f"""You are a professional concierge matching users with expert consultants.

User query: "{query}"{history_text}

Candidate experts retrieved from the database:
{candidates_text}

STRICT RULE: You may ONLY select from these exact candidates:
{allowed_names}
Never suggest anyone not on this list. Copy their name, title, company, hourly_rate, and profile_url exactly as shown.

Select the 3 best-matched experts and return JSON:
- "type": "match"
- "narrative": 1-2 sentence intro acknowledging the user's need (no expert explanations here)
- "experts": exactly 3 objects, each from the allowed list above

Each expert object: {{"name": str, "title": str, "company": str, "hourly_rate": str, "profile_url": str or null, "why_them": str}}
"why_them": 1-2 sentences referencing their specific role/domain and why they fit this query. Use only data shown above."""


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

            # Build lookup by normalized name to validate LLM output against candidates
            candidate_lookup = {
                c.name.strip().lower(): c for c in candidates
            }

            experts: list[Expert] = []
            for e in experts_raw:
                llm_name = str(e.get("name", "")).strip()
                canonical = candidate_lookup.get(llm_name.lower())
                if canonical is None:
                    # LLM hallucinated a name not in candidates — drop it
                    log.warning(
                        "llm.hallucinated_expert",
                        name=llm_name,
                        allowed=[c.name for c in candidates],
                    )
                    continue
                # Use candidate's own fields for name/title/company/rate/url to prevent drift
                experts.append(Expert(
                    name=canonical.name,
                    title=canonical.title or e.get("title", ""),
                    company=canonical.company or e.get("company", ""),
                    hourly_rate=canonical.hourly_rate,
                    profile_url=canonical.profile_url,
                    why_them=e.get("why_them", ""),
                ))

            log.info(
                "llm.generate_response",
                type=response_type,
                expert_count=len(experts),
                hallucinated=len(experts_raw) - len(experts),
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
