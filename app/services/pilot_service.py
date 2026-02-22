"""
Pilot service — Gemini function calling proxy for the Sage co-pilot.

Two-turn pattern:
  Turn 1: Send user message + FunctionDeclarations → Gemini returns function call
  Turn 2: Send function result back → Gemini generates Sage's narration/confirmation

Two tools:
  - apply_filters: narrow/refine current expert results (rate, tags, keywords)
  - search_experts: discover experts from scratch via FAISS hybrid search

The browser owns filter state. This service extracts intent and generates narrations.
"""
from __future__ import annotations

import structlog
from google import genai
from google.genai import types

log = structlog.get_logger()

GENERATION_MODEL = "gemini-2.5-flash"

APPLY_FILTERS_DECLARATION = types.FunctionDeclaration(
    name="apply_filters",
    description=(
        "Narrow or refine the current expert results based on user-specified criteria "
        "(rate, tags, keywords). Use when the user is adjusting or narrowing what they "
        "already see — NOT when discovering experts from scratch. Do NOT use this when "
        "the user wants to find experts; only for adjusting what they currently see."
    ),
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

SEARCH_EXPERTS_DECLARATION = types.FunctionDeclaration(
    name="search_experts",
    description=(
        "Discover experts matching a specific need. Use when the user wants to find experts "
        "from scratch: 'find me X', 'who can help with Y', 'show me Z experts', 'I need someone who'. "
        "Performs a live search and returns matched experts."
    ),
    parameters_json_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language description of the expert needed.",
            },
            "rate_min": {"type": "number", "description": "Minimum hourly rate filter."},
            "rate_max": {"type": "number", "description": "Maximum hourly rate filter."},
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Domain tags to filter by (AND logic).",
            },
        },
        "required": ["query"],
    },
)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client()
    return _client


def _handle_apply_filters(fn_call, args, response, contents, config, client) -> dict:
    """Handle apply_filters function call — Turn 2 confirmation."""
    filters_applied = {k: v for k, v in args.items()}

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
            model=GENERATION_MODEL, contents=contents, config=config
        )
        confirmation = final.text or "Done! I've updated your search filters."
    except Exception as e:
        log.error("pilot: gemini turn 2 failed", error=str(e))
        confirmation = "I've updated your filters! Check the results."

    log.info(
        "pilot: request processed",
        fn_name=fn_call.name,
        has_filters=True,
        message_length=len(confirmation),
    )

    return {
        "filters": filters_applied,
        "message": confirmation,
        "search_performed": False,
        "total": None,
    }


def _handle_search_experts(fn_call, args, response, contents, config, db, app_state, client) -> dict:
    """
    Handle search_experts function call — calls run_explore() in-process, narrates results.

    Zero-result fallback:
      - 0 results with fallback: filters=None (grid stays as-is), Sage narrates alternative
      - 0 results, fallback also 0: filters={"reset": True} (grid resets to all experts)
    """
    from app.services.explorer import run_explore

    result = run_explore(
        query=args.get("query", ""),
        rate_min=float(args.get("rate_min", 0.0)),
        rate_max=float(args.get("rate_max", 10000.0)),
        tags=list(args.get("tags", [])),
        limit=20,
        cursor=0,
        db=db,
        app_state=app_state,
    )

    if result.total == 0:
        # Fallback: relax all constraints except query
        fallback = run_explore(
            query=args.get("query", ""),
            rate_min=0.0,
            rate_max=10000.0,
            tags=[],
            limit=5,
            cursor=0,
            db=db,
            app_state=app_state,
        )
        if fallback.total == 0:
            fn_response = {"result": "zero_results", "fallback": "none"}
            filters_to_apply = {"reset": True}
        else:
            top = fallback.experts[:2]
            fn_response = {
                "result": "zero_results",
                "fallback_count": fallback.total,
                "fallback_examples": [
                    f"{e.first_name} {e.last_name} (${e.hourly_rate:.0f}/hr)"
                    for e in top
                ],
            }
            filters_to_apply = None  # Grid stays as-is per locked decision
    else:
        top = result.experts[:2]
        # Qualitative count — prevents Gemini narrating raw totals like "Found 530 experts"
        if result.total >= 100:
            count_label = "a lot of"
        elif result.total >= 20:
            count_label = "a solid number of"
        elif result.total >= 5:
            count_label = "a handful of"
        else:
            count_label = "a few"
        fn_response = {
            "result": "success",
            "result_size": count_label,
            "top_experts": [
                {
                    "name": f"{e.first_name} {e.last_name}",
                    "title": e.job_title,
                    "rate": f"${e.hourly_rate:.0f}/hr",
                }
                for e in top
            ],
        }
        # tags intentionally omitted — Sage uses semantic query for search, not tag chips
        filters_to_apply = {
            "query": args.get("query", ""),
            "rate_min": float(args.get("rate_min", 0.0)),
            "rate_max": float(args.get("rate_max", 10000.0)),
        }

    # Turn 2: send function result back → Gemini generates narration
    contents.append(response.candidates[0].content)
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_function_response(
            name="search_experts",
            response=fn_response,
        )]
    ))
    final = client.models.generate_content(
        model=GENERATION_MODEL, contents=contents, config=config
    )
    narration = final.text or "I found some experts matching your request — check the grid!"

    log.info(
        "pilot: search_experts executed",
        fn_name=fn_call.name,
        total=result.total,
        query=args.get("query", ""),
    )

    return {
        "filters": filters_to_apply,
        "message": narration,
        "search_performed": True,
        "total": result.total,
        "experts": [e.model_dump() for e in result.experts],
    }


