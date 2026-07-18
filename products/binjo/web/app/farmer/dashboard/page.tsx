"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listFarmLogs,
  getCurrentWeather,
  type FarmLog,
  type WeatherData,
} from "@/lib/farmerApi";
import { localDateISO } from "@/lib/farmerDate";
import { VOICE_RECORDING_BUILD_ENABLED } from "@/lib/featureFlags";

/**
 * Farmer dashboard — main hub after login.
 * Shows: weather, quick record, weekly stats, task summary, recent logs, alerts.
 */

const STAGE_EMOJI: Record<string, string> = {
  전정: "✂️", 시비: "🌱", 방제: "💊", 적화: "🌸",
  적과: "🍎", 봉지씌우기: "📦", 수확: "🧺", 관수: "💧", 기타: "📝",
};

type LoadState = "loading" | "ready" | "error";

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

function requestDashboardData() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 29);

  const todayStr = localDateISO(today);
  return Promise.allSettled([
    listFarmLogs(localDateISO(weekAgo), todayStr),
    listFarmLogs(localDateISO(monthAgo), todayStr),
    getCurrentWeather(),
  ]);
}

export default function FarmerDashboard() {
  const router = useRouter();
  const [weekLogs, setWeekLogs] = useState<FarmLog[]>([]);
  const [monthLogs, setMonthLogs] = useState<FarmLog[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weekState, setWeekState] = useState<LoadState>("loading");
  const [monthState, setMonthState] = useState<LoadState>("loading");
  const [weatherState, setWeatherState] = useState<LoadState>("loading");

  const applyDashboardResults = useCallback(([
    weekRes,
    monthRes,
    weatherRes,
  ]: Awaited<ReturnType<typeof requestDashboardData>>) => {
    if (weekRes.status === "fulfilled") {
      setWeekLogs(weekRes.value.logs);
      setWeekState("ready");
    } else {
      setWeekState("error");
    }

    if (monthRes.status === "fulfilled") {
      setMonthLogs(monthRes.value.logs);
      setMonthState("ready");
    } else {
      setMonthState("error");
    }

    if (weatherRes.status === "fulfilled") {
      setWeather(weatherRes.value);
      setWeatherState("ready");
    } else {
      setWeather(null);
      setWeatherState("error");
    }
  }, []);

  useEffect(() => {
    void requestDashboardData().then(applyDashboardResults);
  }, [applyDashboardResults]);

  const handleRetry = () => {
    setWeekState("loading");
    setMonthState("loading");
    setWeatherState("loading");
    void requestDashboardData().then(applyDashboardResults);
  };

  const confirmedWeekLogs = weekLogs.filter((log) => log.status === "confirmed");
  const draftLogs = monthLogs
    .filter((log) => log.status === "draft")
    .sort((a, b) => b.log_date.localeCompare(a.log_date));
  const todayStr = localDateISO();
  const todayConfirmedLog = confirmedWeekLogs.find((log) => log.log_date === todayStr);
  const todayDraftLog = weekLogs.find(
    (log) => log.log_date === todayStr && log.status === "draft"
  );

  const hasLoadError =
    weekState === "error" ||
    monthState === "error" ||
    weatherState === "error";

  const todayStatus =
    weekState === "loading"
      ? { label: "오늘 기록 확인 중", symbol: "…", backgroundColor: "#66705F" }
      : weekState === "error"
        ? { label: "오늘 기록 확인 실패", symbol: "?", backgroundColor: "#66705F" }
        : todayConfirmedLog
          ? { label: "오늘 기록 확인 완료", symbol: "✓", backgroundColor: "#2D5016" }
          : todayDraftLog
            ? { label: "오늘 임시 기록 있음", symbol: "✎", backgroundColor: "#B86219" }
            : { label: "오늘 기록 없음", symbol: "!", backgroundColor: "#B86219" };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      {/* Weather + Date header */}
      <section
        className="flex items-center justify-between rounded-2xl p-4"
        style={{ backgroundColor: "#EDF4E8" }}
      >
        <div className="min-w-0 pr-3">
          <p className="text-sm" style={{ color: "#6B6B6B" }}>
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
          {weatherState === "loading" && (
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              날씨 확인 중...
            </p>
          )}
          {weatherState === "ready" && weather && (
            <p className="mt-1 text-lg font-bold" style={{ color: "#2D5016" }}>
              {weather.sky === "맑음" ? "☀️" : weather.sky === "흐림" ? "☁️" : "🌤️"}{" "}
              {weather.temperature !== null ? `${weather.temperature}°C` : ""}{" "}
              <span className="text-sm font-normal" style={{ color: "#6B6B6B" }}>
                {weather.summary || weather.sky || ""}
              </span>
            </p>
          )}
          {weatherState === "error" && (
            <p className="mt-1 text-sm font-semibold" style={{ color: "#8A4B16" }}>
              날씨를 불러오지 못했어요
            </p>
          )}
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
          style={{ backgroundColor: todayStatus.backgroundColor, color: "#FFFFFF" }}
          role="img"
          aria-label={todayStatus.label}
        >
          {todayStatus.symbol}
        </div>
      </section>

      {hasLoadError && (
        <section
          className="rounded-2xl border p-4"
          style={{ backgroundColor: "#FFF8EC", borderColor: "#D8A45B" }}
          role="alert"
        >
          <p className="text-sm font-bold" style={{ color: "#754315" }}>
            일부 정보를 불러오지 못했어요
          </p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "#6B5540" }}>
            확인되지 않은 기록은 0건으로 계산하지 않았습니다. 연결 상태를 확인한 뒤 다시 불러와 주세요.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 min-h-12 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: "#2D5016" }}
          >
            다시 불러오기
          </button>
        </section>
      )}

      {/* Quick record button */}
      <button
        type="button"
        onClick={() => router.push("/farmer/record")}
        className="flex min-h-20 w-full items-center gap-4 rounded-2xl p-4 shadow-sm transition-transform active:scale-[0.98]"
        style={{ backgroundColor: "#2D5016" }}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          aria-hidden="true"
        >
          ✏️
        </div>
        <div className="text-left">
          <p className="text-white font-bold">
            {todayConfirmedLog ? "오늘 기록 더하기" : "오늘 하루 기록하기"}
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            {VOICE_RECORDING_BUILD_ENABLED
              ? "탭으로 빠르게 · 음성으로 편하게"
              : "필지와 작업을 빠르게 선택하세요"}
          </p>
        </div>
      </button>

      <section aria-labelledby="dashboard-quick-actions-title">
        <h2 id="dashboard-quick-actions-title" className="mb-2 text-sm font-bold" style={{ color: "#384832" }}>
          바로 하기
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/farmer/transactions?new=expense")}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl text-base font-bold"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #DDE5D8", color: "#2D5016" }}
          >
            <span className="text-2xl" aria-hidden="true">💸</span>
            지출 입력
          </button>
          <button
            type="button"
            onClick={() => router.push("/farmer/calendar")}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl text-base font-bold"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #DDE5D8", color: "#2D5016" }}
          >
            <span className="text-2xl" aria-hidden="true">📅</span>
            날짜별 기록
          </button>
        </div>
      </section>

      {monthState === "ready" && draftLogs.length > 0 && (
        <section
          className="rounded-2xl border p-4"
          style={{ backgroundColor: "#FFF8EC", borderColor: "#E4B676" }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">📝</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: "#754315" }}>
                확인할 임시 기록이 {draftLogs.length}건 있어요
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "#6B5540" }}>
                내용을 검토하고 확인 완료하면 공식 일지로 구분됩니다.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/farmer/record?edit=${draftLogs[0].id}`)}
                className="mt-3 min-h-12 rounded-xl px-5 py-2.5 text-sm font-bold"
                style={{ backgroundColor: "#FFFFFF", color: "#754315", border: "1px solid #D8A45B" }}
              >
                최근 임시 기록 검토하기 →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent logs */}
      <section className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>최근 기록</p>
          <button
            type="button"
            onClick={() => router.push("/farmer/logs")}
            className="min-h-12 rounded-lg px-3 py-2 text-sm"
            style={{ color: "#2D5016" }}
          >
            전체 보기 →
          </button>
        </div>

        {weekState === "loading" ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            불러오는 중...
          </p>
        ) : weekState === "error" ? (
          <p className="py-6 text-center text-sm" style={{ color: "#8A4B16" }}>
            최근 기록을 불러오지 못했습니다.
          </p>
        ) : weekLogs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              이번 주 기록이 없습니다
            </p>
            <button
              type="button"
              onClick={() => router.push("/farmer/record")}
              className="mt-2 min-h-12 rounded-lg px-6 py-3 text-sm font-medium"
              style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
            >
              첫 기록 남기기
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {weekLogs.slice(0, 5).map((log) => (
              <button
                type="button"
                key={log.id}
                onClick={() => router.push(`/farmer/logs?id=${log.id}`)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl p-3 text-left"
                style={{ backgroundColor: "#F5F1EC" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: "#1A1A1A" }}>
                      {formatKoreanDate(log.log_date)}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: log.status === "confirmed" ? "#EDF4E8" : "#FEF3E2",
                        color: log.status === "confirmed" ? "#2D5016" : "#8A4B16",
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
                <span style={{ color: "var(--color-text-muted)" }} aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
