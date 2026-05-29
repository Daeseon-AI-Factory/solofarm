import Link from "next/link";
import {
  MOCK_EXECUTIONS,
  MOCK_STATS,
  MOCK_WORKFLOWS,
  formatRelativeTime,
  formatTime,
} from "@/lib/mockData";

export default function DashboardPage() {
  const flaggedRecent = MOCK_EXECUTIONS.filter((e) => e.status === "flagged").slice(0, 3);
  const inProgress = MOCK_EXECUTIONS.filter((e) => e.status === "in_progress");
  const recentCompleted = MOCK_EXECUTIONS.filter((e) => e.status === "completed").slice(0, 4);

  return (
    <main className="px-8 py-8 max-w-6xl">
      <header className="mb-8">
        <p className="text-sm text-[var(--color-text-muted)] mb-1">2026년 5월 26일 화요일</p>
        <h1 className="text-3xl font-bold tracking-tight">안녕하세요, 사장님</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          오늘 가게에서 일어나고 있는 일이에요.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="오늘의 시프트" value={MOCK_STATS.shifts_today} unit="개" />
        <StatCard label="진행 중" value={MOCK_STATS.shifts_in_progress} unit="명" highlight />
        <StatCard label="완료" value={MOCK_STATS.shifts_completed_today} unit="건" />
        <StatCard
          label="확인 필요"
          value={MOCK_STATS.items_flagged_today}
          unit="건"
          danger={MOCK_STATS.items_flagged_today > 0}
        />
      </section>

      {flaggedRecent.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>⚠️</span> 확인이 필요한 항목
          </h2>
          <div className="space-y-2">
            {flaggedRecent.map((exec) => (
              <Link
                key={exec.id}
                href={`/owner/history`}
                className="block p-4 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-red-900">
                      {exec.alba_name} · {exec.workflow_name}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      검증 실패: {exec.flagged_steps.join(", ")}
                    </p>
                  </div>
                  <span className="text-xs text-red-700 whitespace-nowrap">
                    {formatRelativeTime(exec.started_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-6 mb-10">
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>🟢</span> 지금 진행 중
          </h2>
          {inProgress.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-[var(--color-border)] text-center text-sm text-[var(--color-text-muted)]">
              진행 중인 시프트가 없어요
            </div>
          ) : (
            <div className="space-y-2">
              {inProgress.map((exec) => (
                <div
                  key={exec.id}
                  className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium">{exec.alba_name}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {exec.workflow_name}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatTime(exec.started_at)} 시작
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-[var(--color-bg)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-success)]"
                        style={{
                          width: `${(exec.completed_steps / exec.total_steps) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                      {exec.completed_steps}/{exec.total_steps}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>✅</span> 최근 완료
          </h2>
          <div className="space-y-2">
            {recentCompleted.map((exec) => (
              <div
                key={exec.id}
                className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">{exec.workflow_name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {exec.alba_name}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  {formatRelativeTime(exec.started_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>📋</span> 자주 쓰는 작업지시서
          </h2>
          <Link
            href="/owner/workflows"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {MOCK_WORKFLOWS.slice(0, 3).map((wf) => (
            <Link
              key={wf.id}
              href={`/owner/workflows/${wf.id}`}
              className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors"
            >
              <p className="font-semibold">{wf.name}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {wf.steps.length}단계 · 예상 {wf.estimated_duration_minutes}분
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                {wf.run_count}회 실행
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  unit,
  highlight,
  danger,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  const colorClass = danger
    ? "text-[var(--color-danger)]"
    : highlight
      ? "text-[var(--color-accent)]"
      : "text-[var(--color-text)]";
  return (
    <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <p className="text-sm text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorClass}`}>
        {value}
        <span className="text-base font-normal text-[var(--color-text-muted)] ml-1">{unit}</span>
      </p>
    </div>
  );
}
