"use client";

import Link from "next/link";
import { useState } from "react";
import {
  inferWorkflow,
  type WorkflowInferenceResult,
  type WorkflowStep,
} from "@/lib/api";

// Pre-baked sample of what Claude would return for the cafe closing scenario.
// Lets the UI be demoed without an API key (useful for non-technical owners
// and for offline screen-shares to recruiters/customers).
const SAMPLE_RESULT: WorkflowInferenceResult = {
  workflow: {
    name: "마감조 작업",
    description: "카페 마감 시 청소, 매출 정산, 재고 확인 후 가게 잠그기",
    estimated_duration_minutes: 30,
    industry_hint: "cafe",
    steps: [
      {
        order: 1,
        name: "카운터 위 정리",
        description: "카운터 위 컵, 영수증, 메뉴판 정리",
        duration_estimate_minutes: 3,
        verification: { type: "none", ai_check: null, captures: null },
      },
      {
        order: 2,
        name: "에스프레소 머신 청소",
        description: "표면 닦고 트레이 빼서 씻기, 청소 후 사진 촬영",
        duration_estimate_minutes: 10,
        verification: {
          type: "photo",
          ai_check: "에스프레소 머신 표면에 커피 잔여물이 보이지 않아야 하고 트레이가 깨끗해야 함",
          captures: null,
        },
      },
      {
        order: 3,
        name: "바닥 청소",
        description: "객장 바닥 청소, 음료 자국과 부스러기 제거, 청소 후 사진 촬영",
        duration_estimate_minutes: 5,
        verification: {
          type: "photo",
          ai_check: "바닥에 음료 자국이나 부스러기가 보이지 않아야 함",
          captures: null,
        },
      },
      {
        order: 4,
        name: "매출 정산",
        description: "현금 매출과 카드 매출을 각각 합산하여 음성으로 보고",
        duration_estimate_minutes: 5,
        verification: {
          type: "voice",
          ai_check: null,
          captures: ["cash_total_krw", "card_total_krw"],
        },
      },
      {
        order: 5,
        name: "재고 확인",
        description: "원두, 우유, 시럽 남은 양 음성으로 보고",
        duration_estimate_minutes: 4,
        verification: {
          type: "voice",
          ai_check: null,
          captures: ["beans_remaining", "milk_remaining", "syrup_remaining"],
        },
      },
      {
        order: 6,
        name: "불 끄고 문 잠그기",
        description: "조명과 전자기기 모두 끄고 출입문 시건",
        duration_estimate_minutes: 1,
        verification: { type: "none", ai_check: null, captures: null },
      },
    ],
  },
  clarifying_questions: [
    "카운터 정리가 머신 청소보다 먼저인지, 사장님 평소 순서대로 알려주세요.",
    "매출 정산할 때 현금만 세는지, 영수증 합계와도 대조하는지 확인 부탁드립니다.",
    "재고 카운트할 때 원두/우유/시럽 외에 다른 부재료도 함께 보시나요?",
  ],
};

// Pre-fill with the same demo evidence as core/workflow/demo.py so the user
// can hit submit and see the inference work without typing anything first.
const SAMPLE_VOICE = `오늘 카페 마감조 일은 보통 8시부터 시작해.
일단 에스프레소 머신 청소부터 해 — 표면 닦고 트레이 빼서 씻고.
청소되면 사진 한 장 찍어, 내가 확인할 수 있게.
그다음에 바닥 청소. 이거도 사진 찍어.
아 잠깐, 그 전에 카운터 위 정리부터 했었나? 아무튼 카운터도 깨끗하게.
마지막으로 매출 정산 — 현금이랑 카드 따로 세서 적어. 음성으로 말해줘.
재고도 봐야 해, 원두 우유 시럽 — 다 얼마나 남았는지 음성으로 말해.
그러고 불 끄고 문 잠그면 끝. 30분쯤 걸려.`;

const SAMPLE_PHOTOS = `에스프레소 머신과 그라인더가 카운터 위에 놓여 있는 모습. 표면에 커피 자국이 보임.
카페 내부 객장 바닥 — 테이블 두 개와 의자 4개. 약간의 음료 자국이 보임.
현금 보관함과 영수증 프린터가 카운터 아래에 있는 모습.`;

