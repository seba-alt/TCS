// Admin API TypeScript interfaces
// These shapes mirror the backend /api/admin/* response schemas

export interface AdminStats {
  total_searches: number
  match_count: number
  match_rate: number
  gap_count: number
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
