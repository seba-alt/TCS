"""
Admin Search Lab A/B compare endpoint: POST /compare.
"""
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.services.retriever import retrieve
from app.services.search_intelligence import (
    get_settings,
    _is_weak_query,
    _generate_hypothetical_bio,
    _blend_embeddings,
    _search_with_vector,
    _merge_candidates,
    _apply_feedback_boost,
)

router = APIRouter()


# ── Search Lab A/B Compare ────────────────────────────────────────────────────

_LAB_CONFIGS = {
    "explore_baseline": {"pipeline": "run_explore"},
    "explore_full":     {"pipeline": "run_explore"},
    "legacy_baseline":  {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": False},
    "legacy_hyde":      {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": False},
    "legacy_feedback":  {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": True},
    "legacy_full":      {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": True},
    "baseline": {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": False},
    "hyde":     {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": False},
    "feedback": {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": True},
    "full":     {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": True},
}

_LAB_LABELS = {
    "explore_baseline": "Explore (Baseline)",
    "explore_full":     "Explore (Full)",
    "legacy_baseline":  "Legacy Baseline",
    "legacy_hyde":      "Legacy HyDE Only",
    "legacy_feedback":  "Legacy Feedback Only",
    "legacy_full":      "Legacy Full Intelligence",
    "baseline": "Legacy Baseline",
    "hyde":     "Legacy HyDE Only",
    "feedback": "Legacy Feedback Only",
    "full":     "Legacy Full Intelligence",
}


class CompareRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    configs: list[str] = Field(
        default=["explore_baseline", "explore_full", "legacy_baseline", "legacy_full"],
    )
    result_count: int = Field(default=20, ge=1, le=50)
    overrides: dict[str, bool] = Field(default_factory=dict)


def _retrieve_for_lab(query, faiss_index, metadata, db, config_flags, result_count):
    settings = get_settings(db)
    settings.update(config_flags)
    candidates = retrieve(query, faiss_index, metadata)
    intelligence = {"hyde_triggered": False, "hyde_bio": None, "feedback_applied": False}

    if settings["QUERY_EXPANSION_ENABLED"] and _is_weak_query(
        candidates, settings["STRONG_RESULT_MIN"], settings["SIMILARITY_THRESHOLD"]
    ):
        bio = _generate_hypothetical_bio(query)
        if bio is not None:
            from app.services.embedder import embed_query  # noqa: PLC0415
            original_vec = embed_query(query)
            blended_vec = _blend_embeddings(original_vec, bio)
            hyde_candidates = _search_with_vector(blended_vec, faiss_index, metadata)
            candidates = _merge_candidates(candidates, hyde_candidates)
            intelligence["hyde_triggered"] = True
            intelligence["hyde_bio"] = bio

    if settings["FEEDBACK_LEARNING_ENABLED"]:
        candidates = _apply_feedback_boost(candidates, db, settings["FEEDBACK_BOOST_CAP"])
        intelligence["feedback_applied"] = True

    return candidates[:result_count], intelligence


def _explore_for_lab(query, db, app_state, result_count):
    from app.services.explorer import run_explore as _run_explore
    result = _run_explore(
        query=query, rate_min=0.0, rate_max=10000.0, tags=[], limit=result_count,
        cursor=0, db=db, app_state=app_state, industry_tags=[],
    )
    experts = [
        {"rank": i + 1, "name": f"{e.first_name} {e.last_name}", "title": e.job_title,
         "score": round(e.final_score, 4), "profile_url": getattr(e, 'profile_url', None)}
        for i, e in enumerate(result.experts)
    ]
    intelligence = {"hyde_triggered": False, "hyde_bio": None, "feedback_applied": True, "pipeline": "run_explore"}
    return experts, intelligence


@router.post("/compare")
def compare_configs(body: CompareRequest, request: Request, db: Session = Depends(get_db)):
    """Run a query through multiple pipeline configs in parallel."""
    unknown = [c for c in body.configs if c not in _LAB_CONFIGS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown config(s): {unknown}. Valid: {list(_LAB_CONFIGS.keys())}")

    faiss_index = request.app.state.faiss_index
    metadata = request.app.state.metadata
    app_state = request.app.state

    config_flag_pairs = [(name, {**_LAB_CONFIGS[name]}) for name in body.configs]

    def _run_one(args):
        name, flags = args
        pipeline = flags.get("pipeline", "legacy")
        thread_db = SessionLocal()
        try:
            if pipeline == "run_explore":
                experts, intelligence = _explore_for_lab(body.query, thread_db, app_state, body.result_count)
                return name, experts, intelligence
            else:
                config_flags = {k: v for k, v in flags.items() if k != "pipeline"}
                config_flags.update(body.overrides)
                candidates, intelligence = _retrieve_for_lab(
                    body.query, faiss_index, metadata, thread_db, config_flags, body.result_count
                )
                intelligence["pipeline"] = "legacy"
                return name, candidates, intelligence
        finally:
            thread_db.close()

    with ThreadPoolExecutor(max_workers=len(config_flag_pairs)) as executor:
        results = list(executor.map(_run_one, config_flag_pairs))

    columns = []
    for name, result_data, intelligence in results:
        pipeline = intelligence.get("pipeline", "legacy")
        if pipeline == "run_explore":
            experts_serialized = result_data
        else:
            experts_serialized = [
                {"rank": i + 1, "name": c.name, "title": c.title, "score": round(c.score, 4), "profile_url": c.profile_url}
                for i, c in enumerate(result_data)
            ]
        columns.append({
            "config": name, "label": _LAB_LABELS.get(name, name), "pipeline": pipeline,
            "experts": experts_serialized, "intelligence": intelligence,
        })

    return {"columns": columns, "query": body.query, "overrides_applied": body.overrides}
