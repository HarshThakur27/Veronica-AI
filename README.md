# Veronica AI

An agentic AI research assistant with real-time web search, multi-format RAG (PDF/Excel/URL), persistent multi-turn memory, and a streaming chat UI — built end-to-end as a full-stack GenAI portfolio project.

**Live demo:** [veronica-ai-three.vercel.app](https://veronica-ai-three.vercel.app)
**API docs:** [Railway-hosted FastAPI backend `/docs`](https://veronica-ai-production-466b.up.railway.app/docs)

---

## Overview

Veronica is a ChatGPT/Gemini-style assistant that goes beyond a single LLM call. It's built as an **agent** that decides, per query, whether to answer from its own knowledge, 
search the live web, or retrieve from a document the user uploaded — and can combine sources when a question needs both. The project was built to explore the full agentic-RAG
stack: tool-calling, vector retrieval, streaming, persistence, and deployment — not just prompting.

## Features

- **Agentic tool selection** — the LLM autonomously chooses between web search (Tavily) and document retrieval (RAG) based on the query, with explicit rules for when to combine both
- **Multi-format RAG** — upload a PDF, Excel file, or a URL; content is chunked, embedded (HuggingFace `sentence-transformers`), and stored in ChromaDB for semantic retrieval
- **Real-time web search** — Tavily API integration for current events, prices, and any information outside the model's training data
- **Streaming responses** — token-by-token output via FastAPI `StreamingResponse` + a custom `ReadableStream` reader on the frontend
- **Persistent multi-turn memory** — full conversation history stored in MongoDB Atlas, scoped per chat thread
- **Chat history sidebar** — list, reopen, and delete past conversations
- **Conversation controls** — stop generation mid-stream (`AbortController`), retry/regenerate the last response
- **Guardrails** — prompt-injection resistance (treats retrieved document/URL content as data, never as instructions), tool-use safety rules (e.g. never send email without explicit user confirmation), and hallucination controls

