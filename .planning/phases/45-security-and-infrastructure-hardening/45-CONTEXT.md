# Phase 45: Security and Infrastructure Hardening - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade admin authentication from single-key to bcrypt+JWT username/password, add rate limiting on login, enable SQLite WAL mode for concurrent traffic, and fix the t-SNE heatmap loading spinner. No new admin features — purely hardening existing infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Auth migration
- Instant cutover — old single-key auth stops working immediately once new auth is deployed
- No dual-mode transition period; admin logs in with new credentials from day one
- Single admin account only — no multi-admin schema needed
- Initial credentials seeded from env vars (ADMIN_USERNAME, ADMIN_PASSWORD) on Railway
- App creates the admin account on first boot if it doesn't exist
- Password changes only via updating the env var and redeploying — no UI password change

### Login form experience
- Keep existing login page design, swap single key field for username + password fields
- Session lasts until browser tab closes (no persistent sessions, no remember-me)
- Failed login shows generic "Invalid credentials" message — doesn't reveal whether username or password was wrong
- Rate limiting: 5 failed attempts per IP per minute triggers rejection (from success criteria)

### Claude's Discretion
- JWT token storage strategy (sessionStorage vs httpOnly cookie) — pick based on security/simplicity tradeoff
- JWT expiration timing (should align with session-until-tab-close preference)
- Rate limiting implementation details (slowapi configuration)
- WAL mode enablement approach
- t-SNE heatmap fix approach

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-security-and-infrastructure-hardening*
*Context gathered: 2026-02-27*
