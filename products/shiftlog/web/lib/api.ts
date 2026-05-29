// Backend API client — Next.js proxies /backend/* to FastAPI in dev
// (see next.config.ts). In prod, NEXT_PUBLIC_API_URL is the deployed URL.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/backend";

// Mirror of core/workflow/schemas.py — keep in sync.
export type VerificationType = "photo" | "voice" | "none";

export interface Verification {
  type: VerificationType;
  ai_check?: string | null;
  captures?: string[] | null;
}

export interface WorkflowStep {
  order: number;
  name: string;
  description: string;
  duration_estimate_minutes: number;
  verification: Verification | null;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  estimated_duration_minutes: number;
  industry_hint: string | null;
  steps: WorkflowStep[];
}

export interface WorkflowInferenceInput {
  text_description?: string | null;
  voice_transcripts: string[];
  photo_descriptions: string[];
  industry_hint?: string | null;
  existing_workflow?: WorkflowDefinition | null;
}

export interface WorkflowInferenceResult {
  workflow: WorkflowDefinition;
  clarifying_questions: string[];
}

export interface ApiError {
  code: string;
  message: string;
  debug?: string | null;
}

export async function inferWorkflow(
  input: WorkflowInferenceInput,
): Promise<WorkflowInferenceResult> {
  const res = await fetch(`${API_BASE}/api/v1/workflows/infer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: ApiError };
    const detail = body.detail ?? { code: "UNKNOWN", message: res.statusText };
    throw new Error(`[${detail.code}] ${detail.message}`);
  }

  return res.json();
}

// One-tap inference: send a recorded audio Blob + optional photo Files.
// Backend transcribes + describes + infers in one round trip.
export async function inferFromMedia(opts: {
  audio: Blob;
  audioFilename?: string;
  photos: File[];
  industryHint?: string;
}): Promise<WorkflowInferenceResult> {
  const form = new FormData();
  form.append("audio", opts.audio, opts.audioFilename ?? "recording.webm");
  for (const p of opts.photos) form.append("photos", p);
  if (opts.industryHint) form.append("industry_hint", opts.industryHint);

  const res = await fetch(`${API_BASE}/api/v1/workflows/infer-from-media`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: ApiError };
    const detail = body.detail ?? { code: "UNKNOWN", message: res.statusText };
    throw new Error(`[${detail.code}] ${detail.message}`);
  }

  return res.json();
}
