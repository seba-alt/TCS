"""
Shared asyncio event queue for fire-and-forget event writing.

Imported by both app/routers/events.py (enqueue) and app/main.py (flush worker).
Kept in its own module to avoid circular imports between main.py and events.py.
"""
import asyncio

_event_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
