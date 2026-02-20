export interface Expert {
  name: string
  title: string | null
  company: string | null
  hourly_rate: string
  profile_url: string | null
  why_them: string
}

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string                   // crypto.randomUUID()
  role: MessageRole
  content: string              // narrative text for assistant, query text for user
  experts?: Expert[]           // only on assistant messages with type === 'recommendation'
  conversationId?: number      // from SSE result event; only on assistant recommendation messages
  isStreaming?: boolean        // true while SSE result is being received
}

export type ChatStatus =
  | 'idle'        // no active request
  | 'thinking'    // status:thinking event received, waiting for result
  | 'streaming'   // result event received, narrative being displayed
  | 'done'        // done event received
  | 'error'       // error event received

export interface ChatResponse {
  type: 'recommendation' | 'clarification'
  narrative: string
  experts: Expert[]
}

export interface SSEResultEvent {
  event: 'result'
  type: 'recommendation' | 'clarification'
  narrative: string
  experts: Expert[]
  conversation_id?: number
}

export type FeedbackVote = 'up' | 'down' | null
