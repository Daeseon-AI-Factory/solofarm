import type { SalesOrder } from "@/lib/adminOrdersApi";

export type AdminOrderQueue =
  | "action"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "all";

export interface OrderStatusPresentation {
  label: string;
  backgroundColor: string;
  color: string;
}

export const ORDER_STATUS_PRESENTATION: Record<string, OrderStatusPresentation> = {
  inquiry: { label: "정보 확인", color: "#6B4F1D", backgroundColor: "#FFF2CC" },
  paid: { label: "결제 확인", color: "#8A4515", backgroundColor: "#FFF0DD" },
  confirmed: { label: "발송 대기", color: "#234713", backgroundColor: "#E7F2E1" },
  shipped: { label: "배송 중", color: "#22537A", backgroundColor: "#E7F1FA" },
  delivered: { label: "완료", color: "#3F6150", backgroundColor: "#EAF2ED" },
  cancelled: { label: "취소", color: "#9F3218", backgroundColor: "#FEE8E5" },
};

export const ADMIN_ORDER_QUEUES: Array<{ value: AdminOrderQueue; label: string }> = [
  { value: "action", label: "처리 필요" },
  { value: "shipped", label: "배송 중" },
  { value: "delivered", label: "완료" },
  { value: "cancelled", label: "취소" },
  { value: "all", label: "전체" },
];

export function orderMatchesQueue(status: string, queue: AdminOrderQueue): boolean {
  if (queue === "all") return true;
  if (queue === "action") return ["inquiry", "paid", "confirmed"].includes(status);
  return status === queue;
}

export function countOrdersByQueue(
  orders: Pick<SalesOrder, "status">[]
): Record<AdminOrderQueue, number> {
  return {
    action: orders.filter((order) => orderMatchesQueue(order.status, "action")).length,
    shipped: orders.filter((order) => order.status === "shipped").length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    cancelled: orders.filter((order) => order.status === "cancelled").length,
    all: orders.length,
  };
}

function normalizeSearchValue(value: string | null): string {
  return (value ?? "").toLocaleLowerCase("ko-KR").replace(/[\s-]/g, "");
}

export function orderMatchesSearch(
  order: Pick<
    SalesOrder,
    "customer_name" | "customer_phone" | "product_name" | "tracking_number"
  >,
  query: string
): boolean {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return [
    order.customer_name,
    order.customer_phone,
    order.product_name,
    order.tracking_number,
  ].some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}

