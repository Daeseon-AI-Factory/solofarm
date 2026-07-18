"use client";

import type { Field, ParsedFarmLog } from "@/lib/farmerApi";

interface ReviewCardProps {
  data: ParsedFarmLog;
  transcript: string | null;
  availableFields: Field[];
  onChange: (data: ParsedFarmLog) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  loading?: boolean;
  discarding?: boolean;
  error?: string | null;
}

const FARM_STAGES = [
  "전정",
  "시비",
  "방제",
  "관수",
  "적화",
  "적과",
  "봉지씌우기",
  "수확",
  "기타",
];

const STAGE_EMOJI: Record<string, string> = {
  전정: "✂️",
  시비: "🌱",
  방제: "🧪",
  관수: "💧",
  적화: "🌸",
  적과: "🍎",
  봉지씌우기: "📦",
  수확: "🧺",
  기타: "📝",
};

const controlClassName =
  "w-full rounded-xl border px-3 py-3 text-base outline-none focus:ring-2 disabled:opacity-60";
const controlStyle = {
  minHeight: "52px",
  borderColor: "#E5E2DB",
  backgroundColor: "#FFFFFF",
  color: "#1A1A1A",
};

/** Controlled editor for checking and correcting an AI-parsed farm log. */
export default function ReviewCard({
  data,
  transcript,
  availableFields,
  onChange,
  onConfirm,
  onDiscard,
  loading,
  discarding,
  error,
}: ReviewCardProps) {
  const detectedFieldNames = data.field_names.filter(Boolean);
  const taskFieldNames = data.tasks.flatMap((task) =>
    task.field_name ? [task.field_name] : []
  );
  const fieldOptions = Array.from(
    new Set([
      ...availableFields.map((field) => field.name),
      ...detectedFieldNames,
      ...taskFieldNames,
    ])
  );
  const singleDetectedField =
    detectedFieldNames.length === 1 ? detectedFieldNames[0] : "";

  const updateTask = (
    index: number,
    patch: Partial<ParsedFarmLog["tasks"][number]>
  ) => {
    onChange({
      ...data,
      tasks: data.tasks.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...patch } : task
      ),
    });
  };

  const updateChemical = (
    index: number,
    patch: Partial<ParsedFarmLog["chemicals"][number]>
  ) => {
    onChange({
      ...data,
      chemicals: data.chemicals.map((chemical, chemicalIndex) =>
        chemicalIndex === index ? { ...chemical, ...patch } : chemical
      ),
    });
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
    >
      <div
        className="border-b p-4"
        style={{ borderColor: "#F5F1EC", backgroundColor: "#FDFBF7" }}
      >
        <h3 className="mb-4 text-lg font-bold" style={{ color: "#2D5016" }}>
          기록 확인 및 수정
        </h3>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
            작업 날짜
          </span>
          <input
            type="date"
            value={data.date}
            onChange={(event) => onChange({ ...data, date: event.target.value })}
            disabled={loading}
            className={controlClassName}
            style={controlStyle}
          />
        </label>

        {detectedFieldNames.length > 0 && (
          <div
            className="mt-3 rounded-xl px-3 py-3 text-sm"
            style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
          >
            <span className="font-semibold">음성에서 감지한 필지</span>
            <span className="ml-2">📍 {detectedFieldNames.join(", ")}</span>
          </div>
        )}
      </div>

      {transcript && (
        <div className="px-4 pt-4">
          <p className="mb-1 text-xs font-semibold" style={{ color: "#6B6B6B" }}>
            녹음 내용
          </p>
          <p
            className="rounded-xl p-3 text-sm leading-relaxed"
            style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
          >
            &quot;{transcript}&quot;
          </p>
        </div>
      )}

      <div className="p-4">
        <p className="mb-3 text-xs font-semibold" style={{ color: "#6B6B6B" }}>
          작업 내용
        </p>
        <div className="space-y-4">
          {data.tasks.map((task, index) => {
            const stageOptions = FARM_STAGES.includes(task.stage)
              ? FARM_STAGES
              : [task.stage, ...FARM_STAGES];
            const selectedFieldName = task.field_name || singleDetectedField;

            return (
              <div
                key={index}
                className="rounded-2xl p-4"
                style={{ backgroundColor: "#F5F1EC" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">{STAGE_EMOJI[task.stage] || "📝"}</span>
                  <span className="text-sm font-bold" style={{ color: "#2D5016" }}>
                    작업 {index + 1}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
                      필지
                    </span>
                    <select
                      value={selectedFieldName}
                      onChange={(event) =>
                        updateTask(index, {
                          field_name: event.target.value || null,
                        })
                      }
                      disabled={loading}
                      className={controlClassName}
                      style={controlStyle}
                    >
                      <option value="">필지 미지정</option>
                      {fieldOptions.map((fieldName) => (
                        <option key={fieldName} value={fieldName}>
                          {fieldName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
                      작업 단계
                    </span>
                    <select
                      value={task.stage}
                      onChange={(event) =>
                        updateTask(index, { stage: event.target.value })
                      }
                      disabled={loading}
                      className={controlClassName}
                      style={controlStyle}
                    >
                      {stageOptions.map((stage) => (
                        <option key={stage} value={stage}>
                          {STAGE_EMOJI[stage] || "📝"} {stage}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-3 block">
                  <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
                    상세 내용
                  </span>
                  <textarea
                    value={task.detail ?? ""}
                    onChange={(event) =>
                      updateTask(index, { detail: event.target.value || null })
                    }
                    disabled={loading}
                    rows={2}
                    className={`${controlClassName} resize-y`}
                    style={controlStyle}
                    placeholder="작업 내용을 확인하거나 수정하세요"
                  />
                </label>

                <label className="mt-3 block sm:max-w-48">
                  <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
                    작업 시간
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={task.duration_hours ?? ""}
                      onChange={(event) =>
                        updateTask(index, {
                          duration_hours:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                      disabled={loading}
                      className={controlClassName}
                      style={controlStyle}
                      placeholder="0"
                    />
                    <span className="shrink-0 text-sm" style={{ color: "#6B6B6B" }}>
                      시간
                    </span>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {data.chemicals.length > 0 && (
        <div className="px-4 pb-4">
          <p className="mb-3 text-xs font-semibold" style={{ color: "#6B6B6B" }}>
            농약/비료
          </p>
          <div className="space-y-3">
            {data.chemicals.map((chemical, index) => (
              <div
                key={index}
                className="rounded-2xl p-4"
                style={{ backgroundColor: "#FEF3E2" }}
              >
                <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "#6B6B6B" }}>
                  <span>{chemical.type === "농약" ? "🧪" : "🌱"}</span>
                  <span>{chemical.type}</span>
                  {chemical.action && (
                    <span className="font-normal" style={{ color: "#9B9B9B" }}>
                      · {chemical.action}
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
                      이름
                    </span>
                    <input
                      type="text"
                      value={chemical.name}
                      onChange={(event) =>
                        updateChemical(index, { name: event.target.value })
                      }
                      disabled={loading}
                      className={controlClassName}
                      style={controlStyle}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
                      사용량
                    </span>
                    <input
                      type="text"
                      value={chemical.amount ?? ""}
                      onChange={(event) =>
                        updateChemical(index, {
                          amount: event.target.value || null,
                        })
                      }
                      disabled={loading}
                      className={controlClassName}
                      style={controlStyle}
                      placeholder="예: 200리터"
                    />
                  </label>

                  {chemical.type === "농약" && (
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
                        희석 배수
                      </span>
                      <input
                        type="text"
                        value={chemical.dilution_ratio ?? ""}
                        onChange={(event) =>
                          updateChemical(index, {
                            dilution_ratio: event.target.value || null,
                          })
                        }
                        disabled={loading}
                        className={controlClassName}
                        style={controlStyle}
                        placeholder="예: 1000배"
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.weather_farmer && (
        <div className="px-4 pb-4">
          <p className="mb-1 text-xs font-semibold" style={{ color: "#6B6B6B" }}>
            음성에서 감지한 날씨
          </p>
          <p className="text-sm" style={{ color: "#1A1A1A" }}>
            🌤️ {data.weather_farmer}
          </p>
        </div>
      )}

      <div className="px-4 pb-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold" style={{ color: "#6B6B6B" }}>
            메모
          </span>
          <textarea
            value={data.notes ?? ""}
            onChange={(event) =>
              onChange({ ...data, notes: event.target.value || null })
            }
            disabled={loading}
            rows={3}
            className={`${controlClassName} resize-y`}
            style={controlStyle}
            placeholder="특이사항을 확인하거나 추가하세요"
          />
        </label>
      </div>

      {error && (
        <div className="mx-4 mb-4 rounded-xl p-4 text-sm" style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}>
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-3 border-t p-4" style={{ borderColor: "#F5F1EC" }}>
        <button
          type="button"
          onClick={onDiscard}
          disabled={loading || discarding}
          className="flex-1 rounded-xl px-3 py-4 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ minHeight: "56px", backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
        >
          {discarding ? "삭제 중..." : "다시 녹음"}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading || discarding}
          className="flex-1 rounded-xl px-3 py-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ minHeight: "56px", backgroundColor: "#2D5016" }}
        >
          {loading ? "저장 중..." : "✓ 확인 저장"}
        </button>
      </div>
    </div>
  );
}