def run_pilot(
    message: str,
    history: list[dict],
    current_filters: dict,
    db=None,        # SQLAlchemy Session — passed from pilot.py router
    app_state=None, # FastAPI app.state — FAISS index + metadata
) -> dict:
    """
    Two-turn Gemini function calling proxy for Sage.

    Args:
        message: Current user message.
        history: Prior conversation as list of {"role": "user"|"model", "content": str}.
                 IMPORTANT: role must be 'user' or 'model' (not 'assistant').
        current_filters: Active filter state {query, rate_min, rate_max, tags}.
        db: SQLAlchemy Session for search_experts live search.
        app_state: FastAPI app.state with FAISS index + metadata for search_experts.

    Returns:
        {"filters": dict | None, "message": str, "search_performed": bool, "total": int | None}
        - filters: function args if Gemini called a function, else None
        - message: Sage's natural language response
        - search_performed: True when search_experts was called
        - total: result count from search_experts (None for apply_filters)
    """
    client = _get_client()
    tool = types.Tool(function_declarations=[
        APPLY_FILTERS_DECLARATION,
        SEARCH_EXPERTS_DECLARATION,
    ])

    system_instruction = (
        "You are Sage — a sharp, warm, occasionally witty expert-finder. Think 'smart friend who knows everyone "
        "in the industry': you get things done fast, but you're genuinely fun to talk to. "
        "Use contractions naturally. Light humour when it fits — a wry aside, a playful observation. Never forced.\n\n"
        "Hard rules:\n"
        "- No filler affirmations: no 'Absolutely!', 'Great question!', 'Of course!', 'Certainly!', 'Sure thing!'\n"
        "- 2-3 sentences is your sweet spot. One if it's truly all that's needed; never more than 4.\n"
        "- You may ask at most ONE clarifying question per conversation. "
        "After any user reply — even vague — you MUST call a function. Never ask a second question.\n"
        "- Clarifying questions always offer 2-3 concrete options (not open-ended). "
        "Example: 'Are you after a hands-on consultant, a trainer, or a speaker?'\n\n"
        "Tools:\n"
        "- search_experts: use this whenever the user wants to find, discover, or explore experts. "
        "Pass their intent as a natural-language query — do NOT include tags, use plain description.\n"
        "- apply_filters: ONLY for narrowing what's already visible (e.g. 'cheaper options', 'under $200/hr'). "
        "Never use this for discovery.\n\n"
        "Narration after search_experts — be specific and human, no exact totals:\n"
        "- Many results: 'Pulled up a solid crew of {domain} folks — {Name1} ({title}) and {Name2} ({title}) are worth checking out. Grid's updated!'\n"
        "- Few results: 'Not a huge pool here, but {Name1} at ${rate}/hr looks promising. Updating the grid.'\n"
        "- Zero + fallback: acknowledge it didn't match exactly, name the closest alternative, stay upbeat\n"
        "- Zero, no fallback: 'Nothing matched that combo — resetting the grid so you can start fresh.'\n\n"
        "Never mention filter values, never explain what you're about to do, never quote exact result counts. "
        "Just search and narrate the outcome naturally.\n"
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

    # Turn 1: Attempt to extract function call (search_experts or apply_filters)
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
            "search_performed": False,
            "total": None,
        }

    if response.function_calls:
        fn_call = response.function_calls[0]
        args = dict(fn_call.args)  # unwrap protobuf Struct before use

        if fn_call.name == "search_experts":
            return _handle_search_experts(fn_call, args, response, contents, config, db, app_state, client)
        elif fn_call.name == "apply_filters":
            return _handle_apply_filters(fn_call, args, response, contents, config, client)
        else:
            # Unknown function — fall back to text
            confirmation = response.text or "I'm not sure how to help with that. Could you tell me more?"
            log.info("pilot: unknown function", fn_name=fn_call.name)
            return {
                "filters": None,
                "message": confirmation,
                "search_performed": False,
                "total": None,
            }
    else:
        # No function call — clarification, greeting, or unknown request
        confirmation = response.text or "I'm not sure what you're looking for. Could you tell me more about the type of expert you need?"

    log.info(
        "pilot: request processed",
        fn_name="none",
        has_filters=False,
        message_length=len(confirmation),
    )

    return {
        "filters": None,
        "message": confirmation,
        "search_performed": False,
        "total": None,
    }
