// Admin API TypeScript interfaces
// These shapes mirror the backend /api/admin/* response schemas

export interface AdminStats {
  total_searches: number
  match_count: number
  match_rate: number
  gap_count: number
  top_queries: { query: string; count: number }[]
  top_feedback: { query: string; vote: string; count: number }[]
  total_leads?: number
  expert_pool?: number
  leads_7d?: number
  leads_prior_7d?: number
  expert_pool_7d?: number
  lead_rate?: number
}

export interface SearchRow {
  id: number
  email: string
  query: string
  created_at: string       // ISO datetime string
  response_type: string    // "match" | "clarification"
  match_count: number
  top_match_score: number | null
  is_gap: boolean
  gap_resolved: boolean
  response_experts: string // Raw JSON string — parsed by ExpandedExpertRow component
  source: string           // "chat" | "sage"
}

export interface SearchesResponse {
  rows: SearchRow[]
  total: number
  page: number
  page_size: number
}

export interface GapRow {
  id: number
  query: string
  frequency: number
  best_score: number | null
  resolved: boolean
}

export interface GapsResponse {
  gaps: GapRow[]
}

// Filter state shape for searches table and CSV export
export interface SearchFilters {
  email?: string
  gap_flag?: boolean
  score_min?: number
  score_max?: number
  date_from?: string   // ISO date string YYYY-MM-DD
  date_to?: string     // ISO date string YYYY-MM-DD
  page?: number
  page_size?: number
}

export interface LeadRow {
  email: string
  total_searches: number
  last_search_at: string | null
  gap_count: number
  recent_queries: string[]
  click_count: number
}

export interface LeadsResponse {
  leads: LeadRow[]
}

export interface ExpertRow {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  bio: string
  hourly_rate: number
  profile_url: string
  category: string | null
  tags: string[]
  findability_score: number | null
  manual_tags?: string[]   // admin-assigned tags (Phase 69.2)
  is_active?: boolean      // soft-delete flag (Phase 69.1)
}

export interface DomainMapEntry {
  domain: string
  count: number
}

export interface DomainMapResponse {
  domains: DomainMapEntry[]
}

export interface ExpertsResponse {
  experts: ExpertRow[]
}

export interface PaginatedExpertsResponse {
  experts: ExpertRow[]
  total: number
  page: number
  total_pages: number
}

export interface IngestStatus {
  status: 'idle' | 'running' | 'done' | 'error'
  log: string
  error: string | null
  started_at: number | null
  last_rebuild_at: number | null          // Phase 24: unix timestamp of last full FAISS rebuild
  expert_count_at_rebuild: number | null  // Phase 24 + 25: expert count at last rebuild
}

export interface AdminSetting {
  key: string
  value: boolean | number         // native typed (bool for flags, float/int for thresholds)
  raw: string                     // original string value from DB or env var
  source: 'db' | 'env' | 'default'  // override hierarchy indicator from backend
  type: 'bool' | 'float' | 'int'
  description: string
  min?: number
  max?: number
}

export interface AdminSettingsResponse {
  settings: AdminSetting[]
}

// ── Search Lab A/B Comparison ─────────────────────────────────────────────────

/** One expert result row in a comparison column. */
export interface CompareExpert {
  rank: number
  name: string
  title: string | null
  score: number
  profile_url: string | null
}

/** One config column result from POST /api/admin/compare. */
export interface CompareColumn {
  config: LabConfigKey
  label: string   // e.g. "Explore (Baseline)", "Legacy HyDE Only", etc.
  pipeline?: string  // "run_explore" or "legacy"
  experts: CompareExpert[]
  intelligence: {
    hyde_triggered: boolean
    hyde_bio: string | null
    feedback_applied: boolean
    pipeline?: string  // "run_explore" or "legacy"
  }
}

/** Full response from POST /api/admin/compare. */
export interface CompareResponse {
  columns: CompareColumn[]
  query: string
  overrides_applied: Record<string, boolean>
}

/** Which preset configs are selected for a lab run. */
export type LabConfigKey =
  | 'explore_baseline' | 'explore_full'
  | 'legacy_baseline' | 'legacy_hyde' | 'legacy_feedback' | 'legacy_full'
  | 'baseline' | 'hyde' | 'feedback' | 'full'

/** Per-run flag overrides (applied on top of each preset, do not change global DB settings). */
export interface LabOverrides {
  QUERY_EXPANSION_ENABLED?: boolean
  FEEDBACK_LEARNING_ENABLED?: boolean
}

