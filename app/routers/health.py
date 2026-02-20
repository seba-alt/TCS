"""
Health check endpoint.

GET /api/health → {"status": "ok", "index_size": <int>}

index_size is the number of expert vectors loaded in the FAISS index.
A non-zero index_size confirms the FAISS index loaded successfully at startup.
"""
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/api/health")
async def health(request: Request) -> dict:
    index = request.app.state.faiss_index
    return {
        "status": "ok",
        "index_size": index.ntotal,
    }
