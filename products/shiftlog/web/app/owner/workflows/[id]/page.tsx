import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_WORKFLOWS, formatRelativeTime } from "@/lib/mockData";
import type { WorkflowStep } from "@/lib/api";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wf = MOCK_WORKFLOWS.find((w) => w.id === id);

  if (!wf) {
    notFound();
  }

  return (
    <main className="px-8 py-8 max-w-3xl">
      <Link
        href="/owner/workflows"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-6"
      >
        ← 작업지시서 목록
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{wf.name}</h1>
        <p className="text-[var(--color-text-secondary)] mb-4 leading-relaxed">
          {wf.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <span>{wf.steps.length}단계</span>
          <span>·</span>
          <span>예상 {wf.estimated_duration_minutes}분</span>
          <span>·</span>
          <span>{wf.run_count}회 실행</span>
          {wf.last_run_at && (
            <>
              <span>·</span>
              <span>마지막 실행: {formatRelativeTime(wf.last_run_at)}</span>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-light)] transition-colors"
        >
          🎙️ 음성으로 수정
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-primary)] transition-colors"
        >
          📋 복제
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-primary)] transition-colors"
        >
          👥 알바에게 할당
        </button>
        <button
          type="button"
          className="ml-auto px-4 py-2 rounded-lg text-[var(--color-danger)] text-sm font-medium hover:bg-red-50 transition-colors"
        >
          삭제
        </button>
      </div>

      <h2 className="text-lg font-semibold mb-4">작업 단계</h2>
      <ol className="space-y-3">
        {wf.steps.map((s) => (
          <StepCard key={s.order} step={s} />
        ))}
      </ol>
    </main>
  );
}

function StepCard({ step }: { step: WorkflowStep }) {
  const v = step.verification;
  let verifLabel = "✓ 자가 확인";
  let verifColor = "bg-gray-100 text-gray-700";
  if (v?.type === "photo") {
    verifLabel = "📷 사진 인증";
    verifColor = "bg-blue-100 text-blue-800";
  } else if (v?.type === "voice") {
    verifLabel = "🎙️ 음성 보고";
    verifColor = "bg-purple-100 text-purple-800";
  }

  return (
    <li className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white font-bold flex items-center justify-center">
        {step.order}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-semibold text-lg">{step.name}</h3>
          <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
            ~{step.duration_estimate_minutes}분
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3 leading-relaxed">
          {step.description}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-1 rounded-md font-medium ${verifColor}`}>
            {verifLabel}
          </span>
          {v?.type === "photo" && v.ai_check && (
            <span className="text-[var(--color-text-muted)] italic">
              검증 기준: &ldquo;{v.ai_check}&rdquo;
            </span>
          )}
          {v?.type === "voice" && v.captures && v.captures.length > 0 && (
            <span className="text-[var(--color-text-muted)] italic">
              수집: {v.captures.join(", ")}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
