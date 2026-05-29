// Mock data — used until we wire real persistence. Realistic enough to demo
// the management surface to Korean SMB owners. Replace with real API calls
// once the DB layer lands.

import type { WorkflowDefinition } from "./api";

export interface SavedWorkflow extends WorkflowDefinition {
  id: string;
  created_at: string; // ISO date
  updated_at: string;
  run_count: number;
  last_run_at: string | null;
}

export interface Execution {
  id: string;
  workflow_id: string;
  workflow_name: string;
  alba_id: string;
  alba_name: string;
  started_at: string; // ISO
  completed_at: string | null;
  status: "in_progress" | "completed" | "flagged";
  flagged_steps: string[]; // step names that failed verification
  total_steps: number;
  completed_steps: number;
}

export interface Alba {
  id: string;
  name: string;
  preferred_language: string; // "ko" | "en" | "zh" | "es"
  current_shift: string | null; // workflow name if active
  total_shifts: number;
  joined_at: string;
}

export interface DashboardStats {
  shifts_today: number;
  shifts_in_progress: number;
  shifts_completed_today: number;
  items_flagged_today: number;
}

export const MOCK_WORKFLOWS: SavedWorkflow[] = [
  {
    id: "wf_closing",
    name: "마감조 작업",
    description: "카페 마감 시 청소, 매출 정산, 재고 확인 후 가게 잠그기",
    estimated_duration_minutes: 30,
    industry_hint: "cafe",
    created_at: "2026-05-10T09:00:00Z",
    updated_at: "2026-05-20T14:30:00Z",
    run_count: 18,
    last_run_at: "2026-05-25T22:30:00Z",
    steps: [
      { order: 1, name: "카운터 위 정리", description: "컵, 영수증, 메뉴판 정리", duration_estimate_minutes: 3, verification: { type: "none", ai_check: null, captures: null } },
      { order: 2, name: "에스프레소 머신 청소", description: "표면 닦고 트레이 빼서 씻기, 청소 후 사진", duration_estimate_minutes: 10, verification: { type: "photo", ai_check: "머신 표면에 커피 잔여물 없음", captures: null } },
      { order: 3, name: "바닥 청소", description: "객장 바닥, 음료 자국 제거, 청소 후 사진", duration_estimate_minutes: 5, verification: { type: "photo", ai_check: "바닥에 음료 자국이나 부스러기 없음", captures: null } },
      { order: 4, name: "매출 정산", description: "현금/카드 매출 합산, 음성 보고", duration_estimate_minutes: 5, verification: { type: "voice", ai_check: null, captures: ["cash_total_krw", "card_total_krw"] } },
      { order: 5, name: "재고 확인", description: "원두/우유/시럽 남은 양 음성 보고", duration_estimate_minutes: 4, verification: { type: "voice", ai_check: null, captures: ["beans_remaining", "milk_remaining", "syrup_remaining"] } },
      { order: 6, name: "불 끄고 문 잠그기", description: "조명/전자기기 끄고 시건", duration_estimate_minutes: 1, verification: { type: "none", ai_check: null, captures: null } },
    ],
  },
  {
    id: "wf_opening",
    name: "오픈조 작업",
    description: "카페 오픈 전 머신 예열, 재고 세팅, 청결 확인",
    estimated_duration_minutes: 25,
    industry_hint: "cafe",
    created_at: "2026-05-10T09:00:00Z",
    updated_at: "2026-05-18T08:15:00Z",
    run_count: 22,
    last_run_at: "2026-05-26T07:00:00Z",
    steps: [
      { order: 1, name: "문 열고 조명 켜기", description: "출입문 열고 전체 조명 on", duration_estimate_minutes: 1, verification: { type: "none", ai_check: null, captures: null } },
      { order: 2, name: "에스프레소 머신 예열", description: "전원 켜고 데우기 시작", duration_estimate_minutes: 2, verification: { type: "none", ai_check: null, captures: null } },
      { order: 3, name: "냉장고 온도 체크", description: "온도계 또는 디스플레이 확인, 음성 보고", duration_estimate_minutes: 1, verification: { type: "voice", ai_check: null, captures: ["fridge_temp_celsius"] } },
      { order: 4, name: "원두/우유 재고 보충", description: "그라인더 호퍼 채우기, 우유 냉장 보관", duration_estimate_minutes: 5, verification: { type: "photo", ai_check: "그라인더 호퍼에 원두가 가득 차 있음", captures: null } },
      { order: 5, name: "카운터/객장 정리", description: "전날 못 한 부분 마무리, 의자 정돈", duration_estimate_minutes: 5, verification: { type: "photo", ai_check: "카운터와 객장이 정돈된 상태", captures: null } },
      { order: 6, name: "POS 켜고 영업 시작", description: "POS 켜고 시간대 기록", duration_estimate_minutes: 1, verification: { type: "none", ai_check: null, captures: null } },
    ],
  },
  {
    id: "wf_weekly_clean",
    name: "주간 대청소 (월요일)",
    description: "주 1회 깊은 청소 — 머신 분해 세척, 백 룸 정리, 냉장고 세척",
    estimated_duration_minutes: 90,
    industry_hint: "cafe",
    created_at: "2026-05-13T10:00:00Z",
    updated_at: "2026-05-13T10:00:00Z",
    run_count: 2,
    last_run_at: "2026-05-19T10:00:00Z",
    steps: [
      { order: 1, name: "에스프레소 머신 분해", description: "포터필터, 샤워스크린 분해", duration_estimate_minutes: 15, verification: { type: "none", ai_check: null, captures: null } },
      { order: 2, name: "분해 부품 세제 담그기", description: "백플러시 세제 15분", duration_estimate_minutes: 15, verification: { type: "none", ai_check: null, captures: null } },
      { order: 3, name: "냉장고 내부 세척", description: "음식물 다 빼고 알코올로 닦기", duration_estimate_minutes: 20, verification: { type: "photo", ai_check: "냉장고 내부가 비어있고 깨끗함", captures: null } },
      { order: 4, name: "백 룸 정리", description: "재고 정렬, 만료일 체크, 폐기", duration_estimate_minutes: 30, verification: { type: "voice", ai_check: null, captures: ["disposed_items"] } },
      { order: 5, name: "머신 재조립", description: "분해 부품 조립 후 시운전", duration_estimate_minutes: 10, verification: { type: "photo", ai_check: "에스프레소 추출이 정상적으로 작동", captures: null } },
    ],
  },
];

