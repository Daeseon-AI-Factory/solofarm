# BINJO - AI Farm Management Platform

**Full-stack farm management system** built for a solo apple orchard in South Korea. Voice-powered diary, receipt OCR bookkeeping, pesticide safety checks, direct-to-consumer orders, and government-compliant PDF export — all designed for use with work gloves on.

> **[Live Demo](#live-demo)** | **[Architecture](#architecture)** | **[Key Features](#key-features)** | **[Tech Stack](#tech-stack)**

---

## Why This Exists

A friend runs a solo apple farm. His tools: a paper notebook, a calculator, and WhatsApp for orders. Every evening he spends 30+ minutes on paperwork instead of resting.

BINJO replaces that with: speak into your phone while walking the orchard → AI structures it into a farm diary, tracks expenses, and manages customer orders. **Zero typing required.**

---

## Key Features

### Voice Farm Diary
Record → Whisper STT → Claude parses structured data → farmer reviews → one-tap confirm.
Manual entry also supported with smart quick-tap buttons (8 common apple farming tasks).

### Receipt OCR Bookkeeping
Snap a photo of any receipt → Claude Vision extracts line items → auto-generates financial transactions → monthly P&L reports with charts.

### Pesticide Safety Engine
Select a pesticide → system calculates safe harvest date based on official Korean safety intervals. Warns before spray if harvest window is too close.

### Direct Orders & Payments
Consumer-facing brand page → product catalog → TossPayments checkout → order tracking → shipping management.

### Government PDF Export
One-click export of farm logs in the format required by Korean agricultural agencies (영농일지).

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│   Next.js Frontend   │────▶│   FastAPI Backend     │
│   React 19 + TS      │     │   Python 3.11+       │
│   Tailwind CSS v4    │     │   SQLAlchemy async    │
│   Mobile-first UI    │     │   Pydantic v2         │
└──────────────────────┘     └──────────┬───────────┘
                                        │
                    ┌───────────────┬────┴────┬───────────────┐
                    ▼               ▼         ▼               ▼
             ┌────────────┐  ┌──────────┐ ┌───────┐  ┌──────────────┐
             │ Supabase   │  │ Claude   │ │Whisper│  │ TossPayments │
             │ PostgreSQL │  │ Vision   │ │ STT   │  │ (Payments)   │
             │ + Storage  │  │ (OCR/NLP)│ │       │  │              │
             └────────────┘  └──────────┘ └───────┘  └──────────────┘
```

**Design Principle: Deterministic Backbone**
- Code handles: validation, auth, payments, data transforms, PDF generation
- AI handles: voice parsing, receipt OCR, agricultural term correction, insights
- Every AI call is behind a provider interface — swap Claude ↔ OpenAI without code changes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript (strict), Tailwind CSS v4 |
| **Backend** | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| **Database** | PostgreSQL (Supabase) |
| **Storage** | Supabase Storage (S3-compatible) — photos, audio, receipts |
| **AI** | Claude API (structured parsing, OCR), OpenAI Whisper (STT) |
| **Payments** | TossPayments (Korean payment gateway) |
| **Task Queue** | Celery + Redis (async processing with sync fallback) |
| **Auth** | JWT + Kakao OAuth |
| **Deploy** | Vercel (frontend) + Docker (backend) |

---

## Project Stats

- **130+ source files** across frontend and backend
- **7,000+ lines** of endpoint + page code
- **14 API endpoint modules** — auth, voice, farm logs, weather, fields, pesticides, receipts, transactions, reports, orders, payments, export, admin
- **9 farmer portal pages** — dashboard, record, logs, calendar, finance, fields, receipt, insights, login
- **4 development phases** completed in 4 weeks (solo developer)

---

## Local Development

### Prerequisites
- Node.js 18+, Python 3.11+, PostgreSQL (or Supabase account)

### Quick Start

```bash
# Frontend
cd products/binjo/web
npm install
cp .env.example .env.local   # Configure Supabase + API keys
npm run dev                   # → localhost:3000

# Backend (from repo root)
python -m venv .venv && source .venv/bin/activate
pip install -e .              # installs factory-core (shared modules in core/)
pip install -e products/binjo/api
cd products/binjo/api
cp .env.example .env          # Configure DB + AI API keys
alembic upgrade head          # Run migrations
uvicorn app.main:app --port 8002 --reload
```

Or with Docker:

```bash
docker compose up
# Frontend → localhost:3080
# Backend  → localhost:8082
```

---

## Live Demo

> **Frontend:** [https://binjo.vercel.app](https://binjo.vercel.app)
> **API Docs:** [https://binjo-api.up.railway.app/docs](https://binjo-api.up.railway.app/docs)

Demo credentials for the farmer portal are available on the login page.

---

## What I'd Do Differently (Honest Retrospective)

- **Photo upload is a two-step flow** (create log → upload photos). A single multipart request would be cleaner UX but would require refactoring the voice pipeline. Pragmatic trade-off for now.
- **No comprehensive test suite yet.** Prioritized shipping over coverage. Next step: pytest fixtures for the API + Playwright for critical paths.
- **JSONB for photo URLs** instead of a normalized table. Fine for 1-10 photos per log; would promote to a table if we needed per-photo metadata.

---

## Author

**Jason Yoo (유대선)** — Backend engineer (5 years MES/WMS at SK AX), building AI products.

- GitHub: [@JasonAIFactory](https://github.com/JasonAIFactory)

---

*Built with FastAPI, Next.js, Claude API, and a lot of apple farming domain knowledge.*
