"""
POST /api/pilot — Sage co-pilot endpoint.

Receives user message + conversation history + current filter state.
Uses Gemini function calling (two-turn) to:
1. Extract apply_filters args from natural language
2. Generate Sage's confirmation response

Returns:
    {"filters": dict | null, "message": str}
    - filters: apply_filters args if filter intent detected, else null
    - message: Sage's natural language response to display in chat
"""
import asyncio
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.pilot_service import run_pilot

router = APIRouter()


class HistoryItem(BaseModel):
    role: Literal["user", "model"]  # Gemini roles — 'model' not 'assistant'
    content: str


class PilotRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryItem] = Field(default_factory=list)
    current_filters: dict = Field(default_factory=dict)


class PilotResponse(BaseModel):
    filters: dict | None  # apply_filters args, or null if no filter change
    message: str          # Sage's natural language response


@router.post("/api/pilot", response_model=PilotResponse)
async def pilot(body: PilotRequest) -> PilotResponse:
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
        ),
    )
    return PilotResponse(**result)
