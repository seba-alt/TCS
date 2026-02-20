import { useState, useCallback, useRef } from 'react'
import type { Message, ChatStatus, Expert } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface UseChatOptions {
  email: string
}

interface UseChatReturn {
  messages: Message[]
  status: ChatStatus
  sendMessage: (query: string) => void
  retryLast: () => void
}

export function useChat({ email }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const lastQueryRef = useRef<string>('')
  const historyRef = useRef<Array<{ role: string; content: string }>>([])

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const updateLastAssistantMessage = useCallback(
    (updater: (msg: Message) => Message) => {
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === 'assistant')
        if (idx === -1) return prev
        const realIdx = prev.length - 1 - idx
        const updated = [...prev]
        updated[realIdx] = updater(updated[realIdx])
        return updated
      })
    },
    []
  )

  const sendMessage = useCallback(
    async (query: string) => {
      if (status === 'thinking' || status === 'streaming') return

      lastQueryRef.current = query

      // Append user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: query,
      }
      appendMessage(userMsg)

      // Add user turn to history for multi-turn context
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: query },
      ]

      setStatus('thinking')

      // Add placeholder assistant message (shows thinking cursor)
      const thinkingMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      }
      appendMessage(thinkingMsg)

      try {
        const res = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            query,
            history: historyRef.current.slice(0, -1), // exclude current user turn
          }),
        })

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        // Parse SSE stream manually (fetch ReadableStream, not EventSource — POST body required)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE events are separated by \n\n
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? '' // last part may be incomplete

          for (const part of parts) {
            const dataLine = part
              .split('\n')
              .find((l) => l.startsWith('data: '))
            if (!dataLine) continue

            let event: Record<string, unknown>
            try {
              event = JSON.parse(dataLine.slice(6)) // strip "data: "
            } catch {
              continue
            }

            if (event.event === 'status' && event.status === 'thinking') {
              // Already in thinking state — no-op
            } else if (event.event === 'result') {
              const narrative = event.narrative as string
              const experts = (event.experts ?? []) as Expert[]
              const conversationId = event.conversation_id as number | undefined

              setStatus('streaming')
              updateLastAssistantMessage((msg) => ({
                ...msg,
                content: narrative,
                experts: experts.length > 0 ? experts : undefined,
                conversationId,
                isStreaming: true, // cursor still shown until done event
              }))

              // Add assistant turn to history
              historyRef.current = [
                ...historyRef.current,
                { role: 'assistant', content: narrative },
              ]
            } else if (event.event === 'done') {
              setStatus('done')
              updateLastAssistantMessage((msg) => ({
                ...msg,
                isStreaming: false,
              }))
              // Reset to idle for next query
              setTimeout(() => setStatus('idle'), 100)
            } else if (event.event === 'error') {
              const errorMessage = (event.message as string) ?? 'Something went wrong.'
              setStatus('error')
              updateLastAssistantMessage((msg) => ({
                ...msg,
                content: errorMessage,
                isStreaming: false,
              }))
            }
          }
        }
      } catch {
        setStatus('error')
        updateLastAssistantMessage((msg) => ({
          ...msg,
          content: 'Something went wrong. Please try again.',
          isStreaming: false,
        }))
      }
    },
    [status, email, appendMessage, updateLastAssistantMessage]
  )

  const retryLast = useCallback(() => {
    if (!lastQueryRef.current) return
    // Remove last assistant message (error state), keep user message
    setMessages((prev) => {
      const lastAssistantIdx = [...prev].reverse().findIndex((m) => m.role === 'assistant')
      if (lastAssistantIdx === -1) return prev
      const realIdx = prev.length - 1 - lastAssistantIdx
      return prev.slice(0, realIdx)
    })
    setStatus('idle')
    sendMessage(lastQueryRef.current)
  }, [sendMessage])

  return { messages, status, sendMessage, retryLast }
}
