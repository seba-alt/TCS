"""
Explore endpoint TTL cache — module-level thread-safe dict cache.

Matches the existing project pattern (_embed_cache in embedder.py,
_settings_cache in search_intelligence.py). Explore results are cached
with a 5-minute TTL per user decisions (CONTEXT.md). Cache is invalidated
whenever experts are added, deleted, or re-ingested.
"""
import threading
import time
from typing import Any

_cache: dict[str, tuple[Any, float]] = {}
_cache_lock = threading.Lock()

EXPLORE_CACHE_TTL = 300.0  # 5 minutes (user decision in CONTEXT.md)
EXPLORE_CACHE_MAX_SIZE = 200


def get_cached(key: str) -> Any | None:
    """Return cached value if present and not expired, else None."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        value, ts = entry
        if time.time() - ts > EXPLORE_CACHE_TTL:
            del _cache[key]
            return None
        return value


def set_cached(key: str, value: Any) -> None:
    """Store value in cache, evicting oldest entry if at capacity."""
    with _cache_lock:
        if len(_cache) >= EXPLORE_CACHE_MAX_SIZE:
            oldest_key = min(_cache, key=lambda k: _cache[k][1])
            del _cache[oldest_key]
        _cache[key] = (value, time.time())


def invalidate_explore_cache() -> None:
    """Clear all cached explore results. Call after any expert mutation."""
    with _cache_lock:
        _cache.clear()
