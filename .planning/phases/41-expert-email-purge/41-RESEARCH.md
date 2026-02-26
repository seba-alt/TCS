# Phase 41: Expert Email Purge - Research

**Researched:** 2026-02-26
**Domain:** SQLite data migration, CSV file manipulation, FastAPI lifespan pattern
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Column fate**: Blank all Expert.email values via `UPDATE experts SET email = ''` — no DROP COLUMN (avoids Railway SQLite DDL risk)
- **Column fate**: Remove the Email column entirely from data/experts.csv (not just blank values — remove the header and column)
- **Migration style**: Run the UPDATE as an idempotent migration in the existing main.py lifespan pattern (safe on repeated startups)
- **Import behavior**: CSV import endpoint (`POST /api/admin/experts/import-csv`) silently ignores the Email field — no error, no warning, email value is simply never written to Expert.email
- **Single-expert add**: `POST /api/admin/experts` already doesn't accept email — no changes needed
- **Purge scope**: ONLY Expert.email is purged; Conversation.email and Feedback.email stay untouched
- **Seed logic**: Update CSV seed code in main.py to not expect or read an Email column from experts.csv
- **CSV write logic**: admin.py expert add/import endpoints that append to experts.csv must also stop writing Email

### Claude's Discretion

- Whether to keep or remove the `email` field from the SQLAlchemy Expert model class (choose what's cleanest given the UPDATE-not-DROP approach)
- Order of operations for the migration (DB update vs CSV strip vs code changes)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRIV-01 | Expert email data purged from SQLite database (all Expert.email set to empty string) | Lifespan migration pattern already used for ADD COLUMN; same pattern applies for UPDATE |
| PRIV-02 | Email column stripped from data/experts.csv | Python csv module rewrites the file without the Email column |
| PRIV-03 | CSV import endpoint ignores Email field on future uploads (no longer written to DB) | Single line deletion in import-csv and add_expert CSV-write code paths |
</phase_requirements>

## Summary

Phase 41 is a targeted data cleanup with three distinct sub-tasks: blank 1,558 Expert.email values in SQLite, strip the Email column from experts.csv (1,610 rows), and close the import re-introduction vector permanently. All three are backend-only changes with zero frontend impact.

The SQLite operation is a plain `UPDATE experts SET email = ''` run as an idempotent migration in the existing `lifespan()` function in `app/main.py`. The project already has a well-established pattern for this — six `ALTER TABLE` blocks are already handled in the same try/except idempotency style. The email purge UPDATE follows the same lifecycle slot.

The CSV rewrite requires reading experts.csv, dropping the Email column, and writing the file back without it. Python's `csv.DictReader`/`csv.DictWriter` is sufficient and is already the module used everywhere in the codebase. The import guard in `import-csv` is a one-line deletion (remove `existing.email = ...` and the `email=(row.get("Email") ...)` assignments). The `add_expert` CSV-append code includes `"Email": ""` in its fieldnames and row dict — both need to be dropped.

**Primary recommendation:** Three focused surgical edits to main.py, admin.py, and a one-time CSV rewrite script run locally. No new dependencies. No library research required. This is pure codebase surgery.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python csv (stdlib) | stdlib | Read/write experts.csv | Already used throughout admin.py and main.py |
| SQLAlchemy (text) | already installed | Run raw UPDATE via `engine.connect()` | Pattern already used for ADD COLUMN migrations in lifespan() |
| SQLite | already deployed | Target database | The DB being modified |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pathlib.Path | stdlib | Locate experts.csv | Already used as EXPERTS_CSV_PATH |
| io.StringIO | stdlib | In-memory CSV buffer for rewrite | Standard pattern in admin.py CSV export endpoints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual CSV rewrite in Python | pandas | pandas is overkill; stdlib csv is already the project standard and available |
| Alembic migration | Plain SQLAlchemy text() | Alembic is explicitly out of scope per REQUIREMENTS.md |
| DROP COLUMN | UPDATE SET email = '' | DROP COLUMN is risky on Railway SQLite — user decided against it |

**Installation:** No new packages needed.

## Architecture Patterns

### Existing Migration Pattern (HIGH confidence — verified in main.py)

The lifespan function in `app/main.py` already performs idempotent schema migrations using try/except blocks:

```python
# Source: app/main.py lines 191-205
with engine.connect() as _conn:
    for _col_ddl in [
        "ALTER TABLE conversations ADD COLUMN top_match_score REAL",
        # ... more DDL ...
    ]:
        try:
            _conn.execute(_text(_col_ddl))
            _conn.commit()
        except Exception:
            pass  # Column already exists — idempotent
```

The email purge UPDATE fits a different slot: it must run AFTER `Base.metadata.create_all()` (so the table exists) but is a DML statement, not DDL — no try/except needed because `UPDATE ... SET email = ''` is always safe to re-run (already-blank values stay blank). It can go in the same lifespan block, right after the existing ADD COLUMN migrations.

### Pattern 1: Idempotent DML Migration in Lifespan

**What:** Run `UPDATE experts SET email = ''` unconditionally on every startup.
**When to use:** DML updates where the target state is idempotent (setting to empty string is always safe to repeat).
**Example:**
```python
# In app/main.py lifespan(), after existing ALTER TABLE blocks
with engine.connect() as _conn:
    _conn.execute(_text("UPDATE experts SET email = ''"))
    _conn.commit()
log.info("startup: expert email purge applied")
```

This runs on every startup, which is fine — on subsequent startups all emails are already '' and the UPDATE affects 0 rows (no-op).

### Pattern 2: CSV Column Strip with DictReader/DictWriter

**What:** Read CSV, exclude the Email column from fieldnames, write back.
**When to use:** Removing a column from a CSV file.
**Example:**
```python
import csv, io
from pathlib import Path

csv_path = Path("data/experts.csv")
with open(csv_path, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    original_fieldnames = reader.fieldnames or []

new_fieldnames = [fn for fn in original_fieldnames if fn != "Email"]

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=new_fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
```

`extrasaction="ignore"` tells DictWriter to silently drop the Email key from each row dict without raising an error.

### Pattern 3: Silent Ignore in Import Endpoint

**What:** Remove the lines that write email to Expert from the import-csv endpoint.
**When to use:** Preventing a field from being stored while remaining backward-compatible with CSVs that include it.

Current code in `import_experts_csv` (admin.py line 1035) to delete:
```python
# DELETE this line from the "if existing:" branch:
existing.email = (row.get("Email") or "").strip()

# DELETE this from the "else:" branch (Expert(...) constructor):
email=(row.get("Email") or "").strip(),
```

The CSV column being present in an uploaded file is harmless — `row.get("Email")` just goes unread.

### Pattern 4: CSV Append in add_expert — Remove Email Field

Current fieldnames list in `add_expert` (admin.py line 969–973):
```python
fieldnames = [
    "Email", "Username", "First Name", "Last Name", "Job Title",
    "Company", "Bio", "Hourly Rate", "Currency", "Profile URL",
    "Profile URL with UTM", "Profile Image Url", "Created At",
]
```

And the row dict includes `"Email": ""`. Both must drop "Email":
```python
fieldnames = [
    "Username", "First Name", "Last Name", "Job Title",
    "Company", "Bio", "Hourly Rate", "Currency", "Profile URL",
    "Profile URL with UTM", "Profile Image Url", "Created At",
]
# And remove "Email": "" from the writer.writerow({...}) dict
```

### Anti-Patterns to Avoid

- **DROP COLUMN in SQLite**: SQLite pre-3.35 does not support DROP COLUMN. Railway's SQLite version is unknown; the user explicitly decided against it. Do not use.
- **Removing Expert.email from the SQLAlchemy model class**: The `email` column still exists in the DB schema (no DROP). Keeping the model field is consistent — it just always has the value `""`. Removing it from the model would create a mismatch and require a schema migration to actually drop the column, which is out of scope. **Keep the model field, keep the DB column, just blank the data.**
- **Alembic**: Explicitly excluded in REQUIREMENTS.md out-of-scope table.
- **metadata.json**: No Email field exists there (verified: `['id', 'username', 'First Name', 'Last Name', 'Job Title', 'Company', 'Bio', 'Hourly Rate', 'Currency', 'Profile URL', 'Profile URL with UTM', 'tags', 'findability_score', 'category']`). No change needed to ingest.py or metadata.json.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV column removal | Custom line-by-line parser | csv.DictWriter with extrasaction="ignore" | Handles quoting, encoding, newlines correctly |
| Idempotent DB migration | Migration tracker / version table | Unconditional UPDATE with idempotent semantics | UPDATE SET email='' is already idempotent; no tracking needed |

**Key insight:** This phase has no complexity that requires external libraries. Everything needed already exists in the codebase's existing patterns.

## Common Pitfalls

### Pitfall 1: Existing DB Already Has Data
**What goes wrong:** The Railway DB has 1,558 experts all with non-empty email. The local dev DB also has 1,558 experts with emails.
**Why it happens:** experts.csv has been the seed source since the beginning, and email was always included.
**How to avoid:** The lifespan UPDATE runs on the Railway DB on next deploy automatically. No manual DB intervention needed.
**Warning signs:** If testing locally, check with `SELECT COUNT(*) FROM experts WHERE email != ''` before and after startup.

### Pitfall 2: experts.csv Column Count Changes Breaking the Seed Logic
**What goes wrong:** `_seed_experts_from_csv()` in main.py uses `row.get("Email")` — after the Email column is removed from the CSV, this returns `None`, which becomes `""` via the `or ""` pattern. This is already safe.
**Why it happens:** The seed code uses `row.get("Email") or ""` — `get()` on a missing key returns `None`, `None or ""` returns `""`. The Expert model field `email` has `default=""` and `nullable=False`, so an empty string is valid.
**How to avoid:** Verify `_seed_experts_from_csv()` — it already uses `.get()` safely. After removing Email from CSV, the seed code will just write `""` for email on any future fresh DB. This is the desired behavior.
**Warning signs:** Any ValueError or IntegrityError during startup seeding after CSV modification.

### Pitfall 3: import-csv Endpoint Still Writing Email on Upsert
**What goes wrong:** The `if existing:` branch in `import_experts_csv` has `existing.email = (row.get("Email") or "").strip()` — this would blank an email that was already blank. After PRIV-01 blanks all emails, this line would still run on every import and set email to `""` (from the CSV row). This is actually harmless for the stated goal, but removing it is the right move for PRIV-03 (completely stops email from being written).
**Why it happens:** The line was written before PRIV-03 was a requirement.
**How to avoid:** Delete the `existing.email = ...` assignment from the upsert branch.
**Warning signs:** Test by uploading a CSV with Email column filled — the Expert.email should remain `""` regardless.

### Pitfall 4: add_expert CSV Append Header Mismatch
**What goes wrong:** If experts.csv no longer has the Email column header, but `add_expert` still writes a row with `"Email": ""`, `csv.DictWriter` will raise `ValueError: dict contains fields not in fieldnames` (DictWriter default is strict, not `extrasaction="ignore"`).
**Why it happens:** The fieldnames list in `add_expert` drives both the header and the row writing.
**How to avoid:** Remove "Email" from both the `fieldnames` list and the `writer.writerow({...})` dict in `add_expert`. Do this in the same edit as the CSV strip.
**Warning signs:** Any new expert added via `POST /api/admin/experts` after CSV rewrite would crash if Email is still in fieldnames.

### Pitfall 5: CSV Rewrite Encoding / Line Ending Issues
**What goes wrong:** Reading with `utf-8` and writing with `utf-8` when the file has a BOM, or losing the `newline=""` on write, can corrupt the CSV.
**Why it happens:** The existing CSV import uses `utf-8-sig` to handle BOM. The rewrite script should match.
**How to avoid:** Open for reading with `encoding="utf-8-sig"` to strip BOM. Open for writing with `newline=""` and `encoding="utf-8"` (no BOM on output — standard).

### Pitfall 6: Railway Volume vs. Deployed experts.csv
**What goes wrong:** The Railway deployment uses the experts.csv committed to the repo (it is a data file, not generated). The lifespan DB migration updates the Railway DB. But the experts.csv on Railway is the deployed version from the git repo. Therefore: strip Email from experts.csv in the repo, commit, deploy — Railway will use the new CSV automatically.
**Why it happens:** experts.csv lives in `data/` and is tracked in git. Railway pulls from git on deploy.
**How to avoid:** Commit the rewritten experts.csv as part of this phase. The Railway DB update happens via the lifespan migration on next startup (triggered by deploy).
**Warning signs:** None — this is the intended flow.

## Code Examples

Verified patterns from codebase inspection:

### Full Lifespan Migration Block (PRIV-01)
```python
# app/main.py — add after existing ALTER TABLE migration blocks (around line 233)
# Phase 41: Expert email purge — blank all Expert.email values
with engine.connect() as _conn:
    _conn.execute(_text("UPDATE experts SET email = ''"))
    _conn.commit()
log.info("startup: expert email purge applied (Phase 41)")
```

### CSV Column Strip — One-time Script or Inline Edit (PRIV-02)
```python
# Run once locally, commit result to repo
import csv
from pathlib import Path

csv_path = Path("data/experts.csv")

with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)
    rows = list(reader)
    fieldnames = [fn for fn in (reader.fieldnames or []) if fn != "Email"]

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

print(f"Rewrote {len(rows)} rows, {len(fieldnames)} columns (Email removed)")
```

### import_experts_csv Upsert Branch — Lines to Delete (PRIV-03)
```python
# app/routers/admin.py — import_experts_csv(), lines ~1035 and ~1052

# In "if existing:" branch — DELETE this line:
existing.email = (row.get("Email") or "").strip()

# In "else:" Expert(...) constructor — DELETE this line:
email=(row.get("Email") or "").strip(),
```

### add_expert CSV-Append — Fields to Remove (PRIV-03 coverage for future writes)
```python
# app/routers/admin.py — add_expert(), lines ~969-990

# BEFORE (current):
fieldnames = [
    "Email", "Username", "First Name", "Last Name", "Job Title",
    "Company", "Bio", "Hourly Rate", "Currency", "Profile URL",
    "Profile URL with UTM", "Profile Image Url", "Created At",
]
writer.writerow({
    "Email": "",
    "Username": body.username,
    # ...
})

# AFTER (target):
fieldnames = [
    "Username", "First Name", "Last Name", "Job Title",
    "Company", "Bio", "Hourly Rate", "Currency", "Profile URL",
    "Profile URL with UTM", "Profile Image Url", "Created At",
]
writer.writerow({
    "Username": body.username,
    # ... (no "Email" key)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Alembic for schema migrations | Raw SQLAlchemy text() in lifespan | Project inception | Simpler, no migration file tracking, idempotent |
| DROP COLUMN for field removal | UPDATE SET email = '' | Phase 41 decision | Avoids Railway SQLite DDL compatibility risk |

**Deprecated/outdated:**
- Alembic: explicitly excluded from this project per REQUIREMENTS.md out-of-scope table.

## Open Questions

1. **Should Expert.email be removed from the SQLAlchemy model class?**
   - What we know: The DB column stays (no DROP COLUMN). The model field maps to that column. The field has `default=""` and `nullable=False`. After the purge, it will always be `""`.
   - What's unclear: Whether leaving a permanently-blank field in the model creates confusion for future developers vs. the cost of a schema inconsistency.
   - Recommendation: Keep the model field. The column exists in the DB; the model should reflect the DB. Removing it from the model but not the DB creates a mapping gap that could cause issues if SQLAlchemy tries to reconcile. Add a docstring comment noting it is intentionally always `""` post-Phase 41.

2. **CSV rewrite: one-time script or inline Python in a task step?**
   - What we know: The rewrite only needs to happen once. The result gets committed to git.
   - What's unclear: Whether to write a throwaway script or just do it as an inline command.
   - Recommendation: Run it as a Python one-liner or short inline script as a task step, verify the output (check column count, row count), then commit. No need to keep the script in the repo.

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `app/main.py` (lifespan pattern, seed logic)
- Direct codebase read — `app/routers/admin.py` (import-csv, add_expert, CSV fieldnames)
- Direct codebase read — `app/models.py` (Expert model schema)
- Direct codebase read — `scripts/ingest.py` (confirms no Email field in metadata output)
- Local SQLite inspection — `data/conversations.db` (1,558 experts all with email; DB schema confirmed)
- Local CSV inspection — `data/experts.csv` (1,610 rows, Email column present, all non-empty)
- Local metadata.json inspection — `data/metadata.json` (no Email field — ingest.py never included it)

### Secondary (MEDIUM confidence)
- Python stdlib csv documentation (DictWriter extrasaction parameter behavior)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from codebase; no new libraries needed
- Architecture: HIGH — existing patterns copied from live code in main.py and admin.py
- Pitfalls: HIGH — identified from actual codebase code paths, not speculation

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (stable codebase; no fast-moving dependencies)
