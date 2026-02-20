# Tinrate AI Concierge Chatbot

## What This Is

An AI-powered expert discovery experience for the Tinrate platform. Users describe their problem in natural language and the system semantically searches a database of 1,600+ vetted experts, then responds with a personalized, conversational recommendation of exactly three best-fit experts — displayed as styled, clickable contact cards that link directly to their Tinrate profile pages.

## Core Value

A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can type a problem description into a conversational chat interface
- [ ] Backend embeds the query using Google GenAI embeddings and semantically searches the expert CSV
- [ ] Gemini LLM generates a response recommending exactly 3 experts, each with "Name — Job Title @ Company" and a "Why them:" explanation
- [ ] Frontend renders 3 visual Expert Cards below the AI response showing name, title, company, and hourly rate
- [ ] Each Expert Card is a clickable link routing to that expert's profile page on Tinrate
- [ ] If a query is too narrow to confidently match, the chatbot asks a clarifying follow-up question
- [ ] Application is publicly hosted and accessible via URL
- [ ] Frontend deployed on Vercel, backend deployed on Railway or Render

### Out of Scope

- User authentication / accounts — users interact anonymously for now
- Expert profile management (CRUD for the CSV) — data is static for v1
- Booking/payment flow — cards link to Tinrate profiles where booking happens
- Mobile native app — web-first
- Real-time availability or calendar integration — not in CSV data

## Context

- **Expert data:** CSV with 1,600+ profiles containing: name, title, company, bio, hourly rate, profile URL, reviews (optional)
- **AI stack:** Google GenAI for embeddings, Gemini LLM for generation
- **Existing codebase:** Unrelated files in working directory — greenfield implementation
- **Conversation mode:** One-shot by default; chatbot asks clarifying questions only when results would be too narrow or ambiguous
- **Card format (exact spec):** Text response lists "Name — Job Title @ Company" + "Why them:" explanation; below that, visual cards with name/title/company/rate + clickable link to profile

## Constraints

- **Tech stack:** React frontend, Python FastAPI backend — already decided
- **Hosting:** Vercel (frontend) + Railway or Render (backend)
- **AI provider:** Google GenAI (embeddings) + Gemini (generation) — no switching to OpenAI
- **Data format:** Expert data is a CSV file — no database migration for v1
- **Output format:** Always exactly 3 expert recommendations per response (unless clarification needed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| RAG over fine-tuning | CSV data changes; retrieval is more maintainable than a fine-tuned model | — Pending |
| CSV as vector source | 1,600 profiles is small enough for in-memory embedding; no vector DB needed for v1 | — Pending |
| Standalone site | Decoupled from main Tinrate app — faster to ship, easier to iterate | — Pending |
| Exactly 3 recommendations | Clear, decisive UX — avoids overwhelming users with choice | — Pending |

---
*Last updated: 2026-02-20 after initialization*
