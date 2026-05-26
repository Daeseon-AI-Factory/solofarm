"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { publicGetOrderStatus } from "@/lib/farmerApi";

/**
 * Public order status lookup — no auth required.
 * Customer enters order ID (or arrives via link from checkout confirmation).
 */

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  inquiry: { label: "문의 접수", color: "#9B9B9B", bg: "#F5F1EC" },
  confirmed: { label: "주문 확인", color: "#2D5016", bg: "#EDF4E8" },
  paid: { label: "결제 완료", color: "#2D5016", bg: "#EDF4E8" },
  shipped: { label: "배송 중", color: "#E8913A", bg: "#FEF3E2" },
  delivered: { label: "배송 완료", color: "#2D5016", bg: "#EDF4E8" },
  cancelled: { label: "주문 취소", color: "#DC2626", bg: "#FEE2E2" },
};

const STATUS_STEPS = ["paid", "confirmed", "shipped", "delivered"];

interface OrderInfo {
  order_id: string;
  status: string;
  product_name: string | null;
  total_amount: number | null;
  payment_status: string | null;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
}

export default function OrderStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFBF7" }}><p style={{ color: "#9B9B9B" }}>로딩 중...</p></div>}>
      <OrderStatusContent />
    </Suspense>
  );
}

function OrderStatusContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id") || "";

  const [orderId, setOrderId] = useState(initialId);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(!!initialId);

  // Auto-search if id is in URL
  useState(() => {
    if (initialId) {
      handleSearch(initialId);
    }
  });

  async function handleSearch(id?: string) {
    const searchId = id || orderId;
    if (!searchId.trim()) {
      setError("주문번호를 입력해주세요");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const data = await publicGetOrderStatus(searchId.trim());
      setOrder(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "주문 조회 실패";
      setError(msg);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  const statusInfo = order ? STATUS_LABELS[order.status] || STATUS_LABELS.inquiry : null;
  const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFBF7" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 px-4 py-3 border-b"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/" className="text-xl" style={{ color: "#2D5016" }}>
            &#8592;
          </a>
          <h1 className="text-lg font-bold" style={{ color: "#2D5016" }}>
            주문 조회
          </h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Search form */}
        <div
          className="rounded-2xl p-4 mb-6"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: "#1A1A1A" }}>
            주문번호로 조회
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="주문번호 입력"
              className="flex-1 px-4 py-3 rounded-xl border text-base outline-none focus:ring-2"
              style={{ borderColor: "#E5E2DB" }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="px-5 py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#2D5016" }}
            >
              {loading ? "..." : "조회"}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl p-3 mb-4 text-sm"
            style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}
          >
            {error}
          </div>
        )}

        {/* Order info */}
        {order && statusInfo && (
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
          >
            {/* Status badge */}
            <div className="flex items-center justify-between mb-6">
              <span
                className="px-3 py-1.5 rounded-full text-sm font-bold"
                style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              <span className="text-xs" style={{ color: "#9B9B9B" }}>
                {new Date(order.created_at).toLocaleDateString("ko-KR")}
              </span>
            </div>

            {/* Progress steps */}
            {order.status !== "cancelled" && (
              <div className="flex items-center mb-6">
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= currentStepIndex;
                  const label = STATUS_LABELS[step]?.label || step;
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center relative">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1"
                        style={{
                          backgroundColor: done ? "#2D5016" : "#E5E2DB",
                          color: done ? "#FFFFFF" : "#9B9B9B",
                        }}
                      >
                        {done ? "\u2713" : i + 1}
                      </div>
                      <span
                        className="text-[10px]"
                        style={{ color: done ? "#2D5016" : "#9B9B9B" }}
                      >
                        {label}
                      </span>
                      {i < STATUS_STEPS.length - 1 && (
                        <div
                          className="absolute top-3 left-1/2 w-full h-0.5"
                          style={{
                            backgroundColor:
                              i < currentStepIndex ? "#2D5016" : "#E5E2DB",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Details */}
            <div className="space-y-3" style={{ borderTop: "1px solid #E5E2DB", paddingTop: "16px" }}>
              {order.product_name && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "#6B6B6B" }}>상품</span>
                  <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                    {order.product_name}
                  </span>
                </div>
              )}
              {order.total_amount != null && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "#6B6B6B" }}>결제 금액</span>
                  <span className="text-sm font-bold" style={{ color: "#D4421E" }}>
                    {order.total_amount.toLocaleString()}원
                  </span>
                </div>
              )}
              {order.carrier && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "#6B6B6B" }}>택배사</span>
                  <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                    {order.carrier}
                  </span>
                </div>
              )}
              {order.tracking_number && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: "#6B6B6B" }}>송장번호</span>
                  <span className="text-sm font-mono font-medium" style={{ color: "#1A1A1A" }}>
                    {order.tracking_number}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {searched && !order && !loading && !error && (
          <div className="text-center py-12">
            <p style={{ color: "#9B9B9B" }}>주문 정보를 찾을 수 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
