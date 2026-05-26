"use client";

import type { ParsedFarmLog } from "@/lib/farmerApi";

interface ReviewCardProps {
  data: ParsedFarmLog;
  transcript: string | null;
  onConfirm: () => void;
  onDiscard: () => void;
  loading?: boolean;
}

/**
 * Review card — shows the AI-parsed farm log for farmer confirmation.
 * Clean summary: date, fields, tasks, chemicals, weather.
 * Farmer taps confirm to save, or discard to retry.
 */

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

export default function ReviewCard({ data, transcript, onConfirm, onDiscard, loading }: ReviewCardProps) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: "#F5F1EC", backgroundColor: "#FDFBF7" }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg" style={{ color: "#2D5016" }}>
            기록 확인
          </h3>
          <span className="text-sm" style={{ color: "#6B6B6B" }}>
            {data.date}
          </span>
        </div>
        {data.field_names.length > 0 && (
          <p className="text-sm mt-1" style={{ color: "#6B6B6B" }}>
            📍 {data.field_names.join(", ")}
          </p>
        )}
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="px-4 pt-3">
          <p className="text-xs italic" style={{ color: "#9B9B9B" }}>
            "{transcript}"
          </p>
        </div>
      )}

      {/* Tasks */}
      <div className="p-4">
        <p className="text-xs font-semibold mb-2" style={{ color: "#6B6B6B" }}>
          작업 내용
        </p>
        <div className="space-y-2">
          {data.tasks.map((task, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: "#F5F1EC" }}
            >
              <span className="text-lg">{STAGE_EMOJI[task.stage] || "📝"}</span>
              <div>
                <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                  {task.stage}
                </span>
                {task.detail && (
                  <p className="text-xs mt-0.5" style={{ color: "#6B6B6B" }}>
                    {task.detail}
                  </p>
                )}
                {task.duration_hours && (
                  <p className="text-xs mt-0.5" style={{ color: "#9B9B9B" }}>
                    약 {task.duration_hours}시간
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chemicals */}
      {data.chemicals.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: "#6B6B6B" }}>
            농약/비료
          </p>
          <div className="space-y-1">
            {data.chemicals.map((chem, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm rounded-lg p-2"
                style={{ backgroundColor: "#FEF3E2" }}
              >
                <span>{chem.type === "농약" ? "🧪" : "🌱"}</span>
                <span style={{ color: "#1A1A1A" }}>
                  {chem.name}
                  {chem.amount && <span style={{ color: "#6B6B6B" }}> · {chem.amount}</span>}
                  <span style={{ color: "#9B9B9B" }}> ({chem.action})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather */}
      {data.weather_farmer && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold mb-1" style={{ color: "#6B6B6B" }}>
            날씨
          </p>
          <p className="text-sm" style={{ color: "#1A1A1A" }}>
            🌤️ {data.weather_farmer}
          </p>
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold mb-1" style={{ color: "#6B6B6B" }}>
            메모
          </p>
          <p className="text-sm" style={{ color: "#1A1A1A" }}>
            {data.notes}
          </p>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex gap-3 p-4 border-t"
        style={{ borderColor: "#F5F1EC" }}
      >
        <button
          onClick={onDiscard}
          disabled={loading}
          className="flex-1 py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
        >
          다시 녹음
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#2D5016" }}
        >
          {loading ? "저장 중..." : "✓ 확인 저장"}
        </button>
      </div>
    </div>
  );
}
