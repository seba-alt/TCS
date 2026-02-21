"""
Pilot service — Gemini function calling proxy for the Sage co-pilot.

Two-turn pattern:
  Turn 1: Send user message + apply_filters FunctionDeclaration → Gemini returns function call
  Turn 2: Send function result back → Gemini generates Sage's confirmation response

The browser owns filter state. This service only extracts intent and generates confirmations.
"""
from __future__ import annotations

import structlog
from google import genai
from google.genai import types

log = structlog.get_logger()

GENERATION_MODEL = "gemini-2.5-flash"

APPLY_FILTERS_DECLARATION = types.FunctionDeclaration(
    name="apply_filters",
    description="Update the expert marketplace search filters based on user request.",
    parameters_json_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Text search query. Empty string to clear the search.",
            },
            "rate_min": {
                "type": "number",
                "description": "Minimum hourly rate filter.",
            },
            "rate_max": {
                "type": "number",
                "description": "Maximum hourly rate filter.",
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Domain tags to filter by (AND logic). Empty array clears tag filters.",
            },
            "reset": {
                "type": "boolean",
                "description": "If true, clear all filters and show all experts.",
            },
        },
        "required": [],
    },
)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


def run_pilot(
    message: str,
    history: list[dict],
    current_filters: dict,
) -> dict:
    """
    Two-turn Gemini function calling proxy for Sage.

    Args:
        message: Current user message.
        history: Prior conversation as list of {"role": "user"|"model", "content": str}.
                 IMPORTANT: role must be 'user' or 'model' (not 'assistant').
        current_filters: Active filter state {query, rate_min, rate_max, tags}.

    Returns:
        {"filters": dict | None, "message": str}
        - filters: apply_filters args if Gemini called the function, else None
        - message: Sage's natural language response
    """
    client = _get_client()
    tool = types.Tool(function_declarations=[APPLY_FILTERS_DECLARATION])

    system_instruction = (
        "You are Sage, a warm and helpful AI assistant for a professional expert marketplace. "
        "Help users find the right experts by updating search filters when they describe what they need. "
        "Be conversational, friendly, and concise. When a user describes a type of expert or budget, "
        "call apply_filters with the appropriate parameters. Follow-up messages should layer on top of "
        "current filters unless the user asks to reset or start over. "
        "If unsure, ask a clarifying question rather than guessing. "
        f"Current active filters: {current_filters}."
    )

    config = types.GenerateContentConfig(
        tools=[tool],
        system_instruction=system_instruction,
    )

    # Build conversation history as Content objects
    # NOTE: Gemini uses 'user' and 'model' roles (not 'assistant')
    contents: list[types.Content] = []
    for h in history:
        contents.append(types.Content(
            role=h["role"],  # must be 'user' or 'model'
            parts=[types.Part(text=h["content"])]
        ))
    contents.append(types.Content(
        role="user",
        parts=[types.Part(text=message)]
    ))

    # Turn 1: Attempt to extract apply_filters function call
    try:
        response = client.models.generate_content(
            model=GENERATION_MODEL,
            contents=contents,
            config=config,
        )
    except Exception as e:
        log.error("pilot: gemini turn 1 failed", error=str(e))
        return {
            "filters": None,
            "message": "I'm having trouble connecting right now. Please try again in a moment.",
        }

    filters_applied: dict | None = None

    if response.function_calls:
        fn_call = response.function_calls[0]
        if fn_call.name == "apply_filters":
            # Extract and sanitize filter args
            filters_applied = {k: v for k, v in fn_call.args.items()}

            # Turn 2: Send function result back to get Sage's confirmation response
            try:
                contents.append(response.candidates[0].content)
                contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_function_response(
                        name="apply_filters",
                        response={"result": "Filters applied successfully."},
                    )]
                ))
                final = client.models.generate_content(
                    model=GENERATION_MODEL,
                    contents=contents,
                    config=config,
                )
                confirmation = final.text or "Done! I've updated your search filters."
            except Exception as e:
                log.error("pilot: gemini turn 2 failed", error=str(e))
                confirmation = "I've updated your filters! Check the results."
        else:
            # Unknown function — fall back to text
            confirmation = response.text or "I'm not sure how to help with that. Could you tell me more?"
            filters_applied = None
    else:
        # No function call — clarification, greeting, or unknown request
        confirmation = response.text or "I'm not sure what you're looking for. Could you tell me more about the type of expert you need?"

    log.info(
        "pilot: request processed",
        has_filters=filters_applied is not None,
        message_length=len(confirmation),
    )

    return {"filters": filters_applied, "message": confirmation}
