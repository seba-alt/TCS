# Phase 11: Backend Settings API - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Store search intelligence flags and numeric thresholds in a SQLite `settings` table, read at runtime by the backend, with Railway env vars as fallback — so HyDE and feedback re-ranking can be toggled or tuned without any Railway redeploy. Exposes `GET /api/admin/settings` and `POST /api/admin/settings` admin endpoints. Frontend settings UI is a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Validation & error handling
- Out-of-range values return HTTP 400 with a short, clear error message (no 422, no silent clamping)
- Boolean flags accept `true`/`false` (JSON), `"true"`/`"false"` (strings), and `1`/`0` interchangeably
- Whether to reject unknown keys is **Claude's discretion** — pick the safer option for an admin API

### POST request shape
- Whether to accept a single key-value pair vs a batch is **Claude's discretion** — pick the most practical design for an admin panel

### Source field semantics
- When a DB row exists, `source` is `"db"` regardless of whether an env var is also set (DB always wins)
- All source field labeling details (e.g. `"db"` vs `"db_override"` vs `"env"` vs `"default"`) are **Claude's discretion**
- Whether to show `default_value` alongside the active value in the response is **Claude's discretion**

### Reset / revert behavior
- No reset mechanism in this phase — skip entirely; can be added later if needed

### Key naming & schema
- Key naming convention (SCREAMING_SNAKE_CASE vs snake_case) is **Claude's discretion** — use whatever is most consistent with existing codebase conventions
- API response types (native types vs strings) are **Claude's discretion** — pick the most useful format for the frontend
- Whether to include metadata (description, type, range) per key in the GET response is **Claude's discretion** — decide based on what's most useful for building a settings UI later
- Always expose all 5 settings in every GET response — predictable, easy to build UI against

### Claude's Discretion
- Unknown key rejection vs allow-arbitrary-keys
- Single vs batch POST body shape
- Source field label values ("db", "env", "default", "db_override", etc.)
- Whether GET includes `default_value` field
- Key naming convention (match env vars or lowercase)
- Response value types (native vs string)
- Whether GET includes per-key metadata (description, type, range)

</decisions>

<specifics>
## Specific Ideas

- The 5 specific settings are: `QUERY_EXPANSION_ENABLED`, `FEEDBACK_LEARNING_ENABLED`, similarity threshold, HyDE trigger sensitivity, and feedback boost cap
- "Toggling a flag via POST causes the next chat request to use the updated value" — settings must be read on every request, not cached across requests

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-backend-settings-api*
*Context gathered: 2026-02-21*
