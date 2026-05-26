# CLAUDE.md — BINJO (빈조) Farm Management Platform

## Who We Are

Jason (backend dev, 5 years MES/WMS at SK AX) building an AI-powered farm management system for his friend's solo apple orchard — Binjo Farm (빈조농장) in Sacheon, Gyeongnam.

This is the first product of the AI Product Factory. Every reusable module becomes a building block for future products.

## Product Philosophy

> **"Farming is the real job. Everything else runs automatically."**
> Design test: **"Can you use this wearing work gloves in the orchard?"** If not, redesign.

---

## Core Principles

1. **Products First** — Ship fast, make money. Architecture serves products.
2. **Factory Mindset** — Every module: solve today's problem AND become a building block.
3. **Deterministic Backbone** — Same input, same output → code. Judgment needed → AI.
4. **Independence Through Modularity** — Clean interface in, clean interface out.
5. **Product Composability** — Boundaries are contracts, not shortcuts.
6. **Revenue Validates Everything** — Optimize for time-to-first-revenue.
7. **Code Equals Documentation** — Types, schemas, docstrings, auto-generated API docs.
8. **Scale Later, Ship Now** — Build for 100 users. Optimize when they stress the system.
9. **Speed Compounds** — Every day planning instead of building is lost compound interest.

---

## Current Phase: Phase 1 — Brand Page

**Stack (Phase 1 only):**
- Next.js 14+ (App Router, TypeScript)
- Tailwind CSS
- Prisma ORM + **Supabase PostgreSQL** (direct connection, NOT PostgREST)
- **Supabase Storage** (S3-compatible, for images)
- Vercel (deploy)

**Supabase Usage Rule:** We use Supabase as **hosted PostgreSQL + S3 Storage only.** Prisma connects directly to the database. We do NOT use Supabase Auth, Realtime, Edge Functions, or PostgREST API. This keeps us ORM-agnostic for Phase 2 migration to SQLAlchemy.

**Phase 2+ will add:** FastAPI (Python), SQLAlchemy (same Supabase PG), Whisper, Claude API, Celery, Redis

---

## Language Rules

| Context | Language | Example |
|---|---|---|
| All code | English | `def get_farm_profile()`, `class ProductSchema` |
| Variable/function names | English | `farm_name`, `is_available`, `harvest_month` |
| Comments & docstrings | English | `# Fetch weather from KMA API` |
| Commit messages | English | `feat: add product catalog endpoint` |
| Spec & architecture docs | English | Everything in `/docs/` |
| CLAUDE.md | English | This file |
| UI text & labels | **Korean** | `"주문 문의하기"`, `"우리 사과"`, `"영농일지"` |
| Error messages (user-facing) | **Korean** | `"잠시 후 다시 시도해주세요"` |
| Error messages (dev/logs) | English | `"Failed to connect to KMA API"` |
| Database seed data | **Korean** | Product names, descriptions, calendar |
| API response field names | English | `{ "farm_name": "빈조농장", "is_available": true }` |
| API response content values | **Korean** where user-facing | `"description": "아삭하고 달콤한 대표 품종"` |

**In Claude Code conversations**: Communicate in English. Jason is practicing English fluency.

---

## Coding Rules

### TypeScript (Phase 1 Frontend)
- Strict mode enabled
- All components: functional + hooks
- Tailwind for all styling — no CSS modules
- Server Components by default; `'use client'` only when needed
- Zod for runtime validation on API boundaries

### Database (Prisma + Supabase)
- Prisma connects via `DATABASE_URL` (pooler) and `DIRECT_URL` (for migrations)
- Use Prisma's `@default(uuid())` for IDs
- Supabase Storage client for image uploads only
- Never use Supabase PostgREST, Auth, or Realtime

### Python (Phase 2+ Backend)
- Type hints on ALL function signatures
- Pydantic for ALL data boundaries
- `async def` for all handlers and DB operations
- Google-style docstrings on public functions
- Custom exceptions inheriting from `AppError`
- Tag reusable modules with `# CORE_CANDIDATE`

