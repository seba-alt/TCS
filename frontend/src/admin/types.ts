// Admin API TypeScript interfaces
// These shapes mirror the backend /api/admin/* response schemas

export interface AdminStats {
  total_searches: number
  match_count: number
  match_rate: number
  gap_count: number
  top_queries: { query: string; count: number }[]
  top_feedback: { query: string; vote: string; count: number }[]
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

export interface IntelligenceDailyRow {
  date: string
  conversations: number
  hyde_triggered: number
  feedback_applied: number
  gaps: number
  avg_score: number | null
}

export interface IntelligenceStats {
  flags: { hyde_enabled: boolean; feedback_enabled: boolean }
  totals: {
    conversations: number
    hyde_triggered: number
    hyde_rate: number
    feedback_applied: number
    feedback_rate: number
    gaps: number
    gap_rate: number
    avg_score: number | null
  }
  daily: IntelligenceDailyRow[]
}

export interface IngestStatus {
  status: 'idle' | 'running' | 'done' | 'error'
  log: string
  error: string | null
  started_at: number | null
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
  config: 'baseline' | 'hyde' | 'feedback' | 'full'
  label: string   // e.g. "Baseline", "HyDE Only", "Feedback Only", "Full Intelligence"
  experts: CompareExpert[]
  intelligence: {
    hyde_triggered: boolean
    hyde_bio: string | null
    feedback_applied: boolean
  }
}

/** Full response from POST /api/admin/compare. */
export interface CompareResponse {
  columns: CompareColumn[]
  query: string
  overrides_applied: Record<string, boolean>
}

/** Which preset configs are selected for a lab run. */
export type LabConfigKey = 'baseline' | 'hyde' | 'feedback' | 'full'

/** Per-run flag overrides (applied on top of each preset, do not change global DB settings). */
export interface LabOverrides {
  QUERY_EXPANSION_ENABLED?: boolean
  FEEDBACK_LEARNING_ENABLED?: boolean
}
