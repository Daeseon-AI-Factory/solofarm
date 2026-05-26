"use client";

import { useState, useEffect } from "react";
import {
  listAdminOrders,
  confirmOrder,
  shipOrder,
  deliverOrder,
  cancelOrder,
  type SalesOrder,
} from "@/lib/farmerApi";

/**
 * Admin order management — farmer views, confirms, ships, delivers orders.
 * Status flow: inquiry → paid → confirmed → shipped → delivered
 * Also supports cancellation with refund.
 */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  inquiry: { label: "문의", color: "#9B9B9B", bg: "#F5F1EC" },
  paid: { label: "결제완료", color: "#2D5016", bg: "#EDF4E8" },
  confirmed: { label: "확인", color: "#2D5016", bg: "#EDF4E8" },
  shipped: { label: "배송중", color: "#E8913A", bg: "#FEF3E2" },
  delivered: { label: "배송완료", color: "#4A7C2E", bg: "#EDF4E8" },
  cancelled: { label: "취소", color: "#DC2626", bg: "#FEE2E2" },
};

const STATUS_TABS = [
  { value: "", label: "전체" },
  { value: "paid", label: "결제완료" },
  { value: "confirmed", label: "확인" },
  { value: "shipped", label: "배송중" },
  { value: "delivered", label: "완료" },
  { value: "cancelled", label: "취소" },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [shipModal, setShipModal] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    loadOrders();
  }, [filter]);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await listAdminOrders(filter ? { status: filter } : undefined);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 목록을 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(orderId: string, action: string) {
    setActionLoading(orderId);
    try {
      switch (action) {
        case "confirm":
          await confirmOrder(orderId);
          break;
        case "deliver":
          await deliverOrder(orderId);
          break;
        case "cancel":
          if (confirm("정말 취소하시겠습니까?")) {
            await cancelOrder(orderId);
          } else {
            setActionLoading("");
            return;
          }
          break;
      }
      await loadOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "처리 실패");
    } finally {
      setActionLoading("");
    }
  }

  async function handleShip() {
    if (!shipModal || !carrier.trim() || !trackingNumber.trim()) return;
    setActionLoading(shipModal);
    try {
      await shipOrder(shipModal, carrier, trackingNumber);
      setShipModal(null);
      setCarrier("");
      setTrackingNumber("");
      await loadOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "발송 처리 실패");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#2D5016" }}>
        주문 관리
      </h1>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: filter === tab.value ? "#2D5016" : "#F5F1EC",
              color: filter === tab.value ? "#FFFFFF" : "#6B6B6B",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl p-3 mb-4 text-sm" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#9B9B9B" }}>불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="text-center py-12" style={{ color: "#9B9B9B" }}>
          주문이 없습니다
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.inquiry;
            const isLoading = actionLoading === order.id;
            return (
              <div
                key={order.id}
                className="rounded-2xl p-4"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold" style={{ color: "#1A1A1A" }}>
                      {order.product_name || "상품 미정"}
                      {order.weight_option && ` (${order.weight_option})`}
                      {order.quantity > 1 && ` x${order.quantity}`}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#9B9B9B" }}>
                      {new Date(order.created_at).toLocaleDateString("ko-KR")} · {order.channel}
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ backgroundColor: status.bg, color: status.color }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Customer info */}
                <div className="text-sm mb-3" style={{ color: "#6B6B6B" }}>
                  {order.customer_name && <span>{order.customer_name}</span>}
                  {order.customer_phone && <span> · {order.customer_phone}</span>}
                </div>

                {/* Amount */}
                {order.total_amount != null && (
                  <p className="font-bold mb-3" style={{ color: "#D4421E" }}>
                    {Number(order.total_amount).toLocaleString()}원
                  </p>
                )}

                {/* Tracking */}
                {order.tracking_number && (
                  <p className="text-xs mb-3" style={{ color: "#6B6B6B" }}>
                    송장: {order.tracking_number}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {order.status === "paid" && (
                    <button
                      onClick={() => handleAction(order.id, "confirm")}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: "#2D5016" }}
                    >
                      주문 확인
                    </button>
                  )}
                  {(order.status === "paid" || order.status === "confirmed") && (
                    <button
                      onClick={() => setShipModal(order.id)}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                      style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                    >
                      발송 처리
                    </button>
                  )}
                  {order.status === "shipped" && (
                    <button
                      onClick={() => handleAction(order.id, "deliver")}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: "#4A7C2E" }}
                    >
                      배송 완료
                    </button>
                  )}
                  {!["delivered", "cancelled"].includes(order.status) && (
                    <button
                      onClick={() => handleAction(order.id, "cancel")}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                      style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}
                    >
                      취소
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ship modal */}
      {shipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: "#1A1A1A" }}>
              발송 정보 입력
            </h2>
            <div className="space-y-3">
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-base outline-none"
                style={{ borderColor: "#E5E2DB" }}
              >
                <option value="">택배사 선택</option>
                <option value="우체국">우체국</option>
                <option value="CJ대한통운">CJ대한통운</option>
                <option value="한진택배">한진택배</option>
                <option value="로젠택배">로젠택배</option>
                <option value="롯데택배">롯데택배</option>
              </select>
              <input
                type="text"
                placeholder="송장번호"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-base outline-none"
                style={{ borderColor: "#E5E2DB" }}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleShip}
                disabled={!carrier || !trackingNumber || !!actionLoading}
                className="flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: "#2D5016" }}
              >
                발송 완료
              </button>
              <button
                onClick={() => { setShipModal(null); setCarrier(""); setTrackingNumber(""); }}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