export default function NewWorkflowPage() {
  const [textDescription, setTextDescription] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState(SAMPLE_VOICE);
  const [photoDescriptions, setPhotoDescriptions] = useState(SAMPLE_PHOTOS);
  const [industryHint, setIndustryHint] = useState("cafe");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WorkflowInferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);

    try {
      const photoList = photoDescriptions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const voiceList = voiceTranscript.trim() ? [voiceTranscript.trim()] : [];

      const data = await inferWorkflow({
        text_description: textDescription.trim() || null,
        voice_transcripts: voiceList,
        photo_descriptions: photoList,
        industry_hint: industryHint || null,
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-6"
      >
        ← 처음으로
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-3">
        작업지시서 만들기
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-8 leading-relaxed">
        가게 돌면서 평소처럼 말씀하신 내용 — 또는 그 음성을 받아 적은
        내용 — 을 그대로 붙여넣으세요. 사진이 있으면 사진 내용도 한 줄씩.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            업종
          </label>
          <select
            value={industryHint}
            onChange={(e) => setIndustryHint(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-primary)]"
          >
            <option value="cafe">카페</option>
            <option value="dry_cleaner">세탁소</option>
            <option value="convenience_store">편의점</option>
            <option value="salon">미용실</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            짧은 설명 <span className="text-[var(--color-text-muted)] font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={textDescription}
            onChange={(e) => setTextDescription(e.target.value)}
            placeholder="예: 마감조 일, 오픈조 일, 토요일 청소…"
            className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            가게 돌면서 설명한 내용 <span className="text-[var(--color-danger)]">*</span>
          </label>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            평소 신입 알바한테 설명하듯 자연스럽게. 순서가 뒤죽박죽이어도 괜찮아요.
          </p>
          <textarea
            value={voiceTranscript}
            onChange={(e) => setVoiceTranscript(e.target.value)}
            rows={10}
            required
            className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-primary)] font-mono text-sm leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            사진 내용 <span className="text-[var(--color-text-muted)] font-normal">(선택, 한 줄에 사진 한 장씩)</span>
          </label>
          <textarea
            value={photoDescriptions}
            onChange={(e) => setPhotoDescriptions(e.target.value)}
            rows={4}
            placeholder="예: 에스프레소 머신과 그라인더가 카운터 위에 있음"
            className="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-primary)] font-mono text-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-lg shadow-sm hover:bg-[var(--color-primary-light)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Spinner />
                AI가 작업지시서 만드는 중…
              </>
            ) : (
              <>
                AI한테 작업지시서 받기
                <span aria-hidden>→</span>
              </>
            )}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setError(null);
              setResult(SAMPLE_RESULT);
              window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)] font-medium hover:bg-[var(--color-primary)] hover:text-white transition-colors disabled:opacity-60"
          >
            샘플 결과 미리 보기
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <p className="font-semibold mb-1">에러</p>
          <p className="text-sm font-mono">{error}</p>
        </div>
      )}

      {result && <WorkflowResult result={result} />}
    </main>
  );
}

function WorkflowResult({ result }: { result: WorkflowInferenceResult }) {
  const wf = result.workflow;

  return (
    <div className="mt-12 space-y-6">
      <div className="p-6 rounded-2xl bg-[var(--color-accent-soft)] border border-[var(--color-accent)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-2">
          AI 추론 결과
        </p>
        <h2 className="text-2xl font-bold mb-1">{wf.name}</h2>
        <p className="text-[var(--color-text-secondary)] mb-3">{wf.description}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          예상 시간: <strong>{wf.estimated_duration_minutes}분</strong> · 단계 수:{" "}
          <strong>{wf.steps.length}개</strong>
          {wf.industry_hint && (
            <>
              {" · "}
              업종: <strong>{wf.industry_hint}</strong>
            </>
          )}
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
  let verifLabel = "✓ 자가 확인";
  let verifColor = "bg-gray-100 text-gray-700";
  if (v?.type === "photo") {
    verifLabel = "📷 사진 인증";
    verifColor = "bg-blue-100 text-blue-800";
  } else if (v?.type === "voice") {
    verifLabel = "🎙️ 음성 보고";
    verifColor = "bg-purple-100 text-purple-800";
  }

  return (
    <li className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white font-bold flex items-center justify-center">
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
          <span className={`px-2 py-1 rounded-md font-medium ${verifColor}`}>
            {verifLabel}
          </span>
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

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
