"""
POST /api/chat — SSE streaming expert recommendation endpoint.

SSE event stream format:
    data: {"event": "status", "status": "thinking"}\n\n
    data: {"event": "result", "type": "...", "narrative": "...", "experts": [...]}\n\n
    data: {"event": "done"}\n\n

On error during generation:
    data: {"event": "error", "message": "..."}\n\n
    data: {"event": "done"}\n\n

Request body:
    email (str, required): User email — API enforces presence (lead capture).
    query (str, required): Natural language problem description.
    history (list[dict], optional): Prior turns [{role, content}] for multi-turn context.

Error responses (before streaming starts):
    422: Missing or invalid email/query (Pydantic validation runs synchronously)
"""
import asyncio
import json

import structlog
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation
from app.services.llm import generate_response
from app.services.retriever import retrieve

log = structlog.get_logger()
router = APIRouter()


class HistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    email: EmailStr
    query: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryItem] = Field(default_factory=list)


def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


async def _stream_chat(body: ChatRequest, request: Request, db: Session):
    """
    Async generator yielding SSE events.

    Event sequence:
    1. status=thinking (immediate — before any LLM call)
    2. result (complete JSON payload after generation)
    3. done (signals stream end to client)
    """
    # Event 1: thinking — emit immediately so frontend shows loading state
    yield _sse({"event": "status", "status": "thinking"})

    # Run retrieval + generation in a thread pool to avoid blocking the event loop
    # (embed_query and generate_content are synchronous calls)
    loop = asyncio.get_event_loop()

    try:
        # Retrieve candidates (sync — run in thread pool)
        history_dicts = [{"role": h.role, "content": h.content} for h in body.history]
        candidates = await loop.run_in_executor(
            None,
            lambda: retrieve(
                query=body.query,
                faiss_index=request.app.state.faiss_index,
                metadata=request.app.state.metadata,
            ),
        )
        log.info("chat.retrieved", candidate_count=len(candidates))

        # Generate response (sync — run in thread pool; has internal retry logic)
        llm_response = await loop.run_in_executor(
            None,
            lambda: generate_response(
                query=body.query,
                candidates=candidates,
                history=history_dicts,
            ),
        )
        log.info("chat.generated", type=llm_response.type, expert_count=len(llm_response.experts))

        # Build experts payload (shared for DB log and SSE event)
        experts_payload = [
            {
                "name": e.name,
                "title": e.title,
                "company": e.company,
                "hourly_rate": e.hourly_rate,
                "profile_url": e.profile_url,
                "why_them": e.why_them,
            }
            for e in llm_response.experts
        ]

        # Log conversation to DB
        conversation = Conversation(
            email=str(body.email),
            query=body.query,
            history=json.dumps(history_dicts),
            response_type=llm_response.type,
            response_narrative=llm_response.narrative,
            response_experts=json.dumps(experts_payload),
        )
        db.add(conversation)
        db.commit()
        log.info("chat.logged", conversation_id=conversation.id)
        yield _sse({
            "event": "result",
            "type": llm_response.type,
            "narrative": llm_response.narrative,
            "experts": experts_payload,
            "conversation_id": conversation.id,
        })

    except Exception as exc:
        log.error("chat.stream_error", error=str(exc))
        yield _sse({"event": "error", "message": "Failed to generate response. Please try again."})

    finally:
        # Event 3: done — always emitted to signal stream end
        yield _sse({"event": "done"})


@router.post("/api/chat")
async def chat(
    body: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """
    Stream expert recommendations as Server-Sent Events.

    Pydantic validation (email, query) runs synchronously before streaming begins —
    invalid requests return 422 before any SSE events are emitted.
    """
    return StreamingResponse(
        _stream_chat(body, request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering (Railway uses nginx proxy)
        },
    )
