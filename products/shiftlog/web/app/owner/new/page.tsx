"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  inferFromMedia,
  type WorkflowInferenceResult,
  type WorkflowStep,
} from "@/lib/api";

// Pre-baked sample of what Claude returns for the cafe closing scenario.
// Used by the "샘플 보기" button so the UI is demoable without API keys.
const SAMPLE_RESULT: WorkflowInferenceResult = {
  workflow: {
    name: "마감조 작업",
    description: "카페 마감 시 청소, 매출 정산, 재고 확인 후 가게 잠그기",
    estimated_duration_minutes: 30,
    industry_hint: "cafe",
    steps: [
      { order: 1, name: "카운터 위 정리", description: "컵, 영수증, 메뉴판 정리", duration_estimate_minutes: 3, verification: { type: "none", ai_check: null, captures: null } },
      { order: 2, name: "에스프레소 머신 청소", description: "표면 닦고 트레이 빼서 씻기, 청소 후 사진", duration_estimate_minutes: 10, verification: { type: "photo", ai_check: "머신 표면에 커피 잔여물 없음", captures: null } },
      { order: 3, name: "바닥 청소", description: "객장 바닥, 음료 자국 제거, 청소 후 사진", duration_estimate_minutes: 5, verification: { type: "photo", ai_check: "바닥에 음료 자국이나 부스러기 없음", captures: null } },
      { order: 4, name: "매출 정산", description: "현금/카드 매출 합산, 음성 보고", duration_estimate_minutes: 5, verification: { type: "voice", ai_check: null, captures: ["cash_total_krw", "card_total_krw"] } },
      { order: 5, name: "재고 확인", description: "원두/우유/시럽 남은 양 음성 보고", duration_estimate_minutes: 4, verification: { type: "voice", ai_check: null, captures: ["beans_remaining", "milk_remaining", "syrup_remaining"] } },
      { order: 6, name: "불 끄고 문 잠그기", description: "조명/전자기기 끄고 시건", duration_estimate_minutes: 1, verification: { type: "none", ai_check: null, captures: null } },
    ],
  },
  clarifying_questions: [
    "카운터 정리가 머신 청소보다 먼저인지, 사장님 평소 순서대로 알려주세요.",
    "매출 정산할 때 현금만 세는지, 영수증 합계와도 대조하는지 확인 부탁드립니다.",
    "재고 카운트할 때 원두/우유/시럽 외에 다른 부재료도 함께 보시나요?",
  ],
};

type Stage = "idle" | "recording" | "review" | "submitting" | "done" | "error";

export default function NewWorkflowPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMime, setAudioMime] = useState<string>("audio/webm");
  const [recordingSecs, setRecordingSecs] = useState(0);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [result, setResult] = useState<WorkflowInferenceResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Generate + revoke photo preview URLs.
  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  // Stop timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("이 브라우저는 음성 녹음을 지원하지 않아요. 다른 브라우저로 열어주세요.");
      setStage("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported codec — browsers vary.
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setAudioMime(recorder.mimeType || "audio/webm");

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        setStage("review");
      };

      recorder.start();
      setStage("recording");
      setRecordingSecs(0);
      timerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    } catch (e) {
      console.error(e);
      setError(
        "마이크 권한이 필요해요. 브라우저 주소창의 자물쇠 아이콘에서 마이크 허용 후 다시 시도해주세요.",
      );
      setStage("error");
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  }

  function resetRecording() {
    setAudioBlob(null);
    setRecordingSecs(0);
    setStage("idle");
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setPhotos((prev) => [...prev, ...newFiles]);
    e.target.value = ""; // allow re-selecting same file
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!audioBlob) return;
    setStage("submitting");
    setError(null);
    try {
      const extension = audioMime.includes("mp4") ? "mp4" : audioMime.includes("ogg") ? "ogg" : "webm";
      const data = await inferFromMedia({
        audio: audioBlob,
        audioFilename: `recording.${extension}`,
        photos,
        industryHint: "cafe",
      });
      setResult(data);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("review"); // back to review so they can retry
    }
  }

  function showSample() {
    setError(null);
    setResult(SAMPLE_RESULT);
    setStage("done");
  }

  // ---- Render ----
  return (
    <main className="px-6 py-8 sm:px-8 max-w-2xl mx-auto min-h-screen">
      <Link
        href="/owner/dashboard"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-6"
      >
        ← 대시보드
      </Link>

      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          새 작업지시서
        </h1>
        <p className="text-[var(--color-text-secondary)] leading-relaxed">
          신입 알바한테 평소처럼 설명해주세요. 가게 돌면서 사진도 같이.
        </p>
      </header>

      {stage === "idle" && (
        <div className="space-y-6">
          <RecordButton onStart={startRecording} large />
          <p className="text-center text-sm text-[var(--color-text-muted)]">
            버튼 누르고 자유롭게 말씀하시면 돼요. 시간 제한 없어요.
          </p>
          <div className="pt-6 border-t border-[var(--color-border)] flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={showSample}
              className="text-sm text-[var(--color-accent)] underline hover:text-[var(--color-primary)]"
            >
              샘플 결과 미리 보기 (API 없이)
            </button>
            <Link
              href="/owner/new/advanced"
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              고급 모드 (텍스트 직접 입력)
            </Link>
          </div>
        </div>
      )}

      {stage === "recording" && (
        <div className="flex flex-col items-center gap-6 py-12">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            <div className="relative w-32 h-32 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg">
              <span className="text-5xl">🎙️</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums">{formatTime(recordingSecs)}</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">녹음 중…</p>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="px-8 py-4 rounded-2xl bg-[var(--color-primary)] text-white font-semibold text-lg shadow-sm hover:bg-[var(--color-primary-light)] transition-colors"
          >
            ⏹ 녹음 끝
          </button>
        </div>
      )}

      {stage === "review" && audioBlob && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xl">
              ✓
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">녹음 완료 ({formatTime(recordingSecs)})</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {(audioBlob.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={resetRecording}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              다시 녹음
            </button>
          </div>

          <div>
            <p className="text-sm font-medium mb-3">사진 (선택) — 청소할 곳이나 작업 스테이션</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photoPreviews.map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden border border-[var(--color-border)] group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] flex flex-col items-center justify-center text-[var(--color-text-muted)]"
              >
                <span className="text-3xl">📸</span>
                <span className="text-xs mt-1">추가</span>
              </button>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              <p className="font-semibold mb-1">오류</p>
              <p className="font-mono break-words">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            className="w-full px-6 py-5 rounded-2xl bg-[var(--color-primary)] text-white font-semibold text-lg shadow-sm hover:bg-[var(--color-primary-light)] transition-colors flex items-center justify-center gap-2"
          >
            AI한테 작업지시서 만들어달라고 하기 <span aria-hidden>→</span>
          </button>
        </div>
      )}

      {stage === "submitting" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner large />
          <p className="text-lg font-medium">AI가 듣고 있어요…</p>
          <p className="text-sm text-[var(--color-text-muted)] text-center max-w-xs leading-relaxed">
            음성 받아쓰고, 사진 보고, 작업지시서로 정리하는 데 보통 10-20초 정도 걸려요.
          </p>
        </div>
      )}

      {stage === "error" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-red-50 border border-red-200">
            <p className="font-semibold text-red-900 mb-1">문제가 생겼어요</p>
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStage("idle");
            }}
            className="w-full px-6 py-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-light)] transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      {stage === "done" && result && <WorkflowResult result={result} onRedo={resetRecording} />}
    </main>
  );
}

