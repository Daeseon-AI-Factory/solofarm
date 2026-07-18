"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VoiceRecorder from "@/components/farmer/VoiceRecorder";
import ReviewCard from "@/components/farmer/ReviewCard";
import {
  getCurrentWeather,
  listFields,
  createFarmLog,
  uploadFarmLogPhotos,
  uploadVoice,
  getVoiceStatus,
  getVoiceResult,
  confirmFarmLog,
  deleteFarmLog,
  updateFarmLog,
  getFarmLog,
  type WeatherData,
  type Field,
  type FarmLog,
  type FarmLogWriteInput,
  type ParsedFarmLog,
} from "@/lib/farmerApi";
import { localDateISO } from "@/lib/farmerDate";
import {
  FARMER_RECORD_PREFERENCES_KEY,
  getYesterdayDate,
  normalizeRecordDate,
  parseRecordPreferences,
  serializeRecordPreferences,
} from "@/lib/farmerWorkflow";
import {
  FARM_LOG_PHOTO_UPLOAD_BUILD_ENABLED,
  VOICE_RECORDING_BUILD_ENABLED,
} from "@/lib/featureFlags";

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

interface TaskDefinition {
  stage: string;
  emoji: string;
  label: string;
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

const DETAIL_FIRST_STAGES = new Set(["방제", "시비", "기타"]);
const QUICK_DURATION_OPTIONS = [0.5, 1, 2, 4] as const;

// Sky condition → emoji mapping for weather display
const SKY_EMOJI: Record<string, string> = {
  맑음: "☀️",
  "구름 많음": "⛅",
  흐림: "☁️",
};

const VOICE_POLL_INTERVAL_MS = 2_000;
const VOICE_POLL_MAX_ATTEMPTS = 30;
const VOICE_POLL_MAX_CONSECUTIVE_ERRORS = 3;
type WriteChemical = NonNullable<FarmLogWriteInput["chemicals"]>[number];

function toWriteChemical(chemical: FarmLog["chemicals"][number]): WriteChemical {
  return {
    type: chemical.type,
    name: chemical.name,
    amount: chemical.amount || undefined,
    dilution_ratio: chemical.dilution_ratio || undefined,
    action: chemical.action,
  };
}

function hydrateLogForEditing(log: FarmLog): {
  tasks: TaskEntry[];
  preservedChemicals: WriteChemical[];
} {
  const pesticides = log.chemicals
    .filter((chemical) => chemical.type === "농약")
    .map(toWriteChemical);
  const fertilizers = log.chemicals
    .filter((chemical) => chemical.type === "비료")
    .map(toWriteChemical);
  const preservedChemicals = log.chemicals
    .filter((chemical) => chemical.type !== "농약" && chemical.type !== "비료")
    .map(toWriteChemical);

  const tasks = log.tasks.map((task, index) => {
    const pesticide = task.stage === "방제" ? pesticides.shift() : undefined;
    const fertilizer = task.stage === "시비" ? fertilizers.shift() : undefined;
    const definition = TASK_BUTTONS.find((item) => item.stage === task.stage);

    return {
      id: `existing-${task.id || index}`,
      stage: task.stage,
      emoji: definition?.emoji || "📝",
      fieldName: task.field_name || undefined,
      detail: task.detail || undefined,
      durationHours: task.duration_hours ?? 1,
      chemicalName: pesticide?.name,
      dilutionRatio: pesticide?.dilution_ratio,
      sprayAmount: pesticide?.amount,
      fertilizerName: fertilizer?.name,
      fertilizerAmount: fertilizer?.amount,
    };
  });

  return {
    tasks,
    preservedChemicals: [...preservedChemicals, ...pesticides, ...fertilizers],
  };
}

function PhotoPreview({
  photo,
  index,
  onRemove,
}: {
  photo: File;
  index: number;
  onRemove: (index: number) => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const previewUrl = URL.createObjectURL(photo);
    if (imageRef.current) imageRef.current.src = previewUrl;

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [photo]);

  return (
    <div className="relative w-20 h-20">
      <img
        ref={imageRef}
        alt={`사진 ${index + 1}`}
        className="w-full h-full rounded-xl object-cover"
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute -right-3 -top-3 flex h-12 w-12 items-center justify-center rounded-full text-base text-white shadow"
        style={{ backgroundColor: "#D4421E" }}
        aria-label={`사진 ${index + 1} 삭제`}
      >
        ✕
      </button>
    </div>
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeParsedFarmLog(data: ParsedFarmLog): ParsedFarmLog {
  // A single detected field can safely apply to every task. When multiple fields
  // are mentioned, leave each task unassigned so the farmer must choose instead
  // of letting the AI invent an association.
  const defaultField = data.field_names.length === 1 ? data.field_names[0] : null;
  return {
    ...data,
    tasks: data.tasks.map((task) => ({
      ...task,
      field_name: task.field_name ?? defaultField,
    })),
  };
}

type InputMode = "manual" | "voice";
type PageState = "entry" | "uploading" | "review" | "saving" | "saved";

// --- Component ---

function RecordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEditId = searchParams.get("edit");
  const requestedDate = searchParams.get("date");
  const initialRequestedDate = normalizeRecordDate(requestedDate);

  // --- Top-level state ---
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [pageState, setPageState] = useState<PageState>("entry");
  const [logDate, setLogDate] = useState(() => initialRequestedDate);
  const [logCrop, setLogCrop] = useState("사과");
  const [manualLogId, setManualLogId] = useState<string | null>(requestedEditId);
  const [preservedChemicals, setPreservedChemicals] = useState<WriteChemical[]>([]);
  const [editLoading, setEditLoading] = useState(Boolean(requestedEditId));
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [completionWarning, setCompletionWarning] = useState<string | null>(null);

  // --- Weather ---
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // --- Fields ---
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  // --- Task detail panel ---
  const [activeTask, setActiveTask] = useState<TaskDefinition | null>(null);
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null);
  const [detailText, setDetailText] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [defaultFieldName, setDefaultFieldName] = useState<string | null>(null);
  const [defaultDurationHours, setDefaultDurationHours] = useState(1);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [quickAddedTask, setQuickAddedTask] = useState<TaskEntry | null>(null);
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
  const [draftLogId, setDraftLogId] = useState<string | null>(null);
  const [isDiscardingVoiceDraft, setIsDiscardingVoiceDraft] = useState(false);
  const voicePollGenerationRef = useRef(0);

  // --- Error ---
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const loadedFields = await listFields();
      setFields(loadedFields);
      setDefaultFieldName((current) => {
        if (current && loadedFields.some((field) => field.name === current)) return current;
        return loadedFields.length === 1 ? loadedFields[0].name : null;
      });
    } catch (err) {
      console.error("[RecordPage] Failed to fetch fields:", err);
      setFieldsError(
        err instanceof Error ? err.message : "필지 목록을 불러오지 못했습니다."
      );
    } finally {
      setFieldsLoading(false);
    }
  }, []);

  // --- Fetch weather + fields and restore fast-entry preferences on mount ---
  useEffect(() => {
    const storedPreferences = parseRecordPreferences(
      window.localStorage.getItem(FARMER_RECORD_PREFERENCES_KEY)
    );
    setDefaultFieldName(storedPreferences.fieldName);
    setDefaultDurationHours(storedPreferences.durationHours);

    getCurrentWeather()
      .then(setWeather)
      .catch((err) => {
        console.error("[RecordPage] Failed to fetch weather:", err);
      })
      .finally(() => setWeatherLoading(false));

    void loadFields();

    return () => {
      // Invalidate any in-flight voice polling when the page unmounts.
      voicePollGenerationRef.current += 1;
    };
  }, [loadFields]);

  useEffect(() => {
    if (!requestedEditId) {
      setLogDate(normalizeRecordDate(requestedDate));
    }
  }, [requestedDate, requestedEditId]);

  useEffect(() => {
    if (!requestedEditId) {
      setEditLoading(false);
      setEditLoadError(null);
      return;
    }

    let cancelled = false;
    setEditLoading(true);
    setEditLoadError(null);
    setError(null);

    getFarmLog(requestedEditId)
      .then((log) => {
        if (cancelled) return;
        const hydrated = hydrateLogForEditing(log);
        voicePollGenerationRef.current += 1;
        setInputMode("manual");
        setPageState("entry");
        setManualLogId(log.id);
        setLogDate(log.log_date);
        setLogCrop(log.crop || "사과");
        setTasks(hydrated.tasks);
        setQuickAddedTask(null);
        setPreservedChemicals(hydrated.preservedChemicals);
        setNotes(log.notes || "");
        setPhotos([]);
        setCompletionWarning(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setManualLogId(null);
        setEditLoadError(
          err instanceof Error ? err.message : "수정할 기록을 불러오지 못했습니다."
        );
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedEditId]);

  // --- Today's date in Korean ---
  const todayDate = localDateISO();
  const yesterdayDate = getYesterdayDate();
  const dateFormatted = new Date(`${logDate}T00:00:00`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // --- Weather display ---
  const weatherSummary = weather
    ? `${SKY_EMOJI[weather.sky || ""] || "🌤️"} ${weather.temperature ?? "--"}°C · ${weather.sky || ""}${weather.humidity ? ` · 습도 ${weather.humidity}%` : ""}`
    : null;

  const selectLogDate = (date: string) => {
    const normalizedDate = normalizeRecordDate(date, logDate);
    setLogDate(normalizedDate);
    setParsedData((current) =>
      current ? { ...current, date: normalizedDate } : current
    );
  };

  // --- Task detail panel helpers ---

  const rememberQuickDefaults = (fieldName: string | null, hours: number) => {
    setDefaultFieldName(fieldName);
    setDefaultDurationHours(hours);
    window.localStorage.setItem(
      FARMER_RECORD_PREFERENCES_KEY,
      serializeRecordPreferences({ fieldName, durationHours: hours })
    );
  };

  const openTaskPanel = (task: TaskDefinition, existingTask?: TaskEntry) => {
    setActiveTask(task);
    setEditingTaskId(existingTask?.id ?? null);
    setSelectedFieldName(existingTask?.fieldName ?? defaultFieldName);
    setDetailText(existingTask?.detail ?? "");
    setDurationHours(existingTask?.durationHours ?? defaultDurationHours);
    setChemicalName(existingTask?.chemicalName ?? "");
    setDilutionRatio(existingTask?.dilutionRatio ?? "");
    setSprayAmount(existingTask?.sprayAmount ?? "");
    setFertilizerName(existingTask?.fertilizerName ?? "");
    setFertilizerAmount(existingTask?.fertilizerAmount ?? "");
  };

  const closeTaskPanel = () => {
    setActiveTask(null);
    setEditingTaskId(null);
  };

  const addTaskToList = () => {
    if (!activeTask) return;

    const entry: TaskEntry = {
      id: editingTaskId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

    setTasks((previous) =>
      editingTaskId
        ? previous.map((task) => (task.id === editingTaskId ? entry : task))
        : [...previous, entry]
    );
    rememberQuickDefaults(selectedFieldName, durationHours);
    setQuickAddedTask(null);
    closeTaskPanel();
  };

  const addQuickTask = (task: TaskDefinition) => {
    const entry: TaskEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stage: task.stage,
      emoji: task.emoji,
      fieldName: defaultFieldName || undefined,
      durationHours: defaultDurationHours,
    };
    setTasks((previous) => [...previous, entry]);
    setQuickAddedTask(entry);
    rememberQuickDefaults(defaultFieldName, defaultDurationHours);
  };

  const editTask = (task: TaskEntry) => {
    const definition = TASK_BUTTONS.find((item) => item.stage === task.stage) ?? {
      stage: task.stage,
      emoji: task.emoji,
      label: task.stage,
    };
    openTaskPanel(definition, task);
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setQuickAddedTask((current) => (current?.id === id ? null : current));
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
    let logId = manualLogId;
    let draftSaved = false;

    try {
      // Build chemicals array from 방제 tasks
      const chemicals = tasks
        .filter((t) => t.stage === "방제" && t.chemicalName)
        .map((t) => ({
          type: "농약" as const,
          name: t.chemicalName!,
          amount: t.sprayAmount || undefined,
          dilution_ratio: t.dilutionRatio || undefined,
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

      const logInput: FarmLogWriteInput = {
        log_date: logDate,
        crop: logCrop,
        tasks: tasks.map((t) => ({
          field_name: t.fieldName || undefined,
          stage: t.stage,
          detail: t.detail || undefined,
          duration_hours: t.durationHours || undefined,
        })),
        chemicals: [...chemicals, ...fertilizers, ...preservedChemicals].length > 0
          ? [...chemicals, ...fertilizers, ...preservedChemicals]
          : undefined,
        notes: notes.trim() || undefined,
      };

      if (logId) {
        await updateFarmLog(logId, logInput);
      } else {
        const log = await createFarmLog(logInput);
        logId = log.id;
        setManualLogId(log.id);
      }
      draftSaved = true;

      if (photos.length > 0) {
        try {
          await uploadFarmLogPhotos(logId, photos);
        } catch (photoErr) {
          console.error("[record] Photo upload failed:", photoErr);
          setCompletionWarning(
            "기록은 저장됐지만 사진 업로드에 실패했습니다. 기록 상세에서 사진을 다시 확인해주세요."
          );
        } finally {
          // A confirmation retry must not attach the same files twice.
          setPhotos([]);
        }
      }

      await confirmFarmLog(logId);
      setPageState("saved");
    } catch (err) {
      setError(
        draftSaved
          ? "기록은 임시 저장됐지만 확인 완료에 실패했습니다. 다시 누르면 같은 기록의 확인을 재시도합니다."
          : err instanceof Error
            ? err.message
            : "저장에 실패했습니다."
      );
      setPageState("entry");
    }
  };

  // --- Voice mode handlers ---

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    if (!VOICE_RECORDING_BUILD_ENABLED) return;
    const pollGeneration = ++voicePollGenerationRef.current;
    setPageState("uploading");
    setError(null);
    setDraftLogId(null);
    setCompletionWarning(null);

    try {
      const result = await uploadVoice(blob);
      setRecordingId(result.id);

      if (result.status === "failed") {
        throw new Error(result.message || "음성 처리에 실패했습니다.");
      }

      if (result.status !== "completed") {
        let completed = false;
        let consecutiveErrors = 0;
        for (let attempt = 0; attempt < VOICE_POLL_MAX_ATTEMPTS; attempt += 1) {
          if (pollGeneration !== voicePollGenerationRef.current) return;

          let status;
          try {
            status = await getVoiceStatus(result.id);
            consecutiveErrors = 0;
          } catch (statusError) {
            consecutiveErrors += 1;
            if (consecutiveErrors >= VOICE_POLL_MAX_CONSECUTIVE_ERRORS) {
              throw statusError;
            }
            await wait(VOICE_POLL_INTERVAL_MS);
            continue;
          }

          if (status.status === "completed") {
            completed = true;
            break;
          }
          if (status.status === "failed") {
            throw new Error(status.error_message || "음성 처리에 실패했습니다.");
          }
          await wait(VOICE_POLL_INTERVAL_MS);
        }

        if (!completed) {
          throw new Error("음성 분석이 60초 안에 끝나지 않았습니다. 잠시 후 다시 시도해주세요.");
        }
      }

      if (pollGeneration !== voicePollGenerationRef.current) return;
      const voiceResult = await getVoiceResult(result.id);
      if (!voiceResult.parsed_data) {
        throw new Error("AI 분석 결과가 비어 있습니다. 다시 녹음해주세요.");
      }
      setParsedData({
        ...normalizeParsedFarmLog(voiceResult.parsed_data),
        // A date explicitly selected before recording is authoritative.
        date: logDate,
      });
      setTranscript(voiceResult.transcript);
      setPageState("review");
    } catch (err) {
      if (pollGeneration !== voicePollGenerationRef.current) return;
      setError(err instanceof Error ? err.message : "음성 업로드에 실패했습니다.");
      setPageState("entry");
    }
  }, [logDate]);

  const handleVoiceConfirm = async () => {
    if (!parsedData) return;

    if (parsedData.tasks.length === 0) {
      setError("작업을 1개 이상 확인해주세요.");
      return;
    }
    if (
      parsedData.field_names.length > 0 &&
      parsedData.tasks.some((task) => !task.field_name)
    ) {
      setError("여러 필지가 감지되었습니다. 각 작업의 필지를 선택해주세요.");
      return;
    }

    setPageState("saving");
    setError(null);
    let logId = draftLogId;
    let draftSaved = false;
    const logInput = {
      voice_recording_id: recordingId || undefined,
      log_date: parsedData.date,
      crop: parsedData.crop,
      tasks: parsedData.tasks.map((task) => ({
        field_name: task.field_name || undefined,
        stage: task.stage,
        detail: task.detail || undefined,
        duration_hours: task.duration_hours || undefined,
      })),
      chemicals: parsedData.chemicals.map((chemical) => ({
        type: chemical.type,
        name: chemical.name,
        amount: chemical.amount || undefined,
        dilution_ratio: chemical.dilution_ratio || undefined,
        action: chemical.action,
      })),
      weather_farmer: parsedData.weather_farmer || undefined,
      notes: parsedData.notes || undefined,
    };

    try {
      if (!logId) {
        const log = await createFarmLog(logInput);
        logId = log.id;
        setDraftLogId(logId);
        draftSaved = true;

        // Photos are attached only on first creation so a confirmation retry
        // cannot duplicate the same uploads.
        if (photos.length > 0) {
          try {
            await uploadFarmLogPhotos(logId, photos);
          } catch (photoErr) {
            console.error("[record] Photo upload failed:", photoErr);
            setCompletionWarning(
              "기록은 저장됐지만 사진 업로드에 실패했습니다. 기록 상세에서 사진을 다시 확인해주세요."
            );
          } finally {
            setPhotos([]);
          }
        }
      } else {
        // A failed confirmation leaves a server-side draft. Sync the current
        // review before retrying so the farmer confirms what is on screen.
        await updateFarmLog(logId, logInput);
        draftSaved = true;
      }

      await confirmFarmLog(logId);
      setDraftLogId(null);
      setPageState("saved");
    } catch (err) {
      setError(
        draftSaved
          ? "기록은 임시 저장됐지만 확인 완료에 실패했습니다. 다시 누르면 중복 생성 없이 확인을 재시도합니다."
          : err instanceof Error
            ? err.message
            : "저장에 실패했습니다."
      );
      setPageState("review");
    }
  };

  const handleVoiceDiscard = async () => {
    if (isDiscardingVoiceDraft) return;

    voicePollGenerationRef.current += 1;
    setIsDiscardingVoiceDraft(true);
    setError(null);
    try {
      if (draftLogId) {
        await deleteFarmLog(draftLogId, true);
      }
      setPageState("entry");
      setParsedData(null);
      setTranscript(null);
      setRecordingId(null);
      setDraftLogId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "임시 기록 삭제에 실패했습니다.");
    } finally {
      setIsDiscardingVoiceDraft(false);
    }
  };

  const handleReset = () => {
    voicePollGenerationRef.current += 1;
    if (requestedEditId) router.replace("/farmer/record");
    setInputMode("manual");
    setPageState("entry");
    setLogDate(normalizeRecordDate(requestedDate));
    setLogCrop("사과");
    setManualLogId(null);
    setPreservedChemicals([]);
    setEditLoadError(null);
    setCompletionWarning(null);
    setTasks([]);
    setQuickAddedTask(null);
    setEditingTaskId(null);
    setPhotos([]);
    setNotes("");
    setError(null);
    setParsedData(null);
    setTranscript(null);
    setRecordingId(null);
    setDraftLogId(null);
    setIsDiscardingVoiceDraft(false);
  };

  // ============================
  // Render
  // ============================

  if (editLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: "#F5F1EC" }}
      >
        <div
          className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mb-4"
          style={{ borderColor: "#2D5016", borderTopColor: "transparent" }}
        />
        <p className="text-sm font-medium" style={{ color: "#2D5016" }}>
          기록을 불러오는 중...
        </p>
      </div>
    );
  }

  if (requestedEditId && !manualLogId) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: "#F5F1EC" }}
      >
        <div
          role="alert"
          className="w-full max-w-sm rounded-2xl p-5 text-sm mb-4"
          style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}
        >
          ⚠️ {editLoadError || "수정할 기록을 불러오지 못했습니다."}
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 py-4 rounded-2xl font-medium text-sm"
            style={{ backgroundColor: "#FFFFFF", color: "#2D5016" }}
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => router.push("/farmer/logs")}
            className="flex-1 py-4 rounded-2xl font-bold text-sm text-white"
            style={{ backgroundColor: "#2D5016" }}
          >
            기록 목록
          </button>
        </div>
      </div>
    );
  }

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
          {requestedEditId
            ? "영농일지가 수정되었습니다"
            : "영농일지가 저장되었습니다"}
        </p>
        {completionWarning && (
          <div
            role="alert"
            className="w-full max-w-xs rounded-xl p-4 text-sm mb-5"
            style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}
          >
            ⚠️ {completionWarning}
          </div>
        )}
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
    <div
      className="min-h-screen pb-56"
      style={
        {
          backgroundColor: "#F5F1EC",
          "--farmer-nav-height": "72px",
        } as React.CSSProperties
      }
    >
      {/* ============ HEADER ============ */}
      <div className="px-4 pt-6 pb-4" style={{ backgroundColor: "#FFFFFF" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>
          {requestedEditId
            ? "영농일지 수정"
            : logDate === todayDate
              ? "오늘 작업 기록"
              : "지난 작업 기록"}
        </h1>
        <p className="text-sm mb-3" style={{ color: "#6B6B6B" }}>
          {dateFormatted}
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

        <div className="mt-4">
          <p className="mb-2 text-sm font-bold" style={{ color: "#384832" }}>
            작업 날짜
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selectLogDate(todayDate)}
              className="min-h-12 rounded-xl text-base font-bold"
              style={{
                backgroundColor: logDate === todayDate ? "#2D5016" : "#F5F1EC",
                color: logDate === todayDate ? "#FFFFFF" : "#2D5016",
              }}
              aria-pressed={logDate === todayDate}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => selectLogDate(yesterdayDate)}
              className="min-h-12 rounded-xl text-base font-bold"
              style={{
                backgroundColor: logDate === yesterdayDate ? "#2D5016" : "#F5F1EC",
                color: logDate === yesterdayDate ? "#FFFFFF" : "#2D5016",
              }}
              aria-pressed={logDate === yesterdayDate}
            >
              어제
            </button>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">다른 작업 날짜 선택</span>
            <input
              type="date"
              value={logDate}
              onChange={(event) => selectLogDate(event.target.value)}
              className="min-h-13 w-full rounded-xl border px-4 text-base font-semibold"
              style={{ borderColor: "#D7DDD2", backgroundColor: "#FFFFFF", color: "#243D18" }}
            />
          </label>
        </div>

        {/* Mode toggle — manual / voice */}
        {VOICE_RECORDING_BUILD_ENABLED && !requestedEditId && (
          <div
            className="mt-4 flex rounded-xl overflow-hidden"
            style={{ backgroundColor: "#F5F1EC" }}
          >
          <button
            onClick={() => {
              if (draftLogId) {
                setError("임시 저장된 음성 기록의 확인을 먼저 완료하거나 다시 녹음해주세요.");
                return;
              }
              voicePollGenerationRef.current += 1;
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
              if (draftLogId) {
                setError("임시 저장된 음성 기록의 확인을 완료하거나 다시 녹음을 선택해주세요.");
                return;
              }
              setInputMode("voice");
              setError(null);
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
        )}
      </div>

      {/* ============ ERROR ============ */}
      {error && !(inputMode === "voice" && pageState === "review") && (
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
      {VOICE_RECORDING_BUILD_ENABLED && inputMode === "voice" && (
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
              availableFields={fields}
              onChange={setParsedData}
              onConfirm={handleVoiceConfirm}
              onDiscard={handleVoiceDiscard}
              loading={false}
              discarding={isDiscardingVoiceDraft}
              error={error}
            />
          )}
        </div>
      )}

      {/* ============ MANUAL MODE ============ */}
      {inputMode === "manual" && pageState === "entry" && (
        <>
          <section className="mx-4 mt-5 rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF" }}>
            <h2 className="text-base font-bold" style={{ color: "#2D5016" }}>
              빠른 입력 기본값
            </h2>
            <p className="mt-1 text-sm" style={{ color: "#66705F" }}>
              아래 값으로 작업이 바로 추가됩니다.
            </p>

            <div className="mt-4">
              <p className="mb-2 text-sm font-bold" style={{ color: "#384832" }}>필지</p>
              {fieldsLoading ? (
                <p className="min-h-12 py-3 text-sm" style={{ color: "#66705F" }}>필지를 불러오는 중...</p>
              ) : fieldsError ? (
                <div className="rounded-xl border p-3" style={{ backgroundColor: "#FFF8EC", borderColor: "#D8A45B" }} role="alert">
                  <p className="text-sm font-semibold" style={{ color: "#754315" }}>
                    필지를 불러오지 못했습니다. 빈 필지로 처리하지 않았습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadFields()}
                    className="mt-2 min-h-12 rounded-xl px-5 text-sm font-bold"
                    style={{ backgroundColor: "#FFFFFF", color: "#2D5016", border: "1px solid #AFC3A3" }}
                  >
                    다시 불러오기
                  </button>
                </div>
              ) : fields.length === 0 ? (
                <button
                  type="button"
                  onClick={() => router.push("/farmer/fields")}
                  className="min-h-12 w-full rounded-xl px-4 text-sm font-bold"
                  style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                >
                  필지를 먼저 등록하기 →
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fields.map((field) => (
                    <button
                      type="button"
                      key={field.id}
                      onClick={() => rememberQuickDefaults(field.name, defaultDurationHours)}
                      className="min-h-12 rounded-xl px-4 text-sm font-bold"
                      style={{
                        backgroundColor: defaultFieldName === field.name ? "#2D5016" : "#F5F1EC",
                        color: defaultFieldName === field.name ? "#FFFFFF" : "#2D5016",
                      }}
                      aria-pressed={defaultFieldName === field.name}
                    >
                      {field.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-bold" style={{ color: "#384832" }}>작업 시간</p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_DURATION_OPTIONS.map((hours) => (
                  <button
                    type="button"
                    key={hours}
                    onClick={() => rememberQuickDefaults(defaultFieldName, hours)}
                    className="min-h-12 rounded-xl text-sm font-bold"
                    style={{
                      backgroundColor: defaultDurationHours === hours ? "#2D5016" : "#F5F1EC",
                      color: defaultDurationHours === hours ? "#FFFFFF" : "#2D5016",
                    }}
                    aria-pressed={defaultDurationHours === hours}
                  >
                    {hours < 1 ? "30분" : `${hours}시간`}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* --- Quick Task Buttons --- */}
          <div className="px-4 mt-6">
            <p className="mb-3 text-sm font-bold" style={{ color: "#384832" }}>
              한 작업을 누르면 바로 추가됩니다
            </p>
            <div className="grid grid-cols-4 gap-3">
              {TASK_BUTTONS.map((task) => (
                <button
                  type="button"
                  key={task.stage}
                  onClick={() =>
                    DETAIL_FIRST_STAGES.has(task.stage)
                      ? openTaskPanel(task)
                      : addQuickTask(task)
                  }
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

            {quickAddedTask && (
              <div
                className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-xl px-4"
                style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                role="status"
              >
                <p className="text-sm font-bold">{quickAddedTask.stage} 작업을 추가했습니다.</p>
                <button
                  type="button"
                  onClick={() => removeTask(quickAddedTask.id)}
                  className="min-h-12 shrink-0 rounded-lg px-3 text-sm font-bold underline"
                >
                  실행 취소
                </button>
              </div>
            )}
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
                    type="button"
                    onClick={closeTaskPanel}
                    className="flex h-12 w-12 items-center justify-center rounded-full"
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
                    <p className="min-h-12 py-3 text-sm" style={{ color: "#66705F" }}>불러오는 중...</p>
                  ) : fieldsError ? (
                    <div className="rounded-xl p-3" style={{ backgroundColor: "#FFF8EC" }} role="alert">
                      <p className="text-sm font-semibold" style={{ color: "#754315" }}>필지 확인에 실패했습니다.</p>
                      <button
                        type="button"
                        onClick={() => void loadFields()}
                        className="mt-2 min-h-12 rounded-lg px-4 text-sm font-bold"
                        style={{ backgroundColor: "#FFFFFF", color: "#2D5016" }}
                      >
                        다시 불러오기
                      </button>
                    </div>
                  ) : fields.length === 0 ? (
                    <p className="text-sm" style={{ color: "#66705F" }}>
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
                          className="min-h-12 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors"
                          style={{
                            backgroundColor:
                              selectedFieldName === field.name ? "#2D5016" : "#F5F1EC",
                            color:
                              selectedFieldName === field.name ? "#FFFFFF" : "#2D5016",
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
                    className="min-h-13 w-full rounded-xl border-none px-4 py-3 text-base outline-none"
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

                {/* 방제 (pest control) fields — record only, no safety recommendation */}
                {activeTask.stage === "방제" && (
                  <div className="mb-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                        약제명
                      </label>
                      <input
                        type="text"
                        value={chemicalName}
                        onChange={(e) => setChemicalName(e.target.value)}
                        placeholder="실제로 사용한 제품명을 입력하세요"
                        className="min-h-13 w-full rounded-xl border-none px-4 py-3 text-base outline-none"
                        style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                      />
                      <p className="text-xs mt-2" style={{ color: "#9B9B9B" }}>
                        제품 라벨과 공식 농약안전정보를 직접 확인한 뒤 기록해주세요.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold mb-2 block" style={{ color: "#6B6B6B" }}>
                        희석 배수
                      </label>
                      <input
                        type="text"
                        value={dilutionRatio}
                        onChange={(e) => setDilutionRatio(e.target.value)}
                        placeholder="예: 1000배"
                        className="min-h-13 w-full rounded-xl border-none px-4 py-3 text-base outline-none"
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
                        className="min-h-13 w-full rounded-xl border-none px-4 py-3 text-base outline-none"
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
                        className="min-h-13 w-full rounded-xl border-none px-4 py-3 text-base outline-none"
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
                        className="min-h-13 w-full rounded-xl border-none px-4 py-3 text-base outline-none"
                        style={{ backgroundColor: "#F5F1EC", color: "#1A1A1A" }}
                      />
                    </div>
                  </div>
                )}

                {/* Add task button */}
                <button
                  type="button"
                  onClick={addTaskToList}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: "#2D5016", minHeight: "56px" }}
                >
                  {editingTaskId ? "작업 수정 완료" : "작업 추가"}
                </button>
              </div>
            </div>
          )}

          {/* --- Running Task List --- */}
          {tasks.length > 0 && (
            <div className="px-4 mt-6">
              <p className="mb-3 text-sm font-bold" style={{ color: "#384832" }}>
                기록할 작업 ({tasks.length}건)
              </p>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ backgroundColor: "#FFFFFF" }}
                  >
                    <button
                      type="button"
                      onClick={() => editTask(task)}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
                      aria-label={`${task.stage} 작업 수정`}
                    >
                      <span className="shrink-0 text-xl">{task.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-base font-bold" style={{ color: "#1A1A1A" }}>
                            {task.stage}
                          </span>
                          {task.fieldName && (
                            <span
                              className="rounded-full px-2 py-0.5 text-sm"
                              style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                            >
                              {task.fieldName}
                            </span>
                          )}
                        </span>
                        {task.detail && (
                          <span className="block truncate text-sm" style={{ color: "#6B6B6B" }}>
                            {task.detail}
                          </span>
                        )}
                        <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="text-sm" style={{ color: "#66705F" }}>
                            {task.durationHours}시간 · 눌러서 수정
                          </span>
                          {task.chemicalName && (
                            <span className="text-sm" style={{ color: "#A33D1E" }}>
                              💊 {task.chemicalName}
                              {task.dilutionRatio ? ` (${task.dilutionRatio})` : ""}
                            </span>
                          )}
                          {task.fertilizerName && (
                            <span className="text-sm" style={{ color: "#2D5016" }}>
                              🌱 {task.fertilizerName}
                              {task.fertilizerAmount ? ` ${task.fertilizerAmount}` : ""}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg active:scale-95"
                      style={{ backgroundColor: "#F5F1EC", color: "#D4421E" }}
                      aria-label={`${task.stage} 작업 삭제`}
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
              <label className="mb-2 block text-sm font-bold" style={{ color: "#384832" }}>
                메모 (선택)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="이 날의 특이사항이 있으면 메모하세요"
                rows={2}
                className="min-h-14 w-full resize-none rounded-xl border-none px-4 py-3 text-base outline-none"
                style={{ backgroundColor: "#FFFFFF", color: "#1A1A1A" }}
              />
            </div>
          )}

          {FARM_LOG_PHOTO_UPLOAD_BUILD_ENABLED && (
            <div className="px-4 mt-6">
              <label className="mb-2 block text-sm font-bold" style={{ color: "#384832" }}>
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
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl flex flex-col items-center justify-center active:scale-95"
                  style={{ backgroundColor: "#FFFFFF", color: "#6B6B6B" }}
                >
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-sm">추가</span>
                </button>
                {photos.map((photo, i) => (
                  <PhotoPreview
                    key={`${photo.name}-${photo.lastModified}-${i}`}
                    photo={photo}
                    index={i}
                    onRemove={removePhoto}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ BOTTOM SAVE BAR (manual mode only) ============ */}
      {inputMode === "manual" && pageState === "entry" && tasks.length > 0 && (
        <div
          className="fixed left-0 right-0 z-40 px-4 py-4 border-t"
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: "#E5E2DB",
            bottom:
              "calc(var(--farmer-nav-height, 72px) + env(safe-area-inset-bottom))",
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

export default function RecordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center text-sm"
          style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
        >
          기록을 불러오는 중...
        </div>
      }
    >
      <RecordPageContent />
    </Suspense>
  );
}
