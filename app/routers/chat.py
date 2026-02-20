"""
POST /api/chat — non-streaming expert recommendation endpoint.

Request body:
    email (str, required): User's email address. API enforces presence — lead capture requirement.
    query (str, required): Natural language problem description.
    history (list[dict], optional): Prior conversation turns for multi-turn context.
                                    Each item: {"role": "user"|"assistant", "content": str}

Response body (200 OK):
    {
        "type": "match" | "clarification",
        "narrative": "...",
        "experts": [
            {"name": ..., "title": ..., "company": ..., "hourly_rate": ..., "profile_url": ...},
            ...  # exactly 3 for type="match", empty list for type="clarification"
        ]
    }

Error responses:
    422: Missing email or query (Pydantic validation)
    500: Gemini generation failure after all retries exhausted
"""
import json

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation
from app.services.llm import Expert, generate_response
from app.services.retriever import retrieve

log = structlog.get_logger()
router = APIRouter()


class HistoryItem(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    email: EmailStr  # Pydantic validates email format; returns 422 if missing or malformed
    query: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryItem] = Field(default_factory=list)


class ExpertOut(BaseModel):
    name: str
    title: str
    company: str
    hourly_rate: str
    profile_url: str | None


class ChatResponse(BaseModel):
    type: str
    narrative: str
    experts: list[ExpertOut]


@router.post("/api/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    Accept a user query, retrieve matched experts via FAISS, generate recommendations
    via Gemini, log the conversation, and return the structured response.
    """
    log.info("chat.request", email=body.email, query_length=len(body.query))

    # 1. Retrieve expert candidates from FAISS
    candidates = retrieve(
        query=body.query,
        faiss_index=request.app.state.faiss_index,
        metadata=request.app.state.metadata,
    )
    log.info("chat.retrieved", candidate_count=len(candidates))

    # 2. Generate response via Gemini (with retry on failure)
    history_dicts = [{"role": h.role, "content": h.content} for h in body.history]
    try:
        llm_response = generate_response(
            query=body.query,
            candidates=candidates,
            history=history_dicts,
        )
    except RuntimeError as exc:
        log.error("chat.llm_failure", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to generate response. Please try again.")

    # 3. Log conversation to database (lead capture + analytics requirement)
    conversation = Conversation(
        email=str(body.email),
        query=body.query,
        history=json.dumps(history_dicts),
        response_type=llm_response.type,
        response_narrative=llm_response.narrative,
        response_experts=json.dumps(
            [
                {
                    "name": e.name,
                    "title": e.title,
                    "company": e.company,
                    "hourly_rate": e.hourly_rate,
                    "profile_url": e.profile_url,
                }
                for e in llm_response.experts
            ]
        ),
    )
    db.add(conversation)
    db.commit()
    log.info("chat.logged", conversation_id=conversation.id)

    # 4. Build and return response
    experts_out = [
        ExpertOut(
            name=e.name,
            title=e.title,
            company=e.company,
            hourly_rate=e.hourly_rate,
            profile_url=e.profile_url,
        )
        for e in llm_response.experts
    ]

    return ChatResponse(
        type=llm_response.type,
        narrative=llm_response.narrative,
        experts=experts_out,
    )
