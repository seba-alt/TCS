# Phase 41: Expert Email Purge - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove expert email data from all data stores (SQLite DB, CSV file) and prevent re-introduction via future imports. Only Expert.email is targeted — user-consented lead captures (Conversation.email, Feedback.email) are explicitly preserved. This is a backend-only data cleanup with no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Column fate
- Blank all Expert.email values via `UPDATE experts SET email = ''` — no DROP COLUMN (avoids Railway SQLite DDL risk)
- Remove the Email column entirely from data/experts.csv (not just blank values — remove the header and column)
- Run the UPDATE as an idempotent migration in the existing main.py lifespan pattern (safe on repeated startups)

### Import behavior
- CSV import endpoint (`POST /api/admin/experts/import-csv`) silently ignores the Email field — no error, no warning, email value is simply never written to Expert.email
- Single-expert add endpoint (`POST /api/admin/experts`) already doesn't accept email — no changes needed

### Purge scope
- ONLY Expert.email is purged
- Conversation.email (lead captures from newsletter gate) stays — powers admin Leads page
- Feedback.email (thumbs up/down attribution) stays — powers feedback tracking
- Admin Leads page must continue functioning normally after purge

### Seed logic
- Update the CSV seed code in main.py to not expect or read an Email column from experts.csv
- CSV write logic in admin.py (expert add/import endpoints that append to experts.csv) must also stop writing Email

### Claude's Discretion
- Whether to keep or remove the `email` field from the SQLAlchemy Expert model class (choose what's cleanest given the UPDATE-not-DROP approach)
- Order of operations for the migration (DB update vs CSV strip vs code changes)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — straightforward data cleanup. The key constraint is safety: Railway must not crash on the migration, and the admin Leads page must keep working.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-expert-email-purge*
*Context gathered: 2026-02-26*
