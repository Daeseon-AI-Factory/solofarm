import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  BINJO Product Landing Page                                        */
/*  Dark-theme showcase page for GitHub / resume / recruiters.        */
/*  Domain: https://binjofarm.daeseon.ai/product                      */
/* ------------------------------------------------------------------ */

export default function ProductPage() {
  return (
    <>
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <Architecture />
      <TechStack />
      <Stats />
      <Retrospective />
      <Footer />
    </>
  );
}

/* ================================================================== */
/*  NAV                                                                */
/* ================================================================== */

function Nav() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/product" className="text-xl font-bold tracking-tight">
          BINJO<span className="text-emerald-400">.</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-gray-400 md:flex">
          <a href="#how-it-works" className="transition hover:text-white">
            How It Works
          </a>
          <a href="#features" className="transition hover:text-white">
            Features
          </a>
          <a href="#architecture" className="transition hover:text-white">
            Architecture
          </a>
          <a href="#tech-stack" className="transition hover:text-white">
            Tech Stack
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/JasonAIFactory/product002_FarmManageSystem"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            GitHub
          </a>
          <Link
            href="/"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
          >
            Live Demo
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ================================================================== */
/*  HERO                                                               */
/* ================================================================== */

function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute -left-40 top-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
          AI-Powered Farm Management
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Farming is the real job.
          <br />
          <span className="text-emerald-400">Everything else runs automatically.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-400 md:text-xl">
          Voice-powered diary, receipt OCR bookkeeping, pesticide safety checks,
          and direct-to-consumer orders — all designed for use with work gloves on.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-400/30"
          >
            View Live Farm Page
          </Link>
          <a
            href="#how-it-works"
            className="rounded-xl border border-gray-700 px-8 py-3.5 text-base font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            How It Works
          </a>
        </div>

        {/* Design test callout */}
        <p className="mt-16 text-sm italic text-gray-600">
          Design test: &quot;Can you use this wearing work gloves in the
          orchard?&quot; If not, redesign.
        </p>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  HOW IT WORKS                                                       */
/* ================================================================== */

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Speak or Snap",
      desc: "Record a voice memo while walking the orchard, or snap a photo of a receipt. No typing needed.",
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      num: "02",
      title: "AI Structures It",
      desc: "Whisper transcribes, Claude parses into structured data — tasks, chemicals, weather auto-filled from the Korean Met Agency.",
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      ),
    },
    {
      num: "03",
      title: "Review & Confirm",
      desc: "Farmer reviews the parsed data on a mobile-friendly card. One tap to confirm. Done in 30 seconds.",
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <SectionLabel>How It Works</SectionLabel>
        <h2 className="mb-4 text-center text-4xl font-bold md:text-5xl">
          From voice to structured data
          <br />
          <span className="text-emerald-400">in 30 seconds</span>
        </h2>
        <p className="mx-auto mb-20 max-w-xl text-center text-gray-400">
          No apps to learn, no forms to fill. Just speak naturally in Korean
          while working — AI handles the rest.
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.num}
              className="group rounded-2xl border border-gray-800 bg-gray-900/50 p-8 transition hover:border-emerald-500/50 hover:bg-gray-900"
            >
              <div className="mb-6 flex items-center gap-4">
                <span className="text-4xl font-bold text-gray-800 transition group-hover:text-emerald-500/30">
                  {step.num}
                </span>
                <div className="text-emerald-400">{step.icon}</div>
              </div>
              <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
              <p className="leading-relaxed text-gray-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  FEATURES                                                           */
/* ================================================================== */

