"""
POST /api/pilot — Sage co-pilot endpoint.

Receives user message + conversation history + current filter state.
Uses Gemini function calling (two-turn) to:
1. Extract apply_filters or search_experts args from natural language
2. Generate Sage's confirmation/narration response

Returns:
    {"filters": dict | null, "message": str, "search_performed": bool, "total": int | null}
    - filters: function args if filter/search intent detected, else null
    - message: Sage's natural language response to display in chat
    - search_performed: true when search_experts was called
    - total: result count from search_experts (None for apply_filters)
"""
import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.pilot_service import run_pilot

router = APIRouter()


class HistoryItem(BaseModel):
    role: Literal["user", "model"]  # Gemini roles — 'model' not 'assistant'
    content: str


class PilotRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryItem] = Field(default_factory=list)
    current_filters: dict = Field(default_factory=dict)
    email: str | None = Field(default=None, max_length=320)


class PilotResponse(BaseModel):
    filters: dict | None           # apply_filters/search_experts args, or null if no filter change
    message: str                   # Sage's natural language response
    search_performed: bool = False  # true when search_experts was called
    total: int | None = None        # result count from search_experts
    experts: list[dict] | None = None  # reserved (not rendered — narration is text-only)


@router.post("/api/pilot", response_model=PilotResponse)
async def pilot(
    body: PilotRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> PilotResponse:
    """
    Sage co-pilot endpoint — thin async wrapper around pilot_service.run_pilot().
    Offloads synchronous Gemini call to thread pool (same pattern as explore.py).
    """
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_pilot(
            message=body.message,
            history=[h.model_dump() for h in body.history],
            current_filters=body.current_filters,
            email=body.email,
            db=db,
            app_state=request.app.state,
        ),
    )
    return PilotResponse(**result)
