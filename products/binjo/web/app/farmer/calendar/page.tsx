"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listFarmLogs, type FarmLog } from "@/lib/farmerApi";

// --- Constants ---

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** Map task stage names to emoji indicators */
const STAGE_EMOJI: Record<string, string> = {
  전정: "✂️",
  시비: "🌱",
  방제: "💊",
  적화: "🌸",
  적과: "🍎",
  봉지씌우기: "📦",
  수확: "🧺",
  관수: "💧",
  기타: "📝",
};

// --- Helpers ---

/** Format a Date as YYYY-MM-DD (local time, no timezone shift) */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Number of days in a given month (1-indexed month) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Day of week for the 1st of a month (0=Sun, 6=Sat) */
function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** Get today's date key */
function todayKey(): string {
  return toDateKey(new Date());
}

/** Group an array of FarmLogs by their log_date */
function groupLogsByDate(logs: FarmLog[]): Map<string, FarmLog[]> {
  const map = new Map<string, FarmLog[]>();
  for (const log of logs) {
    const key = log.log_date; // already YYYY-MM-DD from API
    const existing = map.get(key);
    if (existing) {
      existing.push(log);
    } else {
      map.set(key, [log]);
    }
  }
  return map;
}

/** Collect unique stage emojis from a list of logs */
function getStageEmojis(logs: FarmLog[]): string[] {
  const seen = new Set<string>();
  const emojis: string[] = [];
  for (const log of logs) {
    for (const task of log.tasks) {
      const emoji = STAGE_EMOJI[task.stage] ?? STAGE_EMOJI["기타"];
      if (!seen.has(emoji)) {
        seen.add(emoji);
        emojis.push(emoji);
      }
    }
  }
  return emojis;
}

/** Count occurrences of each task stage across all logs in a month */
function countStages(logs: FarmLog[]): { stage: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    for (const task of log.tasks) {
      counts.set(task.stage, (counts.get(task.stage) ?? 0) + 1);
    }
  }
  // Sort by count descending so the most frequent tasks appear first
  return Array.from(counts.entries())
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);
}

// --- Component ---