function Features() {
  const features = [
    {
      title: "Voice Farm Diary",
      desc: "Record while walking the orchard. Whisper STT + Claude parses tasks, chemicals, observations into structured farm logs. Supports 8 apple farming work stages.",
      badge: "Whisper + Claude",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      title: "Receipt OCR Bookkeeping",
      desc: "Snap a receipt photo — Claude Vision extracts store, items, prices, categories. Auto-generates transactions with confidence scoring. Monthly P&L with charts.",
      badge: "Claude Vision",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
    },
    {
      title: "Pesticide Safety Engine",
      desc: "Select a pesticide, system calculates safe harvest date from official Korean safety intervals. Warns before spray if the harvest window is too close.",
      badge: "Safety DB",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      title: "Weather Auto-Fill",
      desc: "Pulls real-time data from the Korean Meteorological Agency (기상청). Every farm log is auto-filled with official temperature, humidity, and sky conditions.",
      badge: "KMA API",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
        </svg>
      ),
    },
    {
      title: "Direct Orders & Payments",
      desc: "Consumer-facing brand page with product catalog. TossPayments checkout, order state machine (inquiry → paid → shipped → delivered), and shipping management.",
      badge: "TossPayments",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      ),
    },
    {
      title: "Government PDF Export",
      desc: "One-click export of farm logs in the exact format required by Korean agricultural agencies (영농일지). ReportLab with Korean font support.",
      badge: "ReportLab",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <SectionLabel>Core Features</SectionLabel>
        <h2 className="mb-4 text-center text-4xl font-bold md:text-5xl">
          Everything a solo farmer needs.
          <br />
          <span className="text-emerald-400">Nothing they don&apos;t.</span>
        </h2>
        <p className="mx-auto mb-20 max-w-xl text-center text-gray-400">
          Built for a real apple orchard — every feature solves a problem that
          was costing 30+ minutes of daily paperwork.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-gray-800 bg-gray-900/50 p-6 transition hover:border-emerald-500/50 hover:bg-gray-900"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
                  {f.icon}
                </div>
                <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
                  {f.badge}
                </span>
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  ARCHITECTURE                                                       */
/* ================================================================== */

function Architecture() {
  return (
    <section id="architecture" className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <SectionLabel>Architecture</SectionLabel>
        <h2 className="mb-4 text-center text-4xl font-bold md:text-5xl">
          Deterministic Backbone
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-center text-gray-400">
          Code handles what&apos;s predictable. AI handles what needs judgment. Every
          AI call sits behind a provider interface — swap Claude for OpenAI
          without changing a line of application code.
        </p>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Code handles */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold">Deterministic (Code)</h3>
            </div>
            <ul className="space-y-3 text-gray-400">
              {[
                "Input validation & auth",
                "Payment processing (TossPayments)",
                "Data transforms & aggregation",
                "PDF generation (ReportLab)",
                "Weather API calls (KMA)",
                "Order state machine",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="text-blue-400">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* AI handles */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold">AI (LLM)</h3>
            </div>
            <ul className="space-y-3 text-gray-400">
              {[
                "Voice → structured farm log parsing",
                "Receipt OCR → transaction extraction",
                "Agricultural term correction",
                "Financial insight generation",
                "Expense optimization suggestions",
                "Customer re-engagement alerts",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="text-purple-400">&#9632;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* System diagram */}
        <div className="mt-12 overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900/80 p-8 font-mono text-sm leading-relaxed text-gray-300">
          <pre className="whitespace-pre">
{`┌──────────────────────┐          ┌──────────────────────┐
│   Next.js Frontend   │ ───────▶ │   FastAPI Backend     │
│   React 19 + TS      │          │   Python 3.11+        │
│   Tailwind CSS v4    │          │   SQLAlchemy async     │
│   Mobile-first UI    │          │   Pydantic v2          │
└──────────────────────┘          └──────────┬─────────────┘
                                             │
                  ┌──────────────┬────────────┼────────────┬──────────────┐
                  ▼              ▼            ▼            ▼              ▼
           ┌───────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐
           │ Supabase  │  │  Claude  │ │ Whisper  │ │   Toss   │ │    KMA    │
           │ PG + S3   │  │ Vision   │ │  STT     │ │ Payments │ │  Weather  │
           └───────────┘  └──────────┘ └──────────┘ └──────────┘ └───────────┘`}
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  TECH STACK                                                         */
/* ================================================================== */

function TechStack() {
  const stack = [
    { layer: "Frontend", tech: "Next.js 16, React 19, TypeScript (strict), Tailwind CSS v4" },
    { layer: "Backend", tech: "FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic" },
    { layer: "Database", tech: "PostgreSQL (Supabase hosted)" },
    { layer: "Storage", tech: "Supabase Storage (S3-compatible) — photos, audio, receipts" },
    { layer: "AI", tech: "Claude API (structured parsing + Vision OCR), OpenAI Whisper (STT)" },
    { layer: "Payments", tech: "TossPayments (Korean payment gateway)" },
    { layer: "Task Queue", tech: "Celery + Redis (async processing with sync fallback)" },
    { layer: "Auth", tech: "JWT + Kakao OAuth" },
    { layer: "Deploy", tech: "Vercel (frontend), Docker + Railway (backend)" },
  ];

  return (
    <section id="tech-stack" className="px-6 py-32">
      <div className="mx-auto max-w-4xl">
        <SectionLabel>Tech Stack</SectionLabel>
        <h2 className="mb-16 text-center text-4xl font-bold md:text-5xl">
          Built with production tools
        </h2>

        <div className="overflow-hidden rounded-2xl border border-gray-800">
          {stack.map((row, i) => (
            <div
              key={row.layer}
              className={`flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-6 ${
                i !== stack.length - 1 ? "border-b border-gray-800" : ""
              } ${i % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/60"}`}
            >
              <span className="min-w-[100px] text-sm font-semibold text-emerald-400">
                {row.layer}
              </span>
              <span className="text-sm text-gray-300">{row.tech}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  STATS                                                              */
/* ================================================================== */

function Stats() {
  const stats = [
    { value: "130+", label: "Source Files" },
    { value: "14", label: "Database Models" },
    { value: "40+", label: "API Endpoints" },
    { value: "9", label: "Farmer Portal Pages" },
    { value: "4", label: "AI Integrations" },
    { value: "4 weeks", label: "Solo Development" },
  ];

  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <SectionLabel>Project Scale</SectionLabel>
        <h2 className="mb-16 text-center text-4xl font-bold md:text-5xl">
          Built solo. <span className="text-emerald-400">Shipped fast.</span>
        </h2>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 text-center"
            >
              <div className="mb-2 text-3xl font-bold text-emerald-400">
                {s.value}
              </div>
              <div className="text-sm text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  RETROSPECTIVE                                                      */
/* ================================================================== */

function Retrospective() {
  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-4xl">
        <SectionLabel>Honest Retrospective</SectionLabel>
        <h2 className="mb-4 text-center text-4xl font-bold md:text-5xl">
          What I&apos;d do differently
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-gray-400">
          Shipping fast means making trade-offs. Here&apos;s what I chose and why.
        </p>

        <div className="space-y-6">
          {[
            {
              title: "Photo upload is a two-step flow",
              detail:
                "Create log → upload photos separately. A single multipart request would be cleaner UX, but would require refactoring the voice pipeline. Pragmatic trade-off for an MVP.",
            },
            {
              title: "No comprehensive test suite yet",
              detail:
                "Prioritized shipping over coverage. Next step: pytest fixtures for the API + Playwright for critical farmer workflows.",
            },
            {
              title: "JSONB for photo URLs instead of normalized table",
              detail:
                "Fine for 1-10 photos per log. Would promote to a table if per-photo metadata (captions, timestamps) were needed.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-6"
            >
              <h3 className="mb-2 font-semibold text-yellow-400/90">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-400">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  FOOTER                                                             */
/* ================================================================== */

function Footer() {
  return (
    <footer className="border-t border-gray-800 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <h3 className="mb-3 text-xl font-bold">
              BINJO<span className="text-emerald-400">.</span>
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">
              AI-powered farm management platform. Built for a solo apple
              orchard in Sacheon, Gyeongnam, South Korea.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-300">
              Product
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <Link href="/" className="transition hover:text-gray-300">
                  Live Farm Page
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/JasonAIFactory/product002_FarmManageSystem"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-gray-300"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://binjo-api.up.railway.app/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-gray-300"
                >
                  API Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Author */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-300">
              Author
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li>
                <span className="text-gray-300">Jason Yoo (유대선)</span>
              </li>
              <li>Backend Engineer — 5 years MES/WMS at SK AX</li>
              <li>
                <a
                  href="https://github.com/JasonAIFactory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-gray-300"
                >
                  @JasonAIFactory
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-600">
          &copy; {new Date().getFullYear()} BINJO. First product of the AI
          Product Factory.
        </div>
      </div>
    </footer>
  );
}

/* ================================================================== */
/*  SHARED COMPONENTS                                                  */
/* ================================================================== */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 text-center">
      <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
        {children}
      </span>
    </div>
  );
}