export const MOCK_EXECUTIONS: Execution[] = [
  {
    id: "exec_001",
    workflow_id: "wf_opening",
    workflow_name: "오픈조 작업",
    alba_id: "alba_minji",
    alba_name: "민지",
    started_at: "2026-05-26T07:00:00Z",
    completed_at: null,
    status: "in_progress",
    flagged_steps: [],
    total_steps: 6,
    completed_steps: 4,
  },
  {
    id: "exec_002",
    workflow_id: "wf_closing",
    workflow_name: "마감조 작업",
    alba_id: "alba_carlos",
    alba_name: "Carlos",
    started_at: "2026-05-25T22:00:00Z",
    completed_at: "2026-05-25T22:30:00Z",
    status: "flagged",
    flagged_steps: ["바닥 청소"],
    total_steps: 6,
    completed_steps: 6,
  },
  {
    id: "exec_003",
    workflow_id: "wf_opening",
    workflow_name: "오픈조 작업",
    alba_id: "alba_minji",
    alba_name: "민지",
    started_at: "2026-05-25T07:05:00Z",
    completed_at: "2026-05-25T07:28:00Z",
    status: "completed",
    flagged_steps: [],
    total_steps: 6,
    completed_steps: 6,
  },
  {
    id: "exec_004",
    workflow_id: "wf_closing",
    workflow_name: "마감조 작업",
    alba_id: "alba_jihoon",
    alba_name: "지훈",
    started_at: "2026-05-24T22:00:00Z",
    completed_at: "2026-05-24T22:35:00Z",
    status: "completed",
    flagged_steps: [],
    total_steps: 6,
    completed_steps: 6,
  },
  {
    id: "exec_005",
    workflow_id: "wf_weekly_clean",
    workflow_name: "주간 대청소 (월요일)",
    alba_id: "alba_jihoon",
    alba_name: "지훈",
    started_at: "2026-05-19T10:00:00Z",
    completed_at: "2026-05-19T11:32:00Z",
    status: "completed",
    flagged_steps: [],
    total_steps: 5,
    completed_steps: 5,
  },
  {
    id: "exec_006",
    workflow_id: "wf_closing",
    workflow_name: "마감조 작업",
    alba_id: "alba_carlos",
    alba_name: "Carlos",
    started_at: "2026-05-23T22:00:00Z",
    completed_at: "2026-05-23T22:33:00Z",
    status: "completed",
    flagged_steps: [],
    total_steps: 6,
    completed_steps: 6,
  },
];

export const MOCK_ALBA: Alba[] = [
  {
    id: "alba_minji",
    name: "민지",
    preferred_language: "ko",
    current_shift: "오픈조 작업",
    total_shifts: 12,
    joined_at: "2026-04-15T00:00:00Z",
  },
  {
    id: "alba_carlos",
    name: "Carlos",
    preferred_language: "es",
    current_shift: null,
    total_shifts: 8,
    joined_at: "2026-04-22T00:00:00Z",
  },
  {
    id: "alba_jihoon",
    name: "지훈",
    preferred_language: "ko",
    current_shift: null,
    total_shifts: 15,
    joined_at: "2026-03-10T00:00:00Z",
  },
];

export const MOCK_STATS: DashboardStats = {
  shifts_today: 2, // opening + closing
  shifts_in_progress: 1,
  shifts_completed_today: 0,
  items_flagged_today: 1, // Carlos's 바닥 청소 from yesterday flagged
};

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay === 1) return "어제";
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function languageLabel(code: string): string {
  const map: Record<string, string> = {
    ko: "한국어",
    en: "English",
    es: "Español",
    zh: "中文",
    fr: "Français",
    vi: "Tiếng Việt",
  };
  return map[code] ?? code;
}
