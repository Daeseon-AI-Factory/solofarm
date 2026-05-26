"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listFarmLogs,
  getCurrentWeather,
  type FarmLog,
  type WeatherData,
} from "@/lib/farmerApi";

/**
 * Farmer dashboard — main hub after login.
 * Shows: weather, quick record, weekly stats, task summary, recent logs, alerts.
 */

const STAGE_EMOJI: Record<string, string> = {
  전정: "✂️", 시비: "🌱", 방제: "💊", 적화: "🌸",
  적과: "🍎", 봉지씌우기: "📦", 수확: "🧺", 관수: "💧", 기타: "📝",
};

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

export default function FarmerDashboard() {
  const router = useRouter();
  const [weekLogs, setWeekLogs] = useState<FarmLog[]>([]);
  const [monthLogs, setMonthLogs] = useState<FarmLog[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const todayStr = today.toISOString().split("T")[0];
    const weekStr = weekAgo.toISOString().split("T")[0];
    const monthStr = monthAgo.toISOString().split("T")[0];

    Promise.allSettled([
      listFarmLogs(weekStr, todayStr),
      listFarmLogs(monthStr, todayStr),
      getCurrentWeather(),
    ]).then(([weekRes, monthRes, weatherRes]) => {
      if (weekRes.status === "fulfilled") setWeekLogs(weekRes.value.logs);
      if (monthRes.status === "fulfilled") setMonthLogs(monthRes.value.logs);
      if (weatherRes.status === "fulfilled") setWeather(weatherRes.value);
      setLoading(false);
    });
  }, []);

  const daysRecorded = new Set(weekLogs.map((l) => l.log_date)).size;
  const todayStr = new Date().toISOString().split("T")[0];
  const todayLog = weekLogs.find((l) => l.log_date === todayStr);

  // Monthly task breakdown
  const taskCounts: Record<string, number> = {};
  monthLogs.forEach((log) => {
    log.tasks.forEach((t) => {
      taskCounts[t.stage] = (taskCounts[t.stage] || 0) + 1;
    });
  });
  const sortedTasks = Object.entries(taskCounts).sort((a, b) => b[1] - a[1]);

  // Chemical usage this month
  const chemCount = monthLogs.reduce((sum, log) => sum + log.chemicals.length, 0);

  // Last pesticide application date
  const lastPesticide = monthLogs
    .filter((log) => log.tasks.some((t) => t.stage === "방제"))
    .sort((a, b) => b.log_date.localeCompare(a.log_date))[0];

  const daysSinceLastPesticide = lastPesticide
    ? Math.floor(
        (Date.now() - new Date(lastPesticide.log_date + "T00:00:00").getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Weather + Date header */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{ backgroundColor: "#EDF4E8" }}
      >
        <div>
          <p className="text-xs" style={{ color: "#6B6B6B" }}>
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
          {weather && (
            <p className="text-lg font-bold mt-1" style={{ color: "#2D5016" }}>
              {weather.sky === "맑음" ? "☀️" : weather.sky === "흐림" ? "☁️" : "🌤️"}{" "}
              {weather.temperature !== null ? `${weather.temperature}°C` : ""}{" "}
              <span className="text-sm font-normal" style={{ color: "#6B6B6B" }}>
                {weather.summary || weather.sky || ""}
              </span>
            </p>
          )}
        </div>
        {todayLog ? (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
            style={{ backgroundColor: "#2D5016", color: "#fff" }}
          >
            ✓
          </div>
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
            style={{ backgroundColor: "#E8913A", color: "#fff" }}
          >
            !
          </div>
        )}
      </div>

      {/* Quick record button */}
      <button
        onClick={() => router.push("/farmer/record")}
        className="w-full rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-transform active:scale-[0.98]"
        style={{ backgroundColor: "#2D5016" }}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          ✏️
        </div>
        <div className="text-left">
          <p className="text-white font-bold">
            {todayLog ? "추가 기록하기" : "오늘 하루 기록하기"}
          </p>
          <p className="text-white/70 text-xs mt-0.5">
            탭으로 빠르게 · 음성으로 편하게
          </p>
        </div>
      </button>

      {/* Alerts */}
      {daysSinceLastPesticide !== null && daysSinceLastPesticide >= 10 && (
        <div
          className="rounded-xl p-3 text-sm flex items-start gap-2"
          style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}
        >
          <span>⚠️</span>
          <span>마지막 방제 후 {daysSinceLastPesticide}일 경과 — 재방제 검토 필요</span>
        </div>
      )}

      {/* Weekly stats */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>이번 주 기록</p>
          <p className="text-xs" style={{ color: "#6B6B6B" }}>{daysRecorded}일 / 7일</p>
        </div>
        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F5F1EC" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(daysRecorded / 7) * 100}%`,
              backgroundColor: daysRecorded >= 5 ? "#2D5016" : daysRecorded >= 3 ? "#E8913A" : "#D4421E",
            }}
          />
        </div>
        {/* Day dots */}
        <div className="flex gap-2 mt-3 justify-between">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - 6 + i);
            const ds = d.toISOString().split("T")[0];
            const hasLog = weekLogs.some((l) => l.log_date === ds);
            const days = ["일", "월", "화", "수", "목", "금", "토"];
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px]" style={{ color: "#9B9B9B" }}>
                  {days[d.getDay()]}
                </span>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: hasLog ? "#2D5016" : "#F5F1EC",
                    color: hasLog ? "#fff" : "#9B9B9B",
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly task summary */}
      {sortedTasks.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>최근 30일 작업</p>
            <button
              onClick={() => router.push("/farmer/calendar")}
              className="text-xs px-3 py-2 rounded-lg"
              style={{ color: "#2D5016", minHeight: "44px" }}
            >
              달력 보기 →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedTasks.map(([stage, count]) => (
              <span
                key={stage}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
              >
                {STAGE_EMOJI[stage] || "📝"} {stage} {count}회
              </span>
            ))}
            {chemCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}
              >
                🧪 농약/비료 {chemCount}건
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recent logs */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>최근 기록</p>
          <button
            onClick={() => router.push("/farmer/logs")}
            className="text-xs px-3 py-2 rounded-lg"
            style={{ color: "#2D5016", minHeight: "44px" }}
          >
            전체 보기 →
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-center py-6" style={{ color: "#9B9B9B" }}>
            불러오는 중...
          </p>
        ) : weekLogs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm" style={{ color: "#9B9B9B" }}>
              이번 주 기록이 없습니다
            </p>
            <button
              onClick={() => router.push("/farmer/record")}
              className="mt-2 text-xs font-medium px-6 py-3 rounded-lg"
              style={{ backgroundColor: "#EDF4E8", color: "#2D5016", minHeight: "44px" }}
            >
              첫 기록 남기기
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {weekLogs.slice(0, 5).map((log) => (
              <button
                key={log.id}
                onClick={() => router.push(`/farmer/logs?id=${log.id}`)}
                className="w-full text-left rounded-xl p-3 flex items-center gap-3"
                style={{ backgroundColor: "#F5F1EC" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: "#1A1A1A" }}>
                      {formatKoreanDate(log.log_date)}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: log.status === "confirmed" ? "#EDF4E8" : "#FEF3E2",
                        color: log.status === "confirmed" ? "#2D5016" : "#E8913A",
                      }}
                    >
                      {log.status === "confirmed" ? "확인됨" : "임시"}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {log.tasks.map((t, i) => (
                      <span key={i} className="text-xs" style={{ color: "#6B6B6B" }}>
                        {STAGE_EMOJI[t.stage] || "📝"}{t.stage}
                      </span>
                    ))}
                  </div>
                </div>
                <span style={{ color: "#9B9B9B" }}>→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "달력", icon: "📅", href: "/farmer/calendar" },
          { label: "가계부", icon: "💰", href: "/farmer/finance" },
          { label: "영수증", icon: "📷", href: "/farmer/receipt" },
        ].map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="rounded-xl p-3 flex flex-col items-center gap-1"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium" style={{ color: "#6B6B6B" }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
