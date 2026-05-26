"use client";

import type { FarmLog } from "@/lib/farmerApi";

interface LogListProps {
  logs: FarmLog[];
  onSelect: (log: FarmLog) => void;
}

const STAGE_EMOJI: Record<string, string> = {
  전정: "✂️", 시비: "🌱", 방제: "🧪", 적화: "🌸",
  적과: "🍎", 봉지씌우기: "📦", 수확: "🧺", 기타: "📝",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

export default function LogList({ logs, onSelect }: LogListProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">📝</p>
        <p className="text-sm" style={{ color: "#9B9B9B" }}>
          아직 기록이 없습니다
        </p>
        <p className="text-xs mt-1" style={{ color: "#9B9B9B" }}>
          음성으로 오늘 하루를 기록해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <button
          key={log.id}
          onClick={() => onSelect(log)}
          className="w-full text-left rounded-xl border p-4 transition-colors hover:bg-gray-50"
          style={{ borderColor: "#E5E2DB" }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold" style={{ color: "#1A1A1A" }}>
              {formatDate(log.log_date)}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: log.status === "confirmed" ? "#EDF4E8" : "#FEF3E2",
                color: log.status === "confirmed" ? "#2D5016" : "#E8913A",
              }}
            >
              {log.status === "confirmed" ? "확인됨" : "임시저장"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {log.tasks.map((task, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
              >
                {STAGE_EMOJI[task.stage] || "📝"} {task.stage}
              </span>
            ))}
          </div>
          {log.weather_farmer && (
            <p className="text-xs mt-2" style={{ color: "#9B9B9B" }}>
              🌤️ {log.weather_farmer}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
