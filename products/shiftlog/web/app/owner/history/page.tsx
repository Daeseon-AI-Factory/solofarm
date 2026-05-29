import { MOCK_EXECUTIONS, formatRelativeTime, formatTime } from "@/lib/mockData";

export default function HistoryPage() {
  // Sort by started_at desc — most recent first
  const sorted = [...MOCK_EXECUTIONS].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );

  return (
    <main className="px-8 py-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">진행 이력</h1>
        <p className="text-[var(--color-text-secondary)]">
          누가 언제 어떤 작업지시서를 진행했는지 — 음성과 사진 증빙 포함.
        </p>
      </header>

      <div className="flex gap-2 mb-6 text-sm">
        <FilterChip label="전체" count={sorted.length} active />
        <FilterChip label="완료" count={sorted.filter((e) => e.status === "completed").length} />
        <FilterChip label="진행 중" count={sorted.filter((e) => e.status === "in_progress").length} />
        <FilterChip
          label="확인 필요"
          count={sorted.filter((e) => e.status === "flagged").length}
        />
      </div>

      <div className="space-y-3">
        {sorted.map((exec) => (
          <ExecutionRow key={exec.id} exec={exec} />
        ))}
      </div>
    </main>
  );
}

function FilterChip({
  label,
  count,
  active,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <button
      className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]"
      }`}
    >
      {label}
      <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-[var(--color-text-muted)]"}`}>
        {count}
      </span>
    </button>
  );
}

function ExecutionRow({ exec }: { exec: (typeof MOCK_EXECUTIONS)[number] }) {
  const statusBadge = {
    completed: { label: "완료", color: "bg-green-100 text-green-800" },
    in_progress: { label: "진행 중", color: "bg-blue-100 text-blue-800 animate-pulse" },
    flagged: { label: "확인 필요", color: "bg-red-100 text-red-800" },
  }[exec.status];

  return (
    <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{exec.workflow_name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {exec.alba_name} · {formatTime(exec.started_at)} 시작
            {exec.completed_at && ` · ${formatTime(exec.completed_at)} 완료`}
          </p>
        </div>
        <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
          {formatRelativeTime(exec.started_at)}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
          <div
            className={`h-full ${
              exec.status === "flagged"
                ? "bg-[var(--color-danger)]"
                : exec.status === "in_progress"
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-success)]"
            }`}
            style={{ width: `${(exec.completed_steps / exec.total_steps) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {exec.completed_steps}/{exec.total_steps}단계
        </span>
      </div>

      {exec.flagged_steps.length > 0 && (
        <div className="text-sm text-[var(--color-danger)] bg-red-50 px-3 py-2 rounded-lg">
          <span className="font-medium">검증 실패:</span> {exec.flagged_steps.join(", ")}
        </div>
      )}
    </div>
  );
}
