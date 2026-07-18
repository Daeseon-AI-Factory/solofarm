export interface SalesOrder {
  id: string;
  channel: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  weight_option: string | null;
  unit_price: number | string | null;
  total_amount: number | string | null;
  status: string;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ManualOrderChannel = "kakao" | "phone" | "offline";

export interface ManualOrderInput {
  channel: ManualOrderChannel;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  product_name: string;
  quantity: number;
  weight_option: string;
  unit_price: number;
  total_amount: number;
  notes?: string;
}

async function adminOrderFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api/admin/orders${path}`, {
    ...options,
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.detail?.message ||
      (typeof body?.detail === "string" ? body.detail : null) ||
      body?.error?.message ||
      (response.status === 401
        ? "관리자 로그인이 필요합니다"
        : `주문 요청에 실패했습니다 (HTTP ${response.status})`);
    throw new Error(message);
  }

  return response.json();
}

export async function listAdminOrders(params?: {
  status?: string;
  channel?: string;
}): Promise<SalesOrder[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.channel) query.set("channel", params.channel);
  const suffix = query.size ? `?${query.toString()}` : "";
  return adminOrderFetch<SalesOrder[]>(suffix);
}

export function createManualOrder(
  input: ManualOrderInput
): Promise<SalesOrder> {
  return adminOrderFetch("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function confirmOrder(id: string): Promise<SalesOrder> {
  return adminOrderFetch(`/${encodeURIComponent(id)}/confirm`, {
    method: "PUT",
  });
}

export function shipOrder(
  id: string,
  carrier: string,
  trackingNumber: string
): Promise<SalesOrder> {
  const query = new URLSearchParams({
    carrier,
    tracking_number: trackingNumber,
  });
  return adminOrderFetch(`/${encodeURIComponent(id)}/ship?${query}`, {
    method: "PUT",
  });
}

export function deliverOrder(id: string): Promise<SalesOrder> {
  return adminOrderFetch(`/${encodeURIComponent(id)}/deliver`, {
    method: "PUT",
  });
}

export function cancelOrder(
  id: string,
  reason?: string
): Promise<SalesOrder> {
  const query = reason
    ? `?${new URLSearchParams({ reason }).toString()}`
    : "";
  return adminOrderFetch(`/${encodeURIComponent(id)}/cancel${query}`, {
    method: "PUT",
  });
}
