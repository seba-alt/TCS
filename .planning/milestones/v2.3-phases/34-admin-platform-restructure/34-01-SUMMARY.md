---
plan: 34-01
phase: 34-admin-platform-restructure
status: complete
completed: 2026-02-23
---

# Plan 34-01: Admin Navigation Restructure + ToolsPage + DataPage

## What was built

Replaced the flat 11-item admin sidebar with a grouped 3-section structure and created consolidated tab pages for tools and data.

## Key changes

- **AdminSidebar.tsx**: Replaced flat `NAV_ITEMS` array and slice-based sections with typed `NAV_GROUPS` structure. 3 groups (Analytics, Tools, Admin) containing exactly 8 items total.
- **ToolsPage.tsx** (new): Hash-driven tabs — Score Explainer / Search Lab / Index. CSS `hidden` class preserves component state on tab switch. Index tab uses `IndexManagementPanel`.
- **DataPage.tsx** (new): Hash-driven tabs — Searches / Marketplace. CSS `hidden` class preserves component state. `location.state.email` available to child SearchesPage via shared `useLocation()`.
- **IndexManagementPanel.tsx** (new): Extracted shared component with full rebuild UI (STATUS_CONFIG, formatTs, status badge, timestamps, rebuild button, about list). Used by both ToolsPage and SettingsPage.
- **SettingsPage.tsx**: Replaced simplified FAISS section with "Index Management" section using `IndexManagementPanel`.
- **LeadsPage.tsx**: Updated navigate target from `/admin/searches` to `/admin/data#searches`.
- **main.tsx**: Added `/admin/tools` and `/admin/data` routes. Added 5 legacy redirects (search-lab, score-explainer, index → /admin/tools; searches, marketplace → /admin/data). Removed imports for all consolidated pages.
- **IndexPage.tsx**: Deleted after content migrated to `IndexManagementPanel`.

## Self-Check: PASSED

- Build: zero TypeScript errors
- NAV_GROUPS present in AdminSidebar, no NAV_ITEMS or slice
- ToolsPage.tsx and DataPage.tsx exist
- IndexPage.tsx deleted
- SettingsPage contains "Index Management"
- main.tsx has 5 Navigate redirect routes
- LeadsPage navigates to /admin/data#searches

## key-files

### created
- frontend/src/admin/pages/ToolsPage.tsx
- frontend/src/admin/pages/DataPage.tsx
- frontend/src/admin/components/IndexManagementPanel.tsx

### modified
- frontend/src/admin/components/AdminSidebar.tsx
- frontend/src/admin/pages/SettingsPage.tsx
- frontend/src/admin/pages/LeadsPage.tsx
- frontend/src/main.tsx

### deleted
- frontend/src/admin/pages/IndexPage.tsx