// ── Newsletter Subscribers (Phase 27) ────────────────────────────────────────

export interface NewsletterSubscriber {
  email: string
  created_at: string  // ISO string
  source: string
  click_count: number
}

export interface NewsletterSubscribersResponse {
  count: number
  subscribers: NewsletterSubscriber[]
}

// --- Marketplace Intelligence types ---

export interface DemandRow {
  query_text: string
  frequency: number
  last_seen: string      // ISO datetime string
  unique_users: number
}

export interface DemandResponse {
  data_since: string | null  // null = cold start (no events yet)
  demand: DemandRow[]
  total: number
  page: number
  page_size: number
}

export interface ExposureRow {
  expert_id: string      // username / expert identifier
  expert_name?: string | null  // full "First Last" name — resolved by backend
  total_clicks: number
  grid_clicks: number
  sage_clicks: number
}

export interface ExposureResponse {
  data_since: string | null
  exposure: ExposureRow[]
}

export interface DailyTrendRow {
  day: string            // YYYY-MM-DD
  total: number
  hits: number
  zero_results: number
}

export interface MarketplaceTrendResponse {
  data_since: string | null
  daily: DailyTrendRow[]
  kpis: {
    total_queries: number
    zero_result_rate: number
    prior_period_total: number
  }
}

// ── Lead Click Tracking types ─────────────────────────────────────────────────

export interface LeadClickEntry {
  expert_username: string
  expert_name: string
  search_query: string
  created_at: string
}

export interface LeadClicksByEmail {
  email: string
  clicks: LeadClickEntry[]
}

export interface LeadClicksResponse {
  leads: LeadClicksByEmail[]
}

export interface LeadClicksByExpertResponse {
  expert_username: string
  clicks: {
    email: string
    search_query: string
    created_at: string
  }[]
}

// ── Lead Journey Timeline (Phase 61) ─────────────────────────────────────────

export interface TimelineSearchEvent {
  type: 'search'
  query: string
  result_count: number
  created_at: string  // ISO datetime
}

export interface TimelineClickEvent {
  type: 'click'
  expert_username: string
  expert_name: string
  search_query: string
  created_at: string  // ISO datetime
}

export interface TimelineExplorerSearchEvent {
  type: 'explorer_search'
  query: string
  result_count: number
  created_at: string  // ISO datetime
}

export interface TimelineExplorerClickEvent {
  type: 'explorer_click'
  expert_username: string
  expert_name: string
  search_query: string | null
  created_at: string  // ISO datetime
}

export interface TimelineSaveEvent {
  type: 'save'
  expert_username: string
  expert_name: string
  created_at: string
}

export interface TimelineUnsaveEvent {
  type: 'unsave'
  expert_username: string
  expert_name: string
  created_at: string
}

export type TimelineEvent = TimelineSearchEvent | TimelineClickEvent | TimelineExplorerSearchEvent | TimelineExplorerClickEvent | TimelineSaveEvent | TimelineUnsaveEvent

export interface LeadTimelineResponse {
  email: string
  events: TimelineEvent[]
  total: number
  limit: number
  offset: number
}

// -- Top Queries (Phase 62) --

export interface TopQueryRow {
  query_text: string
  frequency: number
}

export interface TopQueriesResponse {
  queries: TopQueryRow[]
}

// -- Analytics Summary (Phase 50.2) --

export interface RecentSearchEntry {
  query_text: string
  result_count: number
  active_tags?: string[]
  created_at: string
}

export interface RecentClickEntry {
  expert_id: string
  expert_name: string | null
  source: string
  created_at: string
}

export interface AnalyticsSummary {
  total_card_clicks: number
  total_search_queries: number
  total_lead_clicks: number
  recent_searches: RecentSearchEntry[]
  recent_clicks: RecentClickEntry[]
}

// -- Top Saved Experts (Phase 69) --

export interface TopSavedRow {
  expert_id: string
  expert_name: string | null
  total_saves: number
}

export interface TopSavedResponse {
  data_since: string | null
  top_saved: TopSavedRow[]
}

// -- Tag Manager (Phase 69.2) --

export interface TagCatalogEntry {
  id: number
  tag: string
}

export interface TagCatalogResponse {
  tags: TagCatalogEntry[]
}

export interface TagAssignmentEntry {
  username: string
  first_name: string
  last_name: string
  manual_tags: string[]
}

export interface TagAssignmentsResponse {
  assignments: TagAssignmentEntry[]
}
