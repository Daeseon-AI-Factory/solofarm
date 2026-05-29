import { MOCK_ALBA, formatRelativeTime, languageLabel } from "@/lib/mockData";

export default function TeamPage() {
  return (
    <main className="px-8 py-8 max-w-5xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">알바 관리</h1>
          <p className="text-[var(--color-text-secondary)]">
            등록된 알바 {MOCK_ALBA.length}명. 작업지시서가 알바 모국어로 표시돼요.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 px-5 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-light)] transition-colors"
        >
          + 알바 추가
        </button>
      </header>

      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            <tr>
              <th className="text-left px-5 py-3 font-medium">이름</th>
              <th className="text-left px-5 py-3 font-medium">선호 언어</th>
              <th className="text-left px-5 py-3 font-medium">현재 시프트</th>
              <th className="text-right px-5 py-3 font-medium">총 시프트</th>
              <th className="text-right px-5 py-3 font-medium">합류일</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ALBA.map((alba, i) => (
              <tr
                key={alba.id}
                className={i > 0 ? "border-t border-[var(--color-border)]" : ""}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-primary)] font-semibold flex items-center justify-center">
                      {alba.name.slice(0, 1)}
                    </div>
                    <span className="font-medium">{alba.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                  {languageLabel(alba.preferred_language)}
                </td>
                <td className="px-5 py-4">
                  {alba.current_shift ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                      {alba.current_shift}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right font-medium">{alba.total_shifts}회</td>
                <td className="px-5 py-4 text-right text-[var(--color-text-muted)]">
                  {formatRelativeTime(alba.joined_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-[var(--color-text-muted)]">
        알바는 QR 코드 한 번 스캔으로 폰에서 본인 작업지시서를 받습니다 — 앱 설치 불필요.
      </p>
    </main>
  );
}
