---
phase: 45-security-and-infrastructure-hardening
plan: 01
subsystem: auth
tags: [jwt, bcrypt, slowapi, rate-limiting, fastapi, react]

requires:
  - phase: 44-mobile-filter-redesign
    provides: working admin panel with single-key auth
provides:
  - bcrypt+JWT admin authentication replacing single shared key
  - slowapi rate limiting on login endpoint (5/minute)
  - frontend username/password login form with JWT session management
  - 401 auto-redirect to login on expired tokens
affects: [admin-features, admin-cleanup]

tech-stack:
  added: [pyjwt, pwdlib-bcrypt, slowapi]
  patterns: [JWT Bearer auth, bcrypt password hashing, rate limiting middleware]

key-files:
  created: [app/limiter.py]
  modified: [requirements.txt, app/models.py, app/routers/admin.py, app/main.py, frontend/src/admin/LoginPage.tsx, frontend/src/admin/RequireAuth.tsx, frontend/src/admin/hooks/useAdminData.ts, frontend/src/admin/AdminApp.tsx, frontend/src/admin/pages/SettingsPage.tsx, frontend/src/admin/pages/AdminMarketplacePage.tsx, frontend/src/admin/pages/LeadsPage.tsx, frontend/src/admin/components/GapsTable.tsx, frontend/src/admin/hooks/useAdminExport.ts]

key-decisions:
  - "Used pwdlib[bcrypt] with explicit BcryptHasher instead of PasswordHash.recommended() which defaults to Argon2"
  - "JWT tokens expire after 24 hours; sessionStorage clears on tab close as additional safety net"
  - "Admin user seeded from ADMIN_USERNAME + ADMIN_PASSWORD env vars on first boot (zero manual DB setup)"
  - "All frontend files updated to use Bearer token — no dual-mode transition period"

patterns-established:
  - "JWT auth: Authorization: Bearer <token> on all admin endpoints"
  - "Rate limiting: slowapi Limiter singleton in app/limiter.py, registered on app.state"
  - "Admin seeding: env vars ADMIN_USERNAME + ADMIN_PASSWORD + JWT_SECRET required in production"

requirements-completed: [SEC-01, SEC-02]

duration: 12min
completed: 2026-02-27
---

# Plan 45-01: Admin Auth Upgrade Summary

**Bcrypt+JWT admin authentication with slowapi rate limiting, replacing insecure single shared key across backend and frontend**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-27
- **Completed:** 2026-02-27
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Replaced single admin key with bcrypt-hashed password + JWT token authentication
- Added slowapi rate limiting (5 attempts/minute) on the login endpoint
- Migrated all frontend admin API calls from X-Admin-Key to Authorization: Bearer
- Added 401 auto-redirect to login page for expired token handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend auth upgrade** - `e7ebe1a` (feat)
2. **Task 2: Frontend auth migration** - `6d3eb19` (feat)

## Files Created/Modified
- `app/limiter.py` - Shared slowapi Limiter singleton
- `app/models.py` - Added AdminUser model with username + hashed_password
- `app/routers/admin.py` - JWT-based auth endpoint, _require_admin dependency
- `app/main.py` - Rate limiter setup, CORS Authorization header, admin user seeding
- `requirements.txt` - Added pyjwt, pwdlib[bcrypt], slowapi
- `frontend/src/admin/LoginPage.tsx` - Username + password form
- `frontend/src/admin/RequireAuth.tsx` - Checks admin_token
- `frontend/src/admin/hooks/useAdminData.ts` - Bearer token headers, 401 handling
- `frontend/src/admin/AdminApp.tsx` - Logout clears admin_token
- `frontend/src/admin/pages/SettingsPage.tsx` - Session token reference
- `frontend/src/admin/pages/AdminMarketplacePage.tsx` - Bearer token headers
- `frontend/src/admin/pages/LeadsPage.tsx` - Bearer token headers
- `frontend/src/admin/components/GapsTable.tsx` - Bearer token headers
- `frontend/src/admin/hooks/useAdminExport.ts` - Bearer token headers

## Decisions Made
- Used explicit BcryptHasher per SEC-01 requirement (not Argon2 default)
- No dual-mode transition — all files switched atomically
- Generic "Invalid credentials" error message for both wrong username and wrong password

## Deviations from Plan

### Auto-fixed Issues

**1. Additional frontend files needed auth migration**
- **Found during:** Task 2 verification
- **Issue:** Plan specified 3 frontend files but 6 additional files also referenced old auth pattern
- **Fix:** Updated AdminApp.tsx, SettingsPage.tsx, AdminMarketplacePage.tsx, LeadsPage.tsx, GapsTable.tsx, useAdminExport.ts
- **Verification:** Grep for admin_key and X-Admin-Key returns zero matches (except intentional cleanup line)
- **Committed in:** `6d3eb19`

---

**Total deviations:** 1 auto-fixed (additional files requiring migration)
**Impact on plan:** Essential for correctness — leaving old auth references would break those admin pages.

## Issues Encountered
None

## User Setup Required

The following environment variables must be set in Railway before deployment:
- `JWT_SECRET` - Secret key for signing JWT tokens (any random 32+ character string)
- `ADMIN_USERNAME` - Admin login username
- `ADMIN_PASSWORD` - Admin login password (will be bcrypt-hashed on first boot)

## Next Phase Readiness
- Auth foundation upgraded, ready for remaining v4.0 phases
- Phase 48 (Admin Features) can build on the JWT auth pattern

---
*Phase: 45-security-and-infrastructure-hardening*
*Completed: 2026-02-27*