### API
- Consistent error format: `{"error": {"code": "...", "message": "..."}}`
- Endpoints: kebab-case (`/api/v1/farm-logs`)
- Always version APIs (`/api/v1/`)
- Never expose stack traces in production

### Naming
- Files: `snake_case.py`, `PascalCase.tsx` (components), `camelCase.ts` (utils)
- Classes: `PascalCase`
- Functions/vars: `snake_case` (Python), `camelCase` (TypeScript)
- Constants: `UPPER_SNAKE`
- Database tables (Prisma models): `PascalCase` (Prisma convention)
- Database columns: `camelCase` (Prisma) → maps to `snake_case` in DB via `@map`

### Git
- Conventional commits in English: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Branch: `feat/brand-page-hero`, `fix/og-meta-tags`

---

## Project Structure (Monorepo Factory)

```
solofarm/                              # Repo root
├── pyproject.toml                     # factory-core package (shared modules)
├── core/                              # Importable as `core` (CORE_CANDIDATE modules)
│   ├── config.py                      # CoreSettings — shared env vars
│   ├── ai/                            # LLMProvider + ClaudeProvider
│   ├── stt/                           # Whisper + post-processor
│   ├── auth/                          # JWT + Kakao OAuth
│   ├── storage/                       # Supabase Storage client
│   ├── payment/                       # PaymentProvider + Toss (Stripe to come)
│   └── external_api/                  # Weather (KMA), etc.
│
├── products/                          # One subdir per product. All siblings.
│   └── binjo/                         # Apple farm management (Phase 1-4)
│       ├── api/                       # FastAPI backend
│       │   ├── pyproject.toml         # depends on factory-core
│       │   ├── app/
│       │   │   ├── config.py          # extends CoreSettings with BINJO-only fields
│       │   │   ├── main.py
│       │   │   ├── database.py
│       │   │   ├── dependencies.py
│       │   │   ├── api/               # FastAPI endpoints
│       │   │   ├── modules/           # BINJO-specific: farm_log, bookkeeping, orders, intelligence
│       │   │   ├── models/            # SQLAlchemy models
│       │   │   ├── schemas/           # Pydantic schemas
│       │   │   ├── data/              # Static data (pesticide DB)
│       │   │   └── services/
│       │   ├── alembic/               # DB migrations
│       │   ├── workers/               # Celery tasks
│       │   └── Dockerfile             # build context = repo root (see docker-compose)
│       └── web/                       # Next.js frontend
│           ├── package.json
│           ├── app/                   # App Router pages (brand, farmer portal, admin)
│           ├── components/
│           ├── lib/
│           └── prisma/
│
├── docs/                              # Specs (currently BINJO-only; new products get their own subdir)
│   ├── spec.md
│   ├── architecture.md
│   ├── phase1-brand-page.md
│   ├── phase2-voice-farm.md
│   ├── phase3-bookkeeping.md
│   └── phase4-orders-intel.md
│
├── docker-compose.yml                 # api context = repo root (needs to bundle core/)
├── vercel.json                        # rootDirectory = products/binjo/web
├── CLAUDE.md
└── README.md
```

### Setup from a fresh venv

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .                         # installs factory-core (provides core/*)
pip install -e products/binjo/api        # installs binjo-api
cd products/binjo/api && uvicorn app.main:app --reload
```

### Adding a new product

1. `mkdir -p products/<name>/{api,web}`
2. Copy `products/binjo/api/pyproject.toml` as a template — keep `factory-core` dependency, drop BINJO-only deps you won't use.
3. In the new product's `app/config.py`, extend `CoreSettings` from `core.config`.
4. Customization belongs in **data/templates** (YAML, JSON, prompt files), NEVER in `if product_type == "..."` branches in code.

---

## AI Integration (Deterministic Backbone)

| Deterministic (Code) | AI (LLM) |
|---|---|
| Input validation | Voice → structured farm log parsing |
| Data transformation | Receipt OCR → transaction extraction |
| Auth / authorization | Agricultural term correction |
| Payment processing | Yearly report narrative generation |
| Weather API calls | Customer insight generation |
| PDF generation | Expense optimization suggestions |

- Abstract ALL LLM calls behind `LLMProvider` interface
- Support Claude ↔ OpenAI switching without code changes
- Cache identical prompts
- Timeout + retry on all LLM calls
- Log prompt + response (redact PII)

---

## Module Dependency Rule

```
core/                       ← depends on nothing product-specific (top-level)
  ↑