function RecordButton({ onStart, large }: { onStart: () => void; large?: boolean }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className={`w-full ${large ? "py-12" : "py-8"} rounded-3xl bg-[var(--color-primary)] text-white shadow-sm hover:bg-[var(--color-primary-light)] transition-colors flex flex-col items-center justify-center gap-3`}
    >
      <span className="text-6xl">🎙️</span>
      <span className="text-xl font-bold">녹음 시작</span>
      <span className="text-sm text-white/80">탭하고 가게 돌면서 말씀해주세요</span>
    </button>
  );
}

function WorkflowResult({
  result,
  onRedo,
}: {
  result: WorkflowInferenceResult;
  onRedo: () => void;
}) {
  const wf = result.workflow;
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-[var(--color-accent-soft)] border border-[var(--color-accent)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-2">
          AI 추론 결과
        </p>
        <h2 className="text-2xl font-bold mb-1">{wf.name}</h2>
        <p className="text-[var(--color-text-secondary)] mb-3">{wf.description}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          예상 시간: <strong>{wf.estimated_duration_minutes}분</strong> · 단계 수:{" "}
          <strong>{wf.steps.length}개</strong>
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">작업 단계</h3>
        <ol className="space-y-3">
          {wf.steps.map((s) => (
            <StepCard key={s.order} step={s} />
          ))}
        </ol>
      </div>

      {result.clarifying_questions.length > 0 && (
        <div className="p-5 rounded-xl bg-yellow-50 border border-yellow-200">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-yellow-800 mb-3">
            확인이 필요한 부분
          </h3>
          <ul className="space-y-2">
            {result.clarifying_questions.map((q, i) => (
              <li key={i} className="text-sm text-yellow-900 leading-relaxed">
                <span className="font-semibold">Q{i + 1}.</span> {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          className="flex-1 px-6 py-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-light)] transition-colors"
        >
          이 작업지시서 저장
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="px-6 py-4 rounded-xl bg-transparent text-[var(--color-text)] border border-[var(--color-border)] font-medium hover:border-[var(--color-primary)] transition-colors"
        >
          다시 녹음
        </button>
      </div>

      <details className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-secondary)]">
          개발자용: 전체 JSON 보기
        </summary>
        <pre className="mt-3 text-xs font-mono overflow-x-auto p-3 bg-[var(--color-bg)] rounded">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function StepCard({ step }: { step: WorkflowStep }) {
  const v = step.verification;
  let label = "✓ 자가 확인";
  let color = "bg-gray-100 text-gray-700";
  if (v?.type === "photo") {
    label = "📷 사진 인증";
    color = "bg-blue-100 text-blue-800";
  } else if (v?.type === "voice") {
    label = "🎙️ 음성 보고";
    color = "bg-purple-100 text-purple-800";
  }
  return (
    <li className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex gap-4">
      <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white font-bold flex items-center justify-center">
        {step.order}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h4 className="font-semibold text-lg">{step.name}</h4>
          <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
            ~{step.duration_estimate_minutes}분
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3 leading-relaxed">
          {step.description}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-1 rounded-md font-medium ${color}`}>{label}</span>
          {v?.type === "photo" && v.ai_check && (
            <span className="text-[var(--color-text-muted)] italic">
              검증 기준: &ldquo;{v.ai_check}&rdquo;
            </span>
          )}
          {v?.type === "voice" && v.captures && v.captures.length > 0 && (
            <span className="text-[var(--color-text-muted)] italic">
              수집: {v.captures.join(", ")}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function Spinner({ large }: { large?: boolean }) {
  const size = large ? "h-12 w-12" : "h-5 w-5";
  return (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
