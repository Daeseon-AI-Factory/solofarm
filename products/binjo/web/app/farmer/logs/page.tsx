"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  listFarmLogs,
  confirmFarmLog,
  deleteFarmLog,
  getExportUrl,
  type FarmLog,
} from "@/lib/farmerApi";

// --- Constants ---

const STAGE_EMOJI: Record<string, string> = {
  전정: "✂️",
  시비: "🌱",
  방제: "🧪",
  적화: "🌸",
  적과: "🍎",
  봉지씌우기: "📦",
  수확: "🧺",
  기타: "📝",
};

const FILTER_STAGES = [
  "전체",
  "전정",
  "시비",
  "방제",
  "적화",
  "적과",
  "수확",
  "기타",
] as const;

type DateRange = "week" | "month" | "all";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  week: "이번 주",
  month: "이번 달",
  all: "전체",
};

const KOREAN_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// --- Helpers ---

/** Format "2026-03-25" → "3월 25일 화" */
function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = KOREAN_DAYS[date.getDay()];
  return `${month}월 ${day}일 ${dayOfWeek}`;
}

/** Get start of current week (Monday) as YYYY-MM-DD */
function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  // Monday = 1, Sunday = 0 → shift Sunday to 7
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

/** Get start of current month as YYYY-MM-DD */
function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Extract weather summary from official weather data */
function getWeatherSummary(
  weatherOfficial: Record<string, unknown> | null,
  weatherFarmer: string | null
): string | null {
  if (weatherOfficial) {
    const temp = weatherOfficial.temperature;
    const sky = weatherOfficial.sky || weatherOfficial.summary;
    if (temp !== null && temp !== undefined) {
      const skyIcon =
        sky === "맑음"
          ? "☀️"
          : sky === "흐림"
            ? "☁️"
            : sky === "비"
              ? "🌧️"
              : "🌤️";
      return `${skyIcon} ${temp}°C`;
    }
  }
  if (weatherFarmer) return `🌤️ ${weatherFarmer}`;
  return null;
}

// --- Component ---