products/<name>/api/app/services/  ← depends on core
  ↑
products/<name>/api/app/api/       ← depends on services and core
  ↑
products/<name>/api/app/modules/   ← product-specific, can depend on anything above
```

**Core NEVER imports from products.** Verify with: `grep -r "from products" core/` should return zero hits.

Core imports the shared `core.config.CoreSettings`. Products extend it in their own `app/config.py`.

---

## Composability Checklist

Before completing any module, verify:
- [ ] Works without knowing which product it's in?
- [ ] Exposes a clean API/interface?
- [ ] Another product could import and use this tomorrow?
- [ ] Tagged `# CORE_CANDIDATE` if reusable?
- [ ] All dependencies injected, not hardcoded?

---

## DO
- Follow `/docs/phase{N}-*.md` exactly — they are the source of truth
- Write production code: type hints, error handling, clean interfaces
- Tag reusable modules with `# CORE_CANDIDATE`
- Keep UI text in Korean, everything else in English
- Fail fast on missing config — validate all env vars at startup
- Ask before adding any dependency not in the tech stack
- First commit: `docs: initialize BINJO project with full 4-phase spec`
  - Then: `chore: initialize Next.js 14 with TypeScript + Tailwind`
  - Then: `chore: configure Prisma with Supabase PostgreSQL`

## DON'T
- Don't add features not in the current phase spec
- Don't over-engineer for hypothetical scale
- Don't use bare `except:` — always catch specific exceptions
- Don't hardcode secrets, API keys, or URLs
- Don't let core modules import from product modules
- Don't skip Pydantic/Zod validation on any data boundary
- Don't create separate documentation files — code IS the documentation
- Don't use Supabase PostgREST, Auth, Realtime, or Edge Functions

---

## Communication Rules

Jason is a native Korean speaker actively training to write and speak like a North American senior developer. Every interaction is a language training opportunity, not just a coding session.

### English Refinement (Always On)

**Rule:** If Jason's English is grammatically wrong, unnatural, or sounds non-native, always show the refined version before executing the task. Don't silently fix it — he needs to see the correction to learn.

**Format:**
> Your phrasing: "can you note that things??"
> Refined: "Can you save those points somewhere I can reference later?"
> What was off: "note that things" → unclear verb + wrong pronoun. "save those points" is what you actually meant. Double question marks read as informal/frustrated — one is enough in professional writing.

**What to correct:**
- Grammar errors (wrong tense, subject-verb agreement, article usage — a/an/the)
- Unnatural word choice ("note that" instead of "document" or "save")
- Korean sentence structure mapped directly to English (topic-first, no subject)
- Overly casual phrasing that wouldn't fly in a Slack message to a senior engineer
- Missing context that a native speaker would naturally include

**What NOT to over-correct:**
- Intentionally casual shorthand ("wdym", "lgtm") — those are fine in dev culture
- Minor stylistic choices that are grammatically valid

**North American dev idioms to use naturally in responses:**
- "ship it", "good to go", "blocked on X", "let's table that", "take a pass at it"
- "this is a footgun" (something that causes self-inflicted bugs)
- "happy path", "edge case", "guard clause"
- "land this PR", "cut a release", "spin up a service"

---

### Prompt Refinement

When Jason gives a vague or weak instruction, rephrase it into a precise, effective prompt before executing.

**Formula for a strong prompt:**
`[Action verb] + [exactly what] + [in/following what] + [constraints]`

