"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import VoiceRecorder from "@/components/farmer/VoiceRecorder";
import ReviewCard from "@/components/farmer/ReviewCard";
import {
  getCurrentWeather,
  listFields,
  createFarmLog,
  uploadFarmLogPhotos,
  uploadVoice,
  getVoiceResult,
  listPesticides,
  checkSafeHarvest,
  type WeatherData,
  type Field,
  type ParsedFarmLog,
  type PesticideInfo,
  type SafeHarvestResult,
} from "@/lib/farmerApi";

// --- Types ---

interface TaskEntry {
  id: string; // client-side ID for list key + removal
  stage: string;
  emoji: string;
  fieldName?: string;
  detail?: string;
  durationHours: number;
  // Pest control (방제) specific
  chemicalName?: string;
  dilutionRatio?: string;
  sprayAmount?: string;
  // Fertilizing (시비) specific
  fertilizerName?: string;
  fertilizerAmount?: string;
}

// Quick task button definitions — common apple farming tasks
const TASK_BUTTONS = [
  { stage: "방제", emoji: "💊", label: "방제" },
  { stage: "시비", emoji: "🌱", label: "시비" },
  { stage: "전정", emoji: "✂️", label: "전정" },
  { stage: "관수", emoji: "💧", label: "관수" },
  { stage: "적화", emoji: "🌸", label: "적화" },
  { stage: "적과", emoji: "🍎", label: "적과" },
  { stage: "수확", emoji: "📦", label: "수확" },
  { stage: "기타", emoji: "📝", label: "기타" },
] as const;

// Sky condition → emoji mapping for weather display
const SKY_EMOJI: Record<string, string> = {
  맑음: "☀️",
  "구름 많음": "⛅",
  흐림: "☁️",
};

type InputMode = "manual" | "voice";
type PageState = "entry" | "uploading" | "review" | "saving" | "saved";

// --- Component ---

