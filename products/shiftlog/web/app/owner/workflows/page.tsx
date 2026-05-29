import Link from "next/link";
import { MOCK_WORKFLOWS, formatRelativeTime } from "@/lib/mockData";

export default function WorkflowsPage() {
  return (
    <main className="px-8 py-8 max-w-6xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">작업지시서</h1>
          <p className="text-[var(--color-text-secondary)]">
            저장된 작업지시서 {MOCK_WORKFLOWS.length}개. 알바생이 따라가는 단계와 검증 방법.
          </p>
        </div>
        <Link
          href="/owner/new"
          className="shrink-0 px-5 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-light)] transition-colors"
        >
          + 새로 만들기
        </Link>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_WORKFLOWS.map((wf) => (
          <Link
            key={wf.id}
            href={`/owner/workflows/${wf.id}`}
            className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="font-semibold text-lg leading-snug">{wf.name}</h2>
              <span className="text-xs px-2 py-1 rounded-md bg-[var(--color-accent-soft)] text-[var(--color-primary)] font-medium whitespace-nowrap">
                {wf.run_count}회
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2 leading-relaxed">
              {wf.description}
            </p>
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mb-3">
              <span>{wf.steps.length}단계</span>
              <span>·</span>
              <span>예상 {wf.estimated_duration_minutes}분</span>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-3 border-t border-[var(--color-border)]">
              <span>
                마지막 실행:{" "}
                {wf.last_run_at ? formatRelativeTime(wf.last_run_at) : "—"}
              </span>
              <span>→</span>
            </div>
          </Link>
        ))}

        <Link
          href="/owner/new"
          className="p-5 rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] flex flex-col items-center justify-center text-center transition-colors min-h-[180px]"
        >
          <div className="text-3xl mb-2">+</div>
          <p className="font-medium">새 작업지시서</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            음성/사진으로 만들기
          </p>
        </Link>
      </div>
    </main>
  );
}