**Example:**
- His prompt: "update my Claude.md to note all the learning points and explains very clearly"
- Refined: "Expand the Teaching Mode and Communication Rules sections in CLAUDE.md to include: (1) structured English correction format with examples, (2) explicit interview talking point format with Decision/Why/What-breaks, (3) tips for prompting Claude Code effectively. Keep all existing content — add, don't replace."
- What was off: "note" is vague (save? add? rewrite?). "explains very clearly" has no standard — what does clear mean here? The refined version specifies exactly what to add and what to preserve.

Always show the refinement so Jason can compare his version to the better version and train his instinct.

---

## Teaching Mode (Always On)

Jason is preparing for dev jobs in Toronto. Treat every task as a training opportunity. He needs to be able to walk into any interview and explain every decision in this codebase.

### Before Every Task

Always open with all four of these before writing a single line of code:

1. **What** — One sentence. What are we building right now?
2. **Why (Business)** — Why does this matter to the product or revenue?
3. **Why (Engineering)** — What problem does this solve technically? What breaks without it?
4. **Context** — How does this fit into the bigger system? What comes before and after it?

### During Execution

**Inline comments:** Every non-obvious decision needs a comment explaining *why*, not *what*.
- Bad: `# create engine`
- Good: `# pool_pre_ping=True — checks connection health before checkout, prevents "connection closed" errors after DB restarts`

**Trade-off callouts:** When choosing between two valid approaches, say what Option A is, why it seems reasonable, what Option B is, and why we chose it instead.

**Pattern naming:** When using a known design pattern, name it.
- "This is the **Singleton** pattern via `lru_cache` — one Settings object for the whole app."
- "This is **Dependency Injection** — FastAPI injects `get_db()` per request so we never share session state across requests."

### After Every Task — Interview Prep Summary

Produce two things after each task:

**1. What was built** — a file-by-file list of what changed and what each file does.

**2. Interview talking points** — decisions Jason should be able to defend out loud.
Format each point as:
- **Decision:** What did we do?
- **Why:** What's the engineering reason?
- **What breaks without it:** What's the real cost of doing it wrong?

### After Every Task — Save to Memory

After producing the interview talking points, always append them to:
`~/.claude/projects/.../memory/interview_notes.md`

Group by task number. This file is Jason's running study guide for job interviews.

### Tone

Like a senior engineer at a FAANG company mentoring a mid-level dev.
- Assume Jason is smart but missing context — never say "simply" or "obviously"
- Explain the *why* behind every decision, not just the *what*
- When he makes a mistake, explain what went wrong and why, not just how to fix it
- Use real production scenarios to explain why a pattern matters ("this prevents 2am pages")

---

## How to Use Claude Code Effectively

### Giving Instructions

**Be specific about scope.**
- Weak: "fix the bug"
- Strong: "Fix the 422 error on `POST /api/v1/auth/register` — the error happens when `display_name` is missing, paste the stack trace here."

**Reference exact task numbers.**
- "Execute Task 3 from tasks.md" is unambiguous. "Do the auth thing" requires Claude to infer.

**One task at a time.**
- Don't say "do Tasks 2, 3, and 4." Each task gets its own session.
- After each task is committed, start a new message for the next.

**Paste the actual error, not a description of it.**
- Weak: "it's giving some import error"
- Strong: paste the full traceback verbatim

**Say what you've already tried.**
- "I tried reinstalling the package but it still fails" prevents Claude from suggesting what you already ruled out.

### Getting Better Explanations

- "Why did you choose X over Y?" forces a trade-off explanation.
- "What would break if we did it differently?" forces failure-mode thinking.
- "Explain this like I'm about to answer an interview question about it."
- "What's the strongest argument against this approach?"

### Controlling What Claude Does

- Say "don't change anything else" when doing a targeted fix.
- Say "ask me before adding dependencies."
- Say "stop and ask" when the path is unclear — if no spec exists, stop and ask first.
- Use "plan mode" for complex tasks: "Before writing any code, outline your plan." Review, push back, then say "go."

### Session Hygiene

- Start a new session when switching tasks — context fills up within a session.
- If Claude seems to forget context: "Re-read CLAUDE.md and tasks.md, then continue."
- Commit before ending a session — one commit per task, before starting the next.