export default function RecordPage() {
  const router = useRouter();

  // --- Top-level state ---
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [pageState, setPageState] = useState<PageState>("entry");

  // --- Weather ---
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // --- Fields ---
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // --- Pesticides ---
  const [pesticides, setPesticides] = useState<PesticideInfo[]>([]);
  const [pesticideMatches, setPesticideMatches] = useState<PesticideInfo[]>([]);
  const [safetyWarning, setSafetyWarning] = useState<SafeHarvestResult | null>(null);

  // --- Task detail panel ---
  const [activeTask, setActiveTask] = useState<typeof TASK_BUTTONS[number] | null>(null);
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null);
  const [detailText, setDetailText] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  // 방제 fields
  const [chemicalName, setChemicalName] = useState("");
  const [dilutionRatio, setDilutionRatio] = useState("");
  const [sprayAmount, setSprayAmount] = useState("");
  // 시비 fields
  const [fertilizerName, setFertilizerName] = useState("");
  const [fertilizerAmount, setFertilizerAmount] = useState("");

  // --- Task list for the day ---
  const [tasks, setTasks] = useState<TaskEntry[]>([]);

  // --- Photos ---
  const [photos, setPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Notes ---
  const [notes, setNotes] = useState("");

  // --- Voice mode state ---
  const [parsedData, setParsedData] = useState<ParsedFarmLog | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  // --- Error ---
  const [error, setError] = useState<string | null>(null);

  // --- Fetch weather + fields on mount ---
  useEffect(() => {
    getCurrentWeather()
      .then(setWeather)
      .catch((err) => {
        console.error("[RecordPage] Failed to fetch weather:", err);
      })
      .finally(() => setWeatherLoading(false));

    listFields()
      .then(setFields)
      .catch((err) => {
        console.error("[RecordPage] Failed to fetch fields:", err);
      })
      .finally(() => setFieldsLoading(false));

    listPesticides()
      .then(setPesticides)
      .catch((err) => {
        console.error("[RecordPage] Failed to fetch pesticides:", err);
      });
  }, []);

  // --- Pesticide autocomplete ---
  const handleChemicalNameChange = (value: string) => {
    setChemicalName(value);
    setSafetyWarning(null);
    if (value.length >= 1) {
      const matches = pesticides.filter(
        (p) => p.name_kr.includes(value) || value.includes(p.name_kr)
      );
      setPesticideMatches(matches);
    } else {
      setPesticideMatches([]);
    }
  };

  const selectPesticide = (p: PesticideInfo) => {
    setChemicalName(p.name_kr);
    setDilutionRatio(p.dilution_ratio);
    setPesticideMatches([]);
    // Check safe harvest date
    const today = new Date().toISOString().split("T")[0];
    checkSafeHarvest(today, p.name_kr)
      .then(setSafetyWarning)
      .catch(() => {});
  };

  // --- Today's date in Korean ---
  const todayFormatted = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  // ISO date for API
  const todayISO = new Date().toISOString().slice(0, 10);

  // --- Weather display ---
  const weatherSummary = weather
    ? `${SKY_EMOJI[weather.sky || ""] || "🌤️"} ${weather.temperature ?? "--"}°C · ${weather.sky || ""}${weather.humidity ? ` · 습도 ${weather.humidity}%` : ""}`
    : null;

  // --- Task detail panel helpers ---

  const openTaskPanel = (task: typeof TASK_BUTTONS[number]) => {
    setActiveTask(task);
    // Reset detail form
    setSelectedFieldName(null);
    setDetailText("");
    setDurationHours(1);
    setChemicalName("");
    setDilutionRatio("");
    setSprayAmount("");
    setFertilizerName("");
    setFertilizerAmount("");
  };

  const closeTaskPanel = () => {
    setActiveTask(null);
  };

  const addTaskToList = () => {
    if (!activeTask) return;

    const entry: TaskEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stage: activeTask.stage,
      emoji: activeTask.emoji,
      fieldName: selectedFieldName || undefined,
      detail: detailText.trim() || undefined,
      durationHours,
      chemicalName: chemicalName.trim() || undefined,
      dilutionRatio: dilutionRatio.trim() || undefined,
      sprayAmount: sprayAmount.trim() || undefined,
      fertilizerName: fertilizerName.trim() || undefined,
      fertilizerAmount: fertilizerAmount.trim() || undefined,
    };

    setTasks((prev) => [...prev, entry]);
    closeTaskPanel();
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Photo handling ---
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setPhotos((prev) => [...prev, ...Array.from(files)]);
    // Reset input so re-selecting the same file works
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Save (manual mode) ---
  const handleSave = async () => {
    if (tasks.length === 0) {
      setError("작업을 1개 이상 추가해주세요.");
      return;
    }

    setPageState("saving");
    setError(null);

    try {
      // Build chemicals array from 방제 tasks
      const chemicals = tasks
        .filter((t) => t.stage === "방제" && t.chemicalName)
        .map((t) => ({
          type: "농약" as const,
          name: t.chemicalName!,
          amount: t.sprayAmount || undefined,
          action: "살포",
        }));

      // Build chemicals array from 시비 tasks (type = fertilizer)
      const fertilizers = tasks
        .filter((t) => t.stage === "시비" && t.fertilizerName)
        .map((t) => ({
          type: "비료" as const,
          name: t.fertilizerName!,
          amount: t.fertilizerAmount || undefined,
          action: "시비",
        }));

      const log = await createFarmLog({
        log_date: todayISO,
        crop: "사과", // Default crop — apple farm
        tasks: tasks.map((t) => ({
          field_name: t.fieldName || undefined,
          stage: t.stage,
          detail: t.detail || undefined,
          duration_hours: t.durationHours || undefined,
        })),
        chemicals: [...chemicals, ...fertilizers].length > 0
          ? [...chemicals, ...fertilizers]
          : undefined,
        notes: notes.trim() || undefined,
      });

      // Upload photos after creating the log — needs the log ID
      if (photos.length > 0) {
        try {
          await uploadFarmLogPhotos(log.id, photos);
        } catch (photoErr) {
          // Log saved but photos failed — don't block the save
          console.error("[record] Photo upload failed:", photoErr);
        }
      }

      setPageState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setPageState("entry");
    }
  };

  // --- Voice mode handlers ---

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setPageState("uploading");
    setError(null);

    try {
      const result = await uploadVoice(blob);
      setRecordingId(result.id);

      if (result.status === "completed") {
        const voiceResult = await getVoiceResult(result.id);
        setParsedData(voiceResult.parsed_data);
        setTranscript(voiceResult.transcript);
        setPageState("review");
      } else {
        setError(result.message || "처리에 실패했습니다.");
        setPageState("entry");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "음성 업로드에 실패했습니다.");
      setPageState("entry");
    }
  }, []);

  const handleVoiceConfirm = async () => {
    if (!parsedData) return;

    setPageState("saving");
    try {
      const log = await createFarmLog({
        voice_recording_id: recordingId || undefined,
        log_date: parsedData.date,
        crop: parsedData.crop,
        tasks: parsedData.tasks.map((t) => ({
          stage: t.stage,
          detail: t.detail || undefined,
          duration_hours: t.duration_hours || undefined,
        })),
        chemicals: parsedData.chemicals.map((c) => ({
          type: c.type,
          name: c.name,
          amount: c.amount || undefined,
          action: c.action,
        })),
        weather_farmer: parsedData.weather_farmer || undefined,
        notes: parsedData.notes || undefined,
      });

      // Upload photos if any were selected before voice recording
      if (photos.length > 0) {
        try {
          await uploadFarmLogPhotos(log.id, photos);
        } catch (photoErr) {
          console.error("[record] Photo upload failed:", photoErr);
        }
      }

      setPageState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setPageState("review");
    }
  };

  const handleVoiceDiscard = () => {
    setPageState("entry");
    setParsedData(null);
    setTranscript(null);
    setRecordingId(null);
    setError(null);
  };

  const handleReset = () => {
    setPageState("entry");
    setTasks([]);
    setPhotos([]);
    setNotes("");
    setError(null);
    setParsedData(null);
    setTranscript(null);
    setRecordingId(null);
  };

  // ============================
  // Render
  // ============================

  // --- Success screen ---
  if (pageState === "saved") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: "#F5F1EC" }}>
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-6"
          style={{ backgroundColor: "#EDF4E8" }}
        >
          ✓
        </div>
        <p className="text-xl font-bold mb-2" style={{ color: "#2D5016" }}>
          저장되었습니다!
        </p>
        <p className="text-sm mb-10" style={{ color: "#6B6B6B" }}>
          오늘의 영농일지가 기록되었습니다
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={handleReset}
            className="flex-1 py-4 rounded-2xl font-medium text-sm"
            style={{ backgroundColor: "#FFFFFF", color: "#6B6B6B" }}
          >
            추가 기록
          </button>
          <button
            onClick={() => router.push("/farmer/logs")}
            className="flex-1 py-4 rounded-2xl font-bold text-sm text-white"
            style={{ backgroundColor: "#2D5016" }}
          >
            기록 보기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: "#F5F1EC" }}>
      {/* ============ HEADER ============ */}
      <div className="px-4 pt-6 pb-4" style={{ backgroundColor: "#FFFFFF" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>
          오늘 하루 기록
        </h1>
        <p className="text-sm mb-3" style={{ color: "#6B6B6B" }}>
          {todayFormatted}
        </p>

        {/* Weather */}
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: "#F5F1EC" }}
        >
          {weatherLoading ? (
            <span style={{ color: "#9B9B9B" }}>날씨 불러오는 중...</span>
          ) : weatherSummary ? (
            <span style={{ color: "#2D5016" }}>{weatherSummary}</span>
          ) : (
            <span style={{ color: "#9B9B9B" }}>날씨 정보를 불러올 수 없습니다</span>
          )}
        </div>

        {/* Mode toggle — manual / voice */}
        <div
          className="mt-4 flex rounded-xl overflow-hidden"
          style={{ backgroundColor: "#F5F1EC" }}
        >
          <button
            onClick={() => {
              setInputMode("manual");
              if (pageState !== "entry") setPageState("entry");
            }}
            className="flex-1 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: inputMode === "manual" ? "#2D5016" : "transparent",
              color: inputMode === "manual" ? "#FFFFFF" : "#6B6B6B",
            }}
          >
            ✏️ 직접 입력
          </button>
          <button
            onClick={() => {
              setInputMode("voice");
              if (pageState !== "entry") setPageState("entry");
            }}
            className="flex-1 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: inputMode === "voice" ? "#2D5016" : "transparent",
              color: inputMode === "voice" ? "#FFFFFF" : "#6B6B6B",
            }}
          >
            🎙️ 음성 기록
          </button>
        </div>
      </div>

      {/* ============ ERROR ============ */}
      {error && (
        <div className="mx-4 mt-4">
          <div
            className="rounded-xl p-4 text-sm flex items-start gap-2"
            style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}
          >
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* ============ VOICE MODE ============ */}
      {inputMode === "voice" && (
        <div className="px-4 mt-6">
          {pageState === "entry" && (
            <VoiceRecorder
              onRecordingComplete={handleRecordingComplete}
              disabled={false}
            />
          )}
          {pageState === "uploading" && (
            <div className="flex flex-col items-center py-16">
              <div
                className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mb-4"
                style={{ borderColor: "#2D5016", borderTopColor: "transparent" }}
              />
              <p className="text-sm font-medium" style={{ color: "#2D5016" }}>
                AI가 분석 중입니다...
              </p>
              <p className="text-xs mt-1" style={{ color: "#9B9B9B" }}>
                음성을 텍스트로 변환하고 구조화하는 중
              </p>
            </div>
          )}
          {pageState === "review" && parsedData && (
            <ReviewCard
              data={parsedData}
              transcript={transcript}
              onConfirm={handleVoiceConfirm}
              onDiscard={handleVoiceDiscard}
              loading={false}
            />
          )}
        </div>
      )}

      {/* ============ MANUAL MODE ============ */}
      {inputMode === "manual" && pageState === "entry" && (
        <>
          {/* --- Quick Task Buttons --- */}
          <div className="px-4 mt-6">
            <p className="text-xs font-semibold mb-3" style={{ color: "#6B6B6B" }}>
              오늘 한 작업을 선택하세요
            </p>
            <div className="grid grid-cols-4 gap-3">
              {TASK_BUTTONS.map((task) => (
                <button
                  key={task.stage}
                  onClick={() => openTaskPanel(task)}
                  className="flex flex-col items-center justify-center rounded-2xl py-4 transition-all active:scale-95"
                  // 56px minimum height for glove-friendly taps
                  style={{
                    backgroundColor: "#FFFFFF",
                    minHeight: "80px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <span className="text-2xl mb-1">{task.emoji}</span>
                  <span className="text-xs font-medium" style={{ color: "#2D5016" }}>
                    {task.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* --- Slide-up Detail Panel --- */}
          {activeTask && (
            <div
              className="fixed inset-0 z-50 flex items-end"
              style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
              onClick={(e) => {
                // Close when tapping backdrop
                if (e.target === e.currentTarget) closeTaskPanel();
              }}
            >
              <div
                className="w-full rounded-t-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto animate-slideUp"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                {/* Panel header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{activeTask.emoji}</span>
                    <h3 className="text-lg font-bold" style={{ color: "#2D5016" }}>
                      {activeTask.label}
                    </h3>
                  </div>
                  <button
                    onClick={closeTaskPanel}
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
                  >
                    ✕
                  </button>
                </div>

                {/* Field selector */}
                <div className="mb-5">
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                    필지 선택
                  </label>
                  {fieldsLoading ? (
                    <p className="text-xs" style={{ color: "#9B9B9B" }}>불러오는 중...</p>
                  ) : fields.length === 0 ? (
                    <p className="text-xs" style={{ color: "#9B9B9B" }}>
                      등록된 필지가 없습니다
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {fields.map((field) => (
                        <button
                          key={field.id}
                          onClick={() =>
                            setSelectedFieldName(
                              selectedFieldName === field.name ? null : field.name
                            )
                          }
                          className="px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
                          style={{
                            backgroundColor:
                              selectedFieldName === field.name ? "#2D5016" : "#F5F1EC",
                            color:
                              selectedFieldName === field.name ? "#FFFFFF" : "#2D5016",
                            minHeight: "44px",
                          }}
                        >
                          {field.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Detail text */}
                <div className="mb-5">
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                    작업 상세
                  </label>
                  <input
                    type="text"
                    value={detailText}
                    onChange={(e) => setDetailText(e.target.value)}
                    placeholder="예: 과수원 전체 3열 작업"
                    className="w-full px-4 py-3 rounded-xl text-sm border-none outline-none"
                    style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                  />
                </div>

                {/* Duration stepper */}
                <div className="mb-5">
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                    작업 시간
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setDurationHours(Math.max(0.5, durationHours - 0.5))}
                      className="w-14 h-14 rounded-xl text-xl font-bold flex items-center justify-center active:scale-95"
                      style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
                    >
                      −
                    </button>
                    <span className="text-xl font-bold min-w-15 text-center" style={{ color: "#1A1A1A" }}>
                      {durationHours}시간
                    </span>
                    <button
                      onClick={() => setDurationHours(durationHours + 0.5)}
                      className="w-14 h-14 rounded-xl text-xl font-bold flex items-center justify-center active:scale-95"
                      style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 방제 (pest control) specific fields — with pesticide autocomplete */}
                {activeTask.stage === "방제" && (
                  <div className="mb-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                        약제명
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={chemicalName}
                          onChange={(e) => handleChemicalNameChange(e.target.value)}
                          placeholder="예: 석회유황합제 (입력하면 자동 추천)"
                          className="w-full px-4 py-3 rounded-xl text-sm border-none outline-none"
                          style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                        />
                        {/* Autocomplete dropdown */}
                        {pesticideMatches.length > 0 && (
                          <div
                            className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto"
                            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
                          >
                            {pesticideMatches.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => selectPesticide(p)}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b last:border-b-0"
                                style={{ borderColor: "#F5F1EC" }}
                              >
                                <span className="font-medium" style={{ color: "#1A1A1A" }}>
                                  {p.name_kr}
                                </span>
                                <span className="ml-2 text-xs" style={{ color: "#9B9B9B" }}>
                                  {p.type} · {p.dilution_ratio} · 안전기간 {p.safety_days}일
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Show all pesticides as chips when input is empty */}
                      {!chemicalName && pesticides.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {pesticides.slice(0, 6).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => selectPesticide(p)}
                              className="px-3 py-2 rounded-full text-xs"
                              style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B", minHeight: "40px" }}
                            >
                              {p.name_kr}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Safety warning — shown after selecting a pesticide */}
                    {safetyWarning && (
                      <div
                        className="rounded-xl p-3 text-sm"
                        style={{
                          backgroundColor: safetyWarning.is_safe ? "#EDF4E8" : "#FEF3E2",
                          color: safetyWarning.is_safe ? "#2D5016" : "#D4421E",
                        }}
                      >
                        {safetyWarning.is_safe ? (
                          <p>✅ 안전기간 경과 — 수확 가능</p>
                        ) : (
                          <>
                            <p className="font-bold">
                              ⚠️ 안전기간 {safetyWarning.safety_days}일
                            </p>
                            <p className="mt-1">
                              오늘 살포 시 수확 가능일: <strong>{safetyWarning.safe_harvest_date}</strong>
                            </p>
                            <p>
                              남은 기간: <strong>{safetyWarning.days_remaining}일</strong>
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                        희석 배수
                      </label>
                      <input
                        type="text"
                        value={dilutionRatio}
                        onChange={(e) => setDilutionRatio(e.target.value)}
                        placeholder="예: 1000배"
                        className="w-full px-4 py-3 rounded-xl text-sm border-none outline-none"
                        style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                        살포량
                      </label>
                      <input
                        type="text"
                        value={sprayAmount}
                        onChange={(e) => setSprayAmount(e.target.value)}
                        placeholder="예: 200리터"
                        className="w-full px-4 py-3 rounded-xl text-sm border-none outline-none"
                        style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                      />
                    </div>
                  </div>
                )}

                {/* 시비 (fertilizing) specific fields */}
                {activeTask.stage === "시비" && (
                  <div className="mb-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                        비료명
                      </label>
                      <input
                        type="text"
                        value={fertilizerName}
                        onChange={(e) => setFertilizerName(e.target.value)}
                        placeholder="예: 복합비료 21-17-17"
                        className="w-full px-4 py-3 rounded-xl text-sm border-none outline-none"
                        style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                        시비량
                      </label>
                      <input
                        type="text"
                        value={fertilizerAmount}
                        onChange={(e) => setFertilizerAmount(e.target.value)}
                        placeholder="예: 20kg/주"
                        className="w-full px-4 py-3 rounded-xl text-sm border-none outline-none"
                        style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                      />
                    </div>
                  </div>
                )}

                {/* Add task button */}
                <button
                  onClick={addTaskToList}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: "#2D5016", minHeight: "56px" }}
                >
                  작업 추가
                </button>
              </div>
            </div>
          )}

          {/* --- Running Task List --- */}
          {tasks.length > 0 && (
            <div className="px-4 mt-6">
              <p className="text-xs font-semibold mb-3" style={{ color: "#6B6B6B" }}>
                오늘의 작업 ({tasks.length}건)
              </p>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ backgroundColor: "#FFFFFF" }}
                  >
                    <span className="text-xl shrink-0">{task.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>
                          {task.stage}
                        </span>
                        {task.fieldName && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                          >
                            {task.fieldName}
                          </span>
                        )}
                      </div>
                      {task.detail && (
                        <p className="text-xs truncate" style={{ color: "#6B6B6B" }}>
                          {task.detail}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-xs" style={{ color: "#9B9B9B" }}>
                          {task.durationHours}시간
                        </span>
                        {task.chemicalName && (
                          <span className="text-xs" style={{ color: "#D4421E" }}>
                            💊 {task.chemicalName}
                            {task.dilutionRatio ? ` (${task.dilutionRatio})` : ""}
                          </span>
                        )}
                        {task.fertilizerName && (
                          <span className="text-xs" style={{ color: "#2D5016" }}>
                            🌱 {task.fertilizerName}
                            {task.fertilizerAmount ? ` ${task.fertilizerAmount}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeTask(task.id)}
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95"
                      style={{ backgroundColor: "#F5F1EC", color: "#D4421E" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- Notes --- */}
          {tasks.length > 0 && (
            <div className="px-4 mt-6">
              <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                메모 (선택)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="오늘 특이사항이 있으면 메모하세요"
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm border-none outline-none resize-none"
                style={{ backgroundColor: "#FFFFFF", color: "#1A1A1A" }}
              />
            </div>
          )}

          {/* --- Photo Attachment --- */}
          <div className="px-4 mt-6">
            <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
              사진 첨부 (선택)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl flex flex-col items-center justify-center active:scale-95"
                style={{ backgroundColor: "#FFFFFF", color: "#6B6B6B" }}
              >
                <span className="text-2xl mb-1">📷</span>
                <span className="text-[10px]">추가</span>
              </button>
              {photos.map((photo, i) => (
                <div key={i} className="relative w-20 h-20">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`사진 ${i + 1}`}
                    className="w-full h-full rounded-xl object-cover"
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: "#D4421E" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ============ BOTTOM SAVE BAR (manual mode only) ============ */}
      {inputMode === "manual" && pageState === "entry" && tasks.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t"
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: "#E5E2DB",
            // Safe area bottom padding for notch devices
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <button
            onClick={handleSave}
            className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "#2D5016", minHeight: "56px" }}
          >
            저장 ({tasks.length}건)
          </button>
        </div>
      )}

      {/* ============ SAVING OVERLAY ============ */}
      {pageState === "saving" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ backgroundColor: "rgba(245,241,236,0.95)" }}
        >
          <div
            className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mb-4"
            style={{ borderColor: "#2D5016", borderTopColor: "transparent" }}
          />
          <p className="text-sm font-medium" style={{ color: "#2D5016" }}>
            저장 중...
          </p>
        </div>
      )}

      {/* Slide-up animation */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
