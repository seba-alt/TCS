"""
Admin settings endpoints: GET /settings, POST /settings, POST /reset-data.
"""
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

import structlog

from app.database import get_db
from app.models import Conversation, EmailLead, Feedback, LeadClick, NewsletterSubscriber, UserEvent
from app.services.search_intelligence import invalidate_settings_cache

log = structlog.get_logger()

router = APIRouter()


SETTINGS_SCHEMA: dict[str, dict] = {
    "QUERY_EXPANSION_ENABLED": {
        "type": "bool",
        "description": "Enable HyDE query expansion for weak queries",
        "env_default": "false",
    },
    "FEEDBACK_LEARNING_ENABLED": {
        "type": "bool",
        "description": "Enable feedback-weighted re-ranking of search results",
        "env_default": "false",
    },
    "SIMILARITY_THRESHOLD": {
        "type": "float",
        "description": "Minimum FAISS score to consider a result strong (0.0-1.0)",
        "env_default": "0.60",
        "min": 0.0,
        "max": 1.0,
    },
    "STRONG_RESULT_MIN": {
        "type": "int",
        "description": "Minimum strong results before HyDE expansion fires (1-10)",
        "env_default": "3",
        "min": 1,
        "max": 10,
    },
    "FEEDBACK_BOOST_CAP": {
        "type": "float",
        "description": "Maximum feedback score multiplier offset (0.0-0.50)",
        "env_default": "0.20",
        "min": 0.0,
        "max": 0.50,
    },
}


class SettingUpdate(BaseModel):
    key: str
    value: str


def _validate_setting(key: str, value: str) -> None:
    """Raise HTTPException 400 if key is unknown or value is out of range."""
    if key not in SETTINGS_SCHEMA:
        valid_keys = ", ".join(SETTINGS_SCHEMA.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unknown setting key '{key}'. Valid keys: {valid_keys}",
        )
    schema = SETTINGS_SCHEMA[key]
    stype = schema["type"]
    try:
        if stype == "bool":
            if value.lower().strip() not in ("true", "false", "1", "0"):
                raise ValueError(f"must be true/false/1/0, got '{value}'")
        elif stype == "float":
            fval = float(value)
            if "min" in schema and fval < schema["min"]:
                raise ValueError(f"must be >= {schema['min']}, got {fval}")
            if "max" in schema and fval > schema["max"]:
                raise ValueError(f"must be <= {schema['max']}, got {fval}")
        elif stype == "int":
            ival = int(value)
            if "min" in schema and ival < schema["min"]:
                raise ValueError(f"must be >= {schema['min']}, got {ival}")
            if "max" in schema and ival > schema["max"]:
                raise ValueError(f"must be <= {schema['max']}, got {ival}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid value for '{key}': {exc}") from exc


def _coerce_value(key: str, raw: str):
    """Convert raw string DB value to native Python type for the response."""
    stype = SETTINGS_SCHEMA[key]["type"]
    if stype == "bool":
        return raw.lower().strip() in ("true", "1", "yes")
    if stype == "float":
        return float(raw)
    if stype == "int":
        return int(raw)
    return raw


@router.get("/settings")
def get_settings_endpoint(db: Session = Depends(get_db)):
    """Return all 5 intelligence settings with current value and source."""
    from app.models import AppSetting  # deferred import avoids circular import at startup

    db_rows = {row.key: row.value for row in db.scalars(select(AppSetting)).all()}
    result = []
    for key, schema in SETTINGS_SCHEMA.items():
        if key in db_rows:
            raw = db_rows[key]
            source = "db"
        elif os.getenv(key) is not None:
            raw = os.environ[key]
            source = "env"
        else:
            raw = schema["env_default"]
            source = "default"
        entry: dict = {
            "key": key,
            "value": _coerce_value(key, raw),
            "raw": raw,
            "source": source,
            "type": schema["type"],
            "description": schema["description"],
        }
        if "min" in schema:
            entry["min"] = schema["min"]
        if "max" in schema:
            entry["max"] = schema["max"]
        result.append(entry)
    return {"settings": result}


@router.post("/settings")
def update_setting(body: SettingUpdate, db: Session = Depends(get_db)):
    """Write or overwrite a single setting in the DB."""
    from app.models import AppSetting  # deferred import
    import datetime as _dt

    _validate_setting(body.key, body.value)

    setting = db.merge(AppSetting(
        key=body.key,
        value=body.value,
        updated_at=_dt.datetime.utcnow(),
    ))
    db.commit()
    db.refresh(setting)

    # Phase 56: invalidate settings cache so the change takes effect immediately
    invalidate_settings_cache()

    log.info("admin.settings.updated", key=body.key, value=body.value)
    return {
        "key": setting.key,
        "value": _coerce_value(setting.key, setting.value),
        "raw": setting.value,
        "source": "db",
        "updated_at": setting.updated_at.isoformat(),
    }


@router.post("/reset-data")
def reset_data(db: Session = Depends(get_db)):
    """Truncate all search/usage data tables."""
    counts = {}
    for model in [Feedback, Conversation, EmailLead, NewsletterSubscriber, UserEvent, LeadClick]:
        count = db.query(model).count()
        db.query(model).delete()
        counts[model.__tablename__] = count
    db.commit()
    log.info("admin.reset_data", deleted=counts)
    return {"ok": True, "deleted": counts}
