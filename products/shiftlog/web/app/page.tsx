import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">☕</span>
          <span className="text-xl font-semibold tracking-tight">ShiftLog</span>
        </div>
        <span className="text-sm text-[var(--color-text-muted)] hidden sm:inline">
          카페 사장님을 위한 작업 관리
        </span>
      </header>

      <section className="flex-1 px-6 py-16 sm:py-24 max-w-3xl mx-auto w-full">
        <p className="text-sm font-medium text-[var(--color-accent)] mb-4">
          MVP · 카페 사장님 베타
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-6">
          신입 알바한테 설명하듯<br />
          폰에 말씀하시면,
        </h1>
        <h2 className="text-2xl sm:text-3xl font-medium text-[var(--color-text-secondary)] mb-10">
          우리가 작업지시서로 만들어드려요.
        </h2>

        <div className="space-y-4 mb-12 text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed">
          <p>
            매장 마감, 오픈, 청소 절차 — 신입 알바생 올 때마다 처음부터 설명하기
            지치셨죠.
          </p>
          <p>
            ShiftLog는 사장님이 평소처럼 설명한 내용을 AI가 받아 적어{" "}
            <strong className="text-[var(--color-text)]">구조화된 작업지시서</strong>로
            바꿔드립니다. 알바생은 폰으로 따라가기만 하면 됩니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/owner/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-lg shadow-sm hover:bg-[var(--color-primary-light)] transition-colors"
          >
            사장님 대시보드 열기
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/owner/new"
            className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)] font-semibold text-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors"
          >
            바로 작업지시서 만들기
          </Link>
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-6">
          <FeatureCard
            emoji="🎙️"
            title="음성으로 설명"
            body="가게 돌면서 평소대로 말씀만 하시면 끝"
          />
          <FeatureCard
            emoji="🤖"
            title="AI가 구조화"
            body="단계, 순서, 검증 포인트까지 자동 추출"
          />
          <FeatureCard
            emoji="📋"
            title="알바 폰에 작업지시서"
            body="다국적 알바생 모국어로 보고 받으세요"
          />
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
        ShiftLog · Toronto · MVP 0.1
      </footer>
    </main>
  );
}

function FeatureCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="text-3xl mb-3">{emoji}</div>
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{body}</p>
    </div>
  );
}