export default function CalendarPage() {
  const router = useRouter();

  // Current viewed month
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  // Data
  const [logs, setLogs] = useState<FarmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected day for bottom sheet
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // --- Fetch logs when month changes ---
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = daysInMonth(year, month);
      const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const result = await listFarmLogs(dateFrom, dateTo);
      setLogs(result.logs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "데이터를 불러오지 못했습니다";
      console.error("[CalendarPage] Failed to fetch logs:", err);
      setError(msg);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Close bottom sheet when month changes
  useEffect(() => {
    setSelectedDate(null);
  }, [year, month]);

  // --- Derived data ---
  const logsByDate = useMemo(() => groupLogsByDate(logs), [logs]);
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfWeek(year, month);
  const today = todayKey();

  const workDays = logsByDate.size;
  const stageCounts = useMemo(() => countStages(logs), [logs]);

  // Logs for the selected day (bottom sheet)
  const selectedLogs = selectedDate ? logsByDate.get(selectedDate) ?? [] : [];

  // --- Navigation ---
  const goToPrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  // --- Build calendar grid cells ---
  const calendarCells: (number | null)[] = [];
  // Leading empty cells for days before the 1st
  for (let i = 0; i < startDay; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(d);
  }
  // Trailing empty cells to complete the last row
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
      {/* ---- Month Navigation ---- */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold"
          style={{ color: "#2D5016" }}
          aria-label="이전 달"
        >
          ◀
        </button>
        <h2 className="text-lg font-bold" style={{ color: "#2D5016" }}>
          {year}년 {month}월
        </h2>
        <button
          onClick={goToNextMonth}
          className="w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold"
          style={{ color: "#2D5016" }}
          aria-label="다음 달"
        >
          ▶
        </button>
      </div>

      {/* ---- Calendar Grid ---- */}
      {loading ? (
        <div
          className="flex items-center justify-center py-20 rounded-xl"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <p className="text-sm" style={{ color: "#9B9B9B" }}>
            불러오는 중...
          </p>
        </div>
      ) : error ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: "#FFF5F5" }}
        >
          <p className="text-sm mb-3" style={{ color: "#C53030" }}>
            {error}
          </p>
          <button
            onClick={fetchLogs}
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ backgroundColor: "#2D5016", color: "#FFFFFF" }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          {/* Day-of-week header row */}
          <div className="grid grid-cols-7 text-center text-xs font-medium py-2 border-b" style={{ borderColor: "#E5E2DB" }}>
            {DAY_LABELS.map((label, i) => (
              <span
                key={label}
                style={{
                  // Sunday red, Saturday blue, rest neutral
                  color: i === 0 ? "#C53030" : i === 6 ? "#2B6CB0" : "#6B6B6B",
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7">
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-16" />;
              }

              const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayLogs = logsByDate.get(dateKey);
              const hasLogs = !!dayLogs && dayLogs.length > 0;
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedDate;
              const emojis = hasLogs ? getStageEmojis(dayLogs) : [];
              const dayOfWeek = (startDay + day - 1) % 7; // 0=Sun

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className="h-16 flex flex-col items-center pt-1.5 relative transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? "#EDF4E8"
                      : hasLogs
                        ? "#FAFAF5"
                        : "transparent",
                    // Today ring uses box-shadow to avoid layout shift
                    boxShadow: isToday ? "inset 0 0 0 2px #2D5016" : "none",
                    borderRadius: isToday || isSelected ? "8px" : "0",
                  }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: dayOfWeek === 0 ? "#C53030" : dayOfWeek === 6 ? "#2B6CB0" : "#333",
                    }}
                  >
                    {day}
                  </span>
                  {/* Emoji indicators — show up to 3, then "+" */}
                  {hasLogs && (
                    <div className="flex flex-wrap justify-center gap-0 mt-0.5 leading-none">
                      {emojis.slice(0, 3).map((emoji, eIdx) => (
                        <span key={eIdx} className="text-[10px]">
                          {emoji}
                        </span>
                      ))}
                      {emojis.length > 3 && (
                        <span className="text-[8px]" style={{ color: "#9B9B9B" }}>
                          +{emojis.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Month Summary Bar ---- */}
      {!loading && !error && (
        <div
          className="mt-4 rounded-xl p-4 shadow-sm"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold" style={{ color: "#2D5016" }}>
              이달 요약
            </h3>
            <span className="text-xs" style={{ color: "#6B6B6B" }}>
              작업일 {workDays}일 / {totalDays}일
            </span>
          </div>

          {stageCounts.length === 0 ? (
            <p className="text-xs" style={{ color: "#9B9B9B" }}>
              이번 달 기록이 없습니다
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stageCounts.map(({ stage, count }) => (
                <span
                  key={stage}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
                >
                  <span>{STAGE_EMOJI[stage] ?? "📝"}</span>
                  {stage} {count}회
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Bottom Sheet: Day Detail ---- */}
      {selectedDate && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
            onClick={() => setSelectedDate(null)}
          />

          {/* Sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl max-h-[70vh] overflow-y-auto shadow-xl"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: "#D1D1D1" }}
              />
            </div>

            <div className="px-5 pb-6">
              {/* Date header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color: "#2D5016" }}>
                  {parseInt(selectedDate.split("-")[1])}월{" "}
                  {parseInt(selectedDate.split("-")[2])}일 기록
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ color: "#9B9B9B", backgroundColor: "#F5F1EC" }}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              {selectedLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm mb-4" style={{ color: "#9B9B9B" }}>
                    이 날의 기록이 없습니다
                  </p>
                  <button
                    onClick={() => router.push("/farmer/record")}
                    className="text-sm px-5 py-3 rounded-xl font-medium"
                    style={{ backgroundColor: "#2D5016", color: "#FFFFFF", minHeight: "44px" }}
                  >
                    기록 추가
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl p-4"
                      style={{ backgroundColor: "#FAFAF5" }}
                    >
                      {/* Tasks */}
                      {log.tasks.length > 0 && (
                        <div className="mb-3">
                          <p
                            className="text-xs font-medium mb-1.5"
                            style={{ color: "#6B6B6B" }}
                          >
                            작업 내용
                          </p>
                          <div className="space-y-1.5">
                            {log.tasks.map((task) => (
                              <div key={task.id} className="flex items-start gap-2">
                                <span className="text-sm">
                                  {STAGE_EMOJI[task.stage] ?? "📝"}
                                </span>
                                <div>
                                  <span
                                    className="text-sm font-medium"
                                    style={{ color: "#333" }}
                                  >
                                    {task.stage}
                                  </span>
                                  {task.field_name && (
                                    <span
                                      className="text-xs ml-1.5"
                                      style={{ color: "#9B9B9B" }}
                                    >
                                      ({task.field_name})
                                    </span>
                                  )}
                                  {task.detail && (
                                    <p
                                      className="text-xs mt-0.5"
                                      style={{ color: "#6B6B6B" }}
                                    >
                                      {task.detail}
                                    </p>
                                  )}
                                  {task.duration_hours && (
                                    <p
                                      className="text-xs"
                                      style={{ color: "#9B9B9B" }}
                                    >
                                      {task.duration_hours}시간
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chemicals */}
                      {log.chemicals.length > 0 && (
                        <div className="mb-3">
                          <p
                            className="text-xs font-medium mb-1.5"
                            style={{ color: "#6B6B6B" }}
                          >
                            농약 / 비료
                          </p>
                          <div className="space-y-1">
                            {log.chemicals.map((chem) => (
                              <div
                                key={chem.id}
                                className="text-xs flex items-center gap-1.5"
                                style={{ color: "#333" }}
                              >
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{
                                    backgroundColor:
                                      chem.type === "농약" ? "#FED7D7" : "#C6F6D5",
                                    color:
                                      chem.type === "농약" ? "#C53030" : "#276749",
                                  }}
                                >
                                  {chem.type}
                                </span>
                                <span className="font-medium">{chem.name}</span>
                                {chem.amount && (
                                  <span style={{ color: "#9B9B9B" }}>
                                    {chem.amount}
                                  </span>
                                )}
                                {chem.action && (
                                  <span style={{ color: "#9B9B9B" }}>
                                    · {chem.action}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Weather */}
                      {(log.weather_official || log.weather_farmer) && (
                        <div className="mb-3">
                          <p
                            className="text-xs font-medium mb-1"
                            style={{ color: "#6B6B6B" }}
                          >
                            날씨
                          </p>
                          {log.weather_official && (
                            <p className="text-xs" style={{ color: "#333" }}>
                              {(log.weather_official as { summary?: string })
                                .summary ??
                                JSON.stringify(log.weather_official)}
                            </p>
                          )}
                          {log.weather_farmer && (
                            <p className="text-xs" style={{ color: "#6B6B6B" }}>
                              농부 관측: {log.weather_farmer}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {log.notes && (
                        <div>
                          <p
                            className="text-xs font-medium mb-1"
                            style={{ color: "#6B6B6B" }}
                          >
                            메모
                          </p>
                          <p className="text-xs" style={{ color: "#333" }}>
                            {log.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add record button inside bottom sheet */}
                  <button
                    onClick={() => router.push("/farmer/record")}
                    className="w-full text-sm py-3 rounded-xl font-medium"
                    style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
                  >
                    기록 추가
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---- Floating Quick-Add Button ---- */}
      <button
        onClick={() => router.push("/farmer/record")}
        className="fixed z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold"
        style={{
          backgroundColor: "#2D5016",
          color: "#FFFFFF",
          bottom: "5rem", // above bottom nav
          right: "1.25rem",
        }}
        aria-label="오늘 기록하기"
      >
        +
      </button>
    </div>
  );
}