export default function LogsPage() {
  const router = useRouter();

  // Data state
  const [logs, setLogs] = useState<FarmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [activeStage, setActiveStage] = useState<string>("전체");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  // Detail bottom sheet
  const [selectedLog, setSelectedLog] = useState<FarmLog | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Ref for scrollable filter chips
  const chipScrollRef = useRef<HTMLDivElement>(null);

  // --- Data fetching ---

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFarmLogs();
      setLogs(data.logs);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "기록을 불러오지 못했습니다";
      setError(message);
      console.error("[LogsPage] Failed to fetch logs:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // --- Filtering ---

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by task stage
    if (activeStage !== "전체") {
      result = result.filter((log) =>
        log.tasks.some((t) => t.stage === activeStage)
      );
    }

    // Filter by date range
    if (dateRange !== "all") {
      const cutoff = dateRange === "week" ? getWeekStart() : getMonthStart();
      result = result.filter((log) => log.log_date >= cutoff);
    }

    // Sort by date descending (newest first)
    return [...result].sort((a, b) => b.log_date.localeCompare(a.log_date));
  }, [logs, activeStage, dateRange]);

  // --- Stats ---

  const stats = useMemo(() => {
    const taskCounts: Record<string, number> = {};
    let chemicalCount = 0;

    filteredLogs.forEach((log) => {
      log.tasks.forEach((t) => {
        taskCounts[t.stage] = (taskCounts[t.stage] || 0) + 1;
      });
      chemicalCount += log.chemicals.length;
    });

    const topTask = Object.entries(taskCounts).sort(
      ([, a], [, b]) => b - a
    )[0];

    return {
      totalLogs: filteredLogs.length,
      totalTasks: Object.values(taskCounts).reduce((s, c) => s + c, 0),
      chemicalCount,
      topTask: topTask ? topTask[0] : null,
    };
  }, [filteredLogs]);

  // --- Actions ---

  const handleConfirm = async (id: string) => {
    setActionLoading(true);
    try {
      await confirmFarmLog(id);
      await fetchLogs();
      setSelectedLog(null);
    } catch (err) {
      console.error("[LogsPage] Failed to confirm log:", err);
    }
    setActionLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 기록을 삭제하시겠습니까?")) return;
    setActionLoading(true);
    try {
      await deleteFarmLog(id);
      await fetchLogs();
      setSelectedLog(null);
    } catch (err) {
      console.error("[LogsPage] Failed to delete log:", err);
    }
    setActionLoading(false);
  };

  const handleExport = () => {
    if (logs.length === 0) return;
    const dates = logs.map((l) => l.log_date).sort();
    const url = getExportUrl(dates[0], dates[dates.length - 1]);
    window.open(url, "_blank");
  };

  // --- Render ---

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#F5F1EC" }}>
      {/* Header */}
      <div className="sticky top-0 z-30" style={{ backgroundColor: "#F5F1EC" }}>
        <div className="px-4 pt-4 pb-2 max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-xl font-bold"
                style={{ color: "#2D5016" }}
              >
                영농일지
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#6B6B6B" }}>
                총 {logs.length}건의 기록
              </p>
            </div>
            {logs.length > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition-colors"
                style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
              >
                <span>📄</span>
                <span>PDF 출력</span>
              </button>
            )}
          </div>

          {/* Stats bar — only show when there are logs */}
          {filteredLogs.length > 0 && (
            <div
              className="flex items-center gap-3 mt-3 px-3 py-2 rounded-xl text-xs"
              style={{ backgroundColor: "#FFFFFF", color: "#6B6B6B" }}
            >
              <span>
                📋 <strong style={{ color: "#1A1A1A" }}>{stats.totalLogs}</strong>건
              </span>
              <span style={{ color: "#E5E2DB" }}>|</span>
              <span>
                🔧 작업{" "}
                <strong style={{ color: "#1A1A1A" }}>{stats.totalTasks}</strong>개
              </span>
              {stats.chemicalCount > 0 && (
                <>
                  <span style={{ color: "#E5E2DB" }}>|</span>
                  <span>
                    💊 농약{" "}
                    <strong style={{ color: "#1A1A1A" }}>
                      {stats.chemicalCount}
                    </strong>
                    건
                  </span>
                </>
              )}
              {stats.topTask && (
                <>
                  <span style={{ color: "#E5E2DB" }}>|</span>
                  <span>
                    {STAGE_EMOJI[stats.topTask] || "📝"} {stats.topTask} 최다
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Filter chips — horizontal scroll */}
        <div className="max-w-lg mx-auto">
          <div
            ref={chipScrollRef}
            className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {FILTER_STAGES.map((stage) => {
              const isActive = activeStage === stage;
              return (
                <button
                  key={stage}
                  onClick={() => setActiveStage(stage)}
                  className="shrink-0 px-4 py-2.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: isActive ? "#2D5016" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#6B6B6B",
                    border: isActive ? "none" : "1px solid #E5E2DB",
                  }}
                >
                  {stage !== "전체" && (
                    <span className="mr-1">{STAGE_EMOJI[stage]}</span>
                  )}
                  {stage}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date range toggle */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div
            className="inline-flex rounded-lg overflow-hidden"
            style={{ border: "1px solid #E5E2DB" }}
          >
            {(["week", "month", "all"] as DateRange[]).map((range) => {
              const isActive = dateRange === range;
              return (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className="px-4 py-2.5 text-xs font-medium transition-all"
                  style={{
                    backgroundColor: isActive ? "#2D5016" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "#6B6B6B",
                  }}
                >
                  {DATE_RANGE_LABELS[range]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="px-4 max-w-lg mx-auto">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mb-3"
              style={{ borderColor: "#2D5016", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "#9B9B9B" }}>
              기록을 불러오는 중...
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div
            className="rounded-xl p-4 text-center mt-4"
            style={{ backgroundColor: "#FEF3E2" }}
          >
            <p className="text-sm mb-2" style={{ color: "#D4421E" }}>
              {error}
            </p>
            <button
              onClick={fetchLogs}
              className="text-xs px-5 py-3 rounded-lg font-medium text-white"
              style={{ backgroundColor: "#2D5016", minHeight: "44px" }}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🌳</div>
            <p
              className="text-base font-semibold mb-1"
              style={{ color: "#2D5016" }}
            >
              아직 기록이 없어요
            </p>
            <p className="text-sm mb-6" style={{ color: "#9B9B9B" }}>
              오늘 하신 농작업을 음성으로 기록해 보세요
            </p>
            <button
              onClick={() => router.push("/farmer/record")}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-transform active:scale-95"
              style={{ backgroundColor: "#2D5016" }}
            >
              첫 기록 남기기
            </button>
          </div>
        )}

        {/* Empty filtered state — logs exist but filter matches nothing */}
        {!loading && !error && logs.length > 0 && filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm" style={{ color: "#9B9B9B" }}>
              조건에 맞는 기록이 없습니다
            </p>
            <button
              onClick={() => {
                setActiveStage("전체");
                setDateRange("all");
              }}
              className="mt-3 text-xs px-5 py-3 rounded-lg font-medium"
              style={{ backgroundColor: "#EDF4E8", color: "#2D5016", minHeight: "44px" }}
            >
              필터 초기화
            </button>
          </div>
        )}

        {/* Log cards */}
        {!loading &&
          !error &&
          filteredLogs.map((log) => {
            const weather = getWeatherSummary(
              log.weather_official,
              log.weather_farmer
            );
            const chemCount = log.chemicals.length;
            const uniqueStages = [
              ...new Set(log.tasks.map((t) => t.stage)),
            ];

            return (
              <button
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="w-full text-left rounded-2xl p-4 mb-3 transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                {/* Top row: date + status */}
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "#1A1A1A" }}
                  >
                    {formatDateKorean(log.log_date)}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor:
                        log.status === "confirmed" ? "#EDF4E8" : "#FEF3E2",
                      color:
                        log.status === "confirmed" ? "#2D5016" : "#B8860B",
                    }}
                  >
                    {log.status === "confirmed" ? "확인됨" : "임시"}
                  </span>
                </div>

                {/* Task emoji chips */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {uniqueStages.map((stage) => (
                    <span
                      key={stage}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ backgroundColor: "#F5F1EC", color: "#4A4A4A" }}
                    >
                      <span>{STAGE_EMOJI[stage] || "📝"}</span>
                      <span>{stage}</span>
                    </span>
                  ))}
                </div>

                {/* Meta row: chemicals + weather */}
                {(chemCount > 0 || weather) && (
                  <div className="flex items-center gap-3 mb-2">
                    {chemCount > 0 && (
                      <span
                        className="text-xs"
                        style={{ color: "#8B6914" }}
                      >
                        💊 농약 {chemCount}종
                      </span>
                    )}
                    {weather && (
                      <span
                        className="text-xs"
                        style={{ color: "#6B6B6B" }}
                      >
                        {weather}
                      </span>
                    )}
                  </div>
                )}

                {/* Notes preview */}
                {log.notes && (
                  <p
                    className="text-xs line-clamp-2 leading-relaxed"
                    style={{ color: "#9B9B9B" }}
                  >
                    {log.notes}
                  </p>
                )}
              </button>
            );
          })}
      </div>

      {/* Floating action button */}
      <button
        onClick={() => router.push("/farmer/record")}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-lg transition-transform active:scale-90 z-20"
        style={{ backgroundColor: "#2D5016" }}
        aria-label="새 기록 추가"
      >
        +
      </button>

      {/* Bottom sheet detail modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => !actionLoading && setSelectedLog(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Sheet */}
          <div
            className="relative w-full max-w-lg rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up"
            style={{ backgroundColor: "#FFFFFF" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag indicator */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: "#E5E2DB" }}
              />
            </div>

            {/* Header */}
            <div
              className="px-4 pb-3 flex items-center justify-between border-b"
              style={{ borderColor: "#F0EDE8" }}
            >
              <div>
                <h3
                  className="text-base font-bold"
                  style={{ color: "#2D5016" }}
                >
                  {formatDateKorean(selectedLog.log_date)}
                </h3>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor:
                      selectedLog.status === "confirmed"
                        ? "#EDF4E8"
                        : "#FEF3E2",
                    color:
                      selectedLog.status === "confirmed"
                        ? "#2D5016"
                        : "#B8860B",
                  }}
                >
                  {selectedLog.status === "confirmed" ? "✓ 확인됨" : "임시저장"}
                </span>
              </div>
              <button
                onClick={() => !actionLoading && setSelectedLog(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full"
                style={{ backgroundColor: "#F5F1EC", color: "#9B9B9B" }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Tasks */}
              <div>
                <p
                  className="text-xs font-semibold mb-2 uppercase tracking-wide"
                  style={{ color: "#9B9B9B" }}
                >
                  작업 내용
                </p>
                <div className="space-y-2">
                  {selectedLog.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 rounded-xl p-3"
                      style={{ backgroundColor: "#F5F1EC" }}
                    >
                      <span className="text-lg mt-0.5">
                        {STAGE_EMOJI[task.stage] || "📝"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "#1A1A1A" }}
                          >
                            {task.stage}
                          </span>
                          {task.duration_hours && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: "#FFFFFF",
                                color: "#6B6B6B",
                              }}
                            >
                              {task.duration_hours}시간
                            </span>
                          )}
                        </div>
                        {task.detail && (
                          <p
                            className="text-xs mt-0.5 leading-relaxed"
                            style={{ color: "#6B6B6B" }}
                          >
                            {task.detail}
                          </p>
                        )}
                        {task.field_name && (
                          <p
                            className="text-xs mt-1"
                            style={{ color: "#9B9B9B" }}
                          >
                            📍 {task.field_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chemicals */}
              {selectedLog.chemicals.length > 0 && (
                <div>
                  <p
                    className="text-xs font-semibold mb-2 uppercase tracking-wide"
                    style={{ color: "#9B9B9B" }}
                  >
                    농약 · 비료
                  </p>
                  <div className="space-y-1.5">
                    {selectedLog.chemicals.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 text-sm rounded-xl p-3"
                        style={{ backgroundColor: "#FEF3E2" }}
                      >
                        <span>{c.type === "농약" ? "🧪" : "🌱"}</span>
                        <div className="flex-1 min-w-0">
                          <span
                            className="font-medium"
                            style={{ color: "#1A1A1A" }}
                          >
                            {c.name}
                          </span>
                          {c.amount && (
                            <span
                              className="text-xs ml-2"
                              style={{ color: "#8B6914" }}
                            >
                              {c.amount}
                            </span>
                          )}
                          {c.action && (
                            <span
                              className="text-xs ml-2"
                              style={{ color: "#9B9B9B" }}
                            >
                              · {c.action}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weather */}
              {(selectedLog.weather_official || selectedLog.weather_farmer) && (
                <div>
                  <p
                    className="text-xs font-semibold mb-2 uppercase tracking-wide"
                    style={{ color: "#9B9B9B" }}
                  >
                    날씨
                  </p>
                  <div
                    className="rounded-xl p-3 space-y-1"
                    style={{ backgroundColor: "#F0F7FF" }}
                  >
                    {selectedLog.weather_official && (
                      <p className="text-sm" style={{ color: "#1A1A1A" }}>
                        🌡️ 공식:{" "}
                        {typeof selectedLog.weather_official.temperature ===
                        "number"
                          ? `${selectedLog.weather_official.temperature}°C`
                          : ""}{" "}
                        {selectedLog.weather_official.sky
                          ? String(selectedLog.weather_official.sky)
                          : ""}
                        {typeof selectedLog.weather_official.humidity ===
                        "number"
                          ? ` · 습도 ${selectedLog.weather_official.humidity}%`
                          : ""}
                      </p>
                    )}
                    {selectedLog.weather_farmer && (
                      <p className="text-sm" style={{ color: "#6B6B6B" }}>
                        🧑‍🌾 체감: {selectedLog.weather_farmer}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedLog.notes && (
                <div>
                  <p
                    className="text-xs font-semibold mb-2 uppercase tracking-wide"
                    style={{ color: "#9B9B9B" }}
                  >
                    메모
                  </p>
                  <p
                    className="text-sm leading-relaxed rounded-xl p-3"
                    style={{ backgroundColor: "#F5F1EC", color: "#4A4A4A" }}
                  >
                    {selectedLog.notes}
                  </p>
                </div>
              )}

              {/* Photos */}
              {selectedLog.photo_urls && selectedLog.photo_urls.length > 0 && (
                <div>
                  <p
                    className="text-xs font-semibold mb-2 uppercase tracking-wide"
                    style={{ color: "#9B9B9B" }}
                  >
                    사진 ({selectedLog.photo_urls.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLog.photo_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-20 h-20 rounded-xl overflow-hidden"
                      >
                        <img
                          src={url}
                          alt={`사진 ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div
              className="p-4 border-t flex gap-3"
              style={{ borderColor: "#F0EDE8" }}
            >
              <button
                onClick={() => handleDelete(selectedLog.id)}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#F5F1EC", color: "#D4421E" }}
              >
                삭제
              </button>
              <button
                onClick={() =>
                  router.push(`/farmer/record?edit=${selectedLog.id}`)
                }
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
              >
                수정
              </button>
              {selectedLog.status === "draft" && (
                <button
                  onClick={() => handleConfirm(selectedLog.id)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "#2D5016" }}
                >
                  {actionLoading ? "처리 중..." : "✓ 확인 완료"}
                </button>
              )}
              {selectedLog.status === "confirmed" && (
                <span
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center"
                  style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                >
                  ✓ 확인 완료
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS for slide-up animation and scrollbar hiding */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
