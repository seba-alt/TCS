"""
Admin router package — assembles sub-module routers into auth_router + router.

main.py imports:
    from app.routers import admin
    app.include_router(admin.auth_router)
    app.include_router(admin.router)
    admin._auto_categorize(...)
"""
from app.routers.admin._common import auth_router, router, _auto_categorize  # noqa: F401

from app.routers.admin import analytics
from app.routers.admin import events
from app.routers.admin import experts
from app.routers.admin import exports
from app.routers.admin import leads
from app.routers.admin import settings

router.include_router(analytics.router)
router.include_router(events.router)
router.include_router(experts.router)
router.include_router(exports.router)
router.include_router(leads.router)
router.include_router(settings.router)
