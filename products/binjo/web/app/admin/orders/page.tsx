"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AdminPage from "@/components/admin/AdminPage";
import AdminNotice from "@/components/admin/AdminNotice";
import {
  cancelOrder,
  confirmOrder,
  createManualOrder,
  deliverOrder,
  listAdminOrders,
  shipOrder,
  type ManualOrderChannel,
  type SalesOrder,
} from "@/lib/adminOrdersApi";
import {
  ADMIN_ORDER_QUEUES,
  ORDER_STATUS_PRESENTATION,
  countOrdersByQueue,
  orderMatchesQueue,
  orderMatchesSearch,
  type AdminOrderQueue,
} from "@/lib/adminOrderPresentation";

const CHANNEL_LABELS: Record<string, string> = {
  kakao: "카카오톡",
  phone: "전화",
  offline: "현장/오프라인",
  direct: "온라인 결제",
  naver: "네이버",
  wholesale: "도매",
};

const MANUAL_CHANNELS = new Set(["kakao", "phone", "offline"]);

interface ProductChoice {
  id: string;
  name: string;
}

type ManualOrderForm = {
  channel: ManualOrderChannel;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  quantity: string;
  weightOption: string;
  unitPrice: string;
  totalAmount: string;
  notes: string;
};

const EMPTY_MANUAL_ORDER: ManualOrderForm = {
  channel: "phone",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  productName: "",
  quantity: "1",
  weightOption: "",
  unitPrice: "",
  totalAmount: "",
  notes: "",
};

const INPUT_CLASS =
  "min-h-12 w-full rounded-xl border px-3 py-2.5 text-base outline-none transition focus:ring-2 focus:ring-[#2D5016]/20";
const INPUT_STYLE = { borderColor: "#D9D5CC", backgroundColor: "#FFFFFF" };

function formatMoney(value: number | string | null): string {
  return value == null ? "-" : `${Number(value).toLocaleString("ko-KR")}원`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<AdminOrderQueue>("action");
  const [channelFilter, setChannelFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] =
    useState<ManualOrderForm>(EMPTY_MANUAL_ORDER);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [shipModal, setShipModal] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const carrierRef = useRef<HTMLSelectElement>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminOrders();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문 목록을 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setShowManualForm(true);
    }
    fetch("/api/v1/products", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: ProductChoice[]) => setProductChoices(items))
      .catch(() => setProductChoices([]));
  }, []);

  useEffect(() => {
    if (!shipModal) return;
    carrierRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || actionLoading) return;
      setShipModal(null);
      setCarrier("");
      setTrackingNumber("");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionLoading, shipModal]);

  const queueCounts = useMemo(() => countOrdersByQueue(orders), [orders]);
  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          orderMatchesQueue(order.status, filter) &&
          (!channelFilter || order.channel === channelFilter) &&
          orderMatchesSearch(order, searchQuery)
      ),
    [channelFilter, filter, orders, searchQuery]
  );
  const shippingOrder = useMemo(
    () => orders.find((order) => order.id === shipModal) ?? null,
    [orders, shipModal]
  );

  function updateManualField<K extends keyof ManualOrderForm>(
    field: K,
    value: ManualOrderForm[K]
  ) {
    setManualForm((current) => ({ ...current, [field]: value }));
  }

  function updateManualPrice(
    field: "quantity" | "unitPrice",
    value: string
  ) {
    setManualForm((current) => {
      const next = { ...current, [field]: value };
      const quantity = Number(next.quantity);
      const unitPrice = Number(next.unitPrice);
      const calculatedTotal =
        Number.isInteger(quantity) &&
        quantity > 0 &&
        Number.isInteger(unitPrice) &&
        unitPrice > 0
          ? quantity * unitPrice
          : 0;
      return {
        ...next,
        totalAmount: calculatedTotal > 0 ? String(calculatedTotal) : "",
      };
    });
  }

  function closeManualForm() {
    setShowManualForm(false);
    setManualForm({ ...EMPTY_MANUAL_ORDER });
    setFormError("");
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    const quantity = Number(manualForm.quantity);
    const unitPrice = Number(manualForm.unitPrice);
    const totalAmount = Number(manualForm.totalAmount);
    const requiredText = [
      manualForm.customerName,
      manualForm.customerPhone,
      manualForm.customerAddress,
      manualForm.productName,
      manualForm.weightOption,
    ];
    if (requiredText.some((value) => !value.trim())) {
      setFormError("고객과 상품의 필수 정보를 모두 입력해주세요");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      setFormError("수량은 1개 이상 1,000개 이하로 입력해주세요");
      return;
    }
    if (
      !Number.isSafeInteger(unitPrice) ||
      unitPrice <= 0 ||
      unitPrice > 9_999_999_999
    ) {
      setFormError("단가는 1원 이상의 정수로 입력해주세요");
      return;
    }
    if (
      !Number.isSafeInteger(totalAmount) ||
      totalAmount <= 0 ||
      totalAmount > 999_999_999_999
    ) {
      setFormError("총 금액은 1원 이상의 정수로 입력해주세요");
      return;
    }

    setCreating(true);
    try {
      await createManualOrder({
        channel: manualForm.channel,
        customer_name: manualForm.customerName.trim(),
        customer_phone: manualForm.customerPhone.trim(),
        customer_address: manualForm.customerAddress.trim(),
        product_name: manualForm.productName.trim(),
        quantity,
        weight_option: manualForm.weightOption.trim(),
        unit_price: unitPrice,
        total_amount: totalAmount,
        notes: manualForm.notes.trim() || undefined,
      });
      closeManualForm();
      setNotice("주문을 접수했습니다. 처리 필요 목록에서 바로 발송할 수 있습니다.");
      setFilter("action");
      await loadOrders();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "주문을 접수하지 못했습니다");
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(order: SalesOrder, action: "confirm" | "deliver" | "cancel") {
    if (action === "cancel") {
      const message = MANUAL_CHANNELS.has(order.channel)
        ? "주문을 취소하시겠습니까? 앱 밖에서 받은 금액은 자동 환불되지 않습니다."
        : "주문을 취소하고 결제 환불을 요청하시겠습니까?";
      if (!confirm(message)) return;
    }

    setActionLoading(order.id);
    setError("");
    setNotice("");
    try {
      if (action === "confirm") await confirmOrder(order.id);
      if (action === "deliver") await deliverOrder(order.id);
      if (action === "cancel") await cancelOrder(order.id);
      setNotice(
        action === "confirm"
          ? "주문을 확인했습니다. 발송 준비를 진행하세요."
          : action === "deliver"
            ? "배송 완료로 처리하고 매출에 반영했습니다."
            : "주문을 취소했습니다. 외부에서 받은 금액은 별도로 확인하세요."
      );
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "주문을 처리하지 못했습니다");
    } finally {
      setActionLoading("");
    }
  }

  async function handleShip() {
    if (!shipModal || !carrier.trim() || !trackingNumber.trim()) return;
    setActionLoading(shipModal);
    setError("");
    setNotice("");
    try {
      await shipOrder(shipModal, carrier.trim(), trackingNumber.trim());
      setShipModal(null);
      setCarrier("");
      setTrackingNumber("");
      setNotice("발송 처리했습니다. 배송 중 목록에서 확인할 수 있습니다.");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "발송 처리에 실패했습니다");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <AdminPage
      title="주문"
      description="처리할 주문을 먼저 확인하고 전화·카카오·현장 주문을 기록합니다."
      eyebrow="ORDER WORK QUEUE"
      maxWidth="wide"
      actions={
        <button
          type="button"
          onClick={() => {
            setShowManualForm((current) => !current);
            setFormError("");
            setNotice("");
          }}
          className="min-h-12 w-full rounded-xl px-5 text-sm font-bold text-white sm:w-auto"
          style={{ backgroundColor: "#2D5016" }}
        >
          {showManualForm ? "입력 닫기" : "+ 주문 받기"}
        </button>
      }
    >

      {showManualForm && (
        <form
          onSubmit={handleManualSubmit}
          className="mb-6 rounded-2xl border p-4 shadow-sm md:p-6"
          style={{ backgroundColor: "#FFFDF9", borderColor: "#D9D5CC" }}
        >
          <div className="mb-5">
            <h2 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
              수동 주문 접수
            </h2>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
              전화·카카오·현장에서 결제 또는 입금을 확인한 배송 주문만 등록하세요. 접수하면 바로 발송 대기가 됩니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              주문 경로 *
              <select
                value={manualForm.channel}
                onChange={(event) =>
                  updateManualField(
                    "channel",
                    event.target.value as ManualOrderChannel
                  )
                }
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              >
                <option value="phone">전화</option>
                <option value="kakao">카카오톡</option>
                <option value="offline">현장/오프라인</option>
              </select>
            </label>

            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              고객 이름 *
              <input
                required
                maxLength={100}
                autoComplete="name"
                value={manualForm.customerName}
                onChange={(event) => updateManualField("customerName", event.target.value)}
                placeholder="홍길동"
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
            </label>

            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              전화번호 *
              <input
                required
                minLength={7}
                maxLength={20}
                type="tel"
                autoComplete="tel"
                value={manualForm.customerPhone}
                onChange={(event) => updateManualField("customerPhone", event.target.value)}
                placeholder="010-1234-5678"
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
            </label>

            <label className="text-sm font-medium md:col-span-2" style={{ color: "#3F3F3F" }}>
              배송 주소 *
              <input
                required
                minLength={2}
                maxLength={1000}
                autoComplete="street-address"
                value={manualForm.customerAddress}
                onChange={(event) => updateManualField("customerAddress", event.target.value)}
                placeholder="경남 사천시 ... 동·호수까지 입력"
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
            </label>

            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              상품명 *
              <input
                required
                maxLength={100}
                list="admin-product-choices"
                value={manualForm.productName}
                onChange={(event) => updateManualField("productName", event.target.value)}
                placeholder="등록 상품을 선택하거나 직접 입력"
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
              <datalist id="admin-product-choices">
                {productChoices.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
            </label>

            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              중량·옵션 *
              <input
                required
                maxLength={50}
                value={manualForm.weightOption}
                onChange={(event) => updateManualField("weightOption", event.target.value)}
                placeholder="5kg (16~18과)"
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
            </label>

            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              수량 *
              <input
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                step={1}
                value={manualForm.quantity}
                onChange={(event) => updateManualPrice("quantity", event.target.value)}
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
            </label>

            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              개당 단가 *
              <input
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={9_999_999_999}
                step={1}
                value={manualForm.unitPrice}
                onChange={(event) => updateManualPrice("unitPrice", event.target.value)}
                placeholder="35000"
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
            </label>

            <label className="text-sm font-medium" style={{ color: "#3F3F3F" }}>
              총 금액 *
              <input
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={999_999_999_999}
                step={1}
                value={manualForm.totalAmount}
                onChange={(event) => updateManualField("totalAmount", event.target.value)}
                placeholder="수량 × 단가로 자동 계산"
                className={`${INPUT_CLASS} mt-1`}
                style={INPUT_STYLE}
              />
              <span className="mt-1 block text-xs font-normal" style={{ color: "#77736C" }}>
                자동 계산 후 할인·배송비가 있으면 직접 수정할 수 있습니다
              </span>
            </label>

            <label className="text-sm font-medium md:col-span-2" style={{ color: "#3F3F3F" }}>
              주문 메모
              <textarea
                rows={3}
                maxLength={2000}
                value={manualForm.notes}
                onChange={(event) => updateManualField("notes", event.target.value)}
                placeholder="배송 요청, 입금 여부, 고객 요청사항 등"
                className={`${INPUT_CLASS} mt-1 resize-y`}
                style={INPUT_STYLE}
              />
            </label>
          </div>

          {formError && (
            <p
              role="alert"
              className="mt-4 rounded-xl p-3 text-sm"
              style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}
            >
              {formError}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={creating}
              className="min-h-12 flex-1 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
              style={{ backgroundColor: "#2D5016" }}
            >
              {creating ? "접수 중..." : "주문 접수"}
            </button>
            <button
              type="button"
              onClick={closeManualForm}
              disabled={creating}
              className="min-h-12 flex-1 rounded-xl px-5 text-sm font-bold disabled:opacity-50 sm:flex-none"
              style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
            >
              취소
            </button>
          </div>
        </form>
      )}

      {notice && <AdminNotice tone="success" className="mb-4">{notice}</AdminNotice>}

      {error && (
        <AdminNotice
          tone="error"
          title="주문을 처리하지 못했습니다"
          className="mb-4"
          action={
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold"
              style={{ borderColor: "#C9806E" }}
            >
              다시 불러오기
            </button>
          }
        >
          {error}
        </AdminNotice>
      )}

      <section className="mb-5 rounded-2xl border bg-white p-3 sm:p-4" style={{ borderColor: "#DEE3DA" }}>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <label className="sr-only" htmlFor="admin-order-search">주문 검색</label>
          <input
            id="admin-order-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="고객 이름·전화번호·상품·송장번호 검색"
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
          <label className="sr-only" htmlFor="admin-order-channel">주문 경로</label>
          <select
            id="admin-order-channel"
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          >
            <option value="">모든 주문 경로</option>
            {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="주문 상태 필터">
          {ADMIN_ORDER_QUEUES.map((tab) => (
            <button
              type="button"
              key={tab.value}
              onClick={() => {
                setFilter(tab.value);
                setNotice("");
              }}
              aria-pressed={filter === tab.value}
              className="min-h-12 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors"
              style={{
                backgroundColor: filter === tab.value ? "#2D5016" : "#EFF3EC",
                color: filter === tab.value ? "#FFFFFF" : "#4E5F48",
              }}
            >
              {tab.label} {queueCounts[tab.value]}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <p style={{ color: "#9B9B9B" }}>불러오는 중...</p>
      ) : visibleOrders.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed py-12 text-center"
          style={{ borderColor: "#D9D5CC", color: "#9B9B9B" }}
        >
          <p>{orders.length === 0 ? "아직 등록된 주문이 없습니다" : "조건에 맞는 주문이 없습니다"}</p>
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className="mt-3 min-h-12 rounded-xl px-4 text-sm font-bold underline"
            style={{ color: "#2D5016" }}
          >
            주문 받기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const orderStatus = ORDER_STATUS_PRESENTATION[order.status] || ORDER_STATUS_PRESENTATION.inquiry;
            const isLoading = actionLoading === order.id;
            return (
              <article
                key={order.id}
                className="rounded-2xl border p-4 shadow-sm md:p-5"
                style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-bold" style={{ color: "#1A1A1A" }}>
                      {order.product_name || "상품 미정"}
                      {order.weight_option && ` · ${order.weight_option}`}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#77736C" }}>
                      {new Date(order.created_at).toLocaleString("ko-KR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {` · ${CHANNEL_LABELS[order.channel] || order.channel}`}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{ backgroundColor: orderStatus.backgroundColor, color: orderStatus.color }}
                  >
                    {orderStatus.label}
                  </span>
                </div>

                <dl className="grid gap-3 rounded-xl p-3 text-sm md:grid-cols-2" style={{ backgroundColor: "#FAF8F4" }}>
                  <div>
                    <dt className="text-xs" style={{ color: "#77736C" }}>고객</dt>
                    <dd className="mt-0.5 break-words font-medium" style={{ color: "#2B2B2B" }}>
                      {order.customer_name || "이름 없음"}
                      {order.customer_phone && (
                        <>
                          {" · "}
                          <a className="underline" href={`tel:${order.customer_phone}`}>
                            {order.customer_phone}
                          </a>
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs" style={{ color: "#77736C" }}>금액</dt>
                    <dd className="mt-0.5 font-bold" style={{ color: "#C23A1A" }}>
                      {formatMoney(order.total_amount)}
                      <span className="ml-2 text-xs font-normal" style={{ color: "#77736C" }}>
                        {formatMoney(order.unit_price)} × {order.quantity}개
                      </span>
                    </dd>
                  </div>
                  {order.customer_address && (
                    <div className="md:col-span-2">
                      <dt className="text-xs" style={{ color: "#77736C" }}>배송 주소</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words" style={{ color: "#2B2B2B" }}>
                        {order.customer_address}
                      </dd>
                    </div>
                  )}
                  {order.notes && (
                    <div className="md:col-span-2">
                      <dt className="text-xs" style={{ color: "#77736C" }}>주문 메모</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words" style={{ color: "#2B2B2B" }}>
                        {order.notes}
                      </dd>
                    </div>
                  )}
                  {order.tracking_number && (
                    <div className="md:col-span-2">
                      <dt className="text-xs" style={{ color: "#77736C" }}>송장번호</dt>
                      <dd className="mt-0.5 font-medium" style={{ color: "#2B2B2B" }}>
                        {order.tracking_number}
                      </dd>
                    </div>
                  )}
                </dl>

                {order.status === "inquiry" && (
                  <p className="mt-4 rounded-xl p-3 text-sm" style={{ backgroundColor: "#FFF7E8", color: "#7A4B12" }}>
                    이 기록은 주문 정보가 완성되지 않았습니다. 고객과 확인한 뒤 새 주문으로 접수하세요.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status === "paid" && (
                    <button
                      type="button"
                      onClick={() => void handleAction(order, "confirm")}
                      disabled={isLoading}
                      className="min-h-12 flex-1 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
                      style={{ backgroundColor: "#2D5016" }}
                    >
                      주문 확인
                    </button>
                  )}
                  {order.status === "confirmed" && (
                    <button
                      type="button"
                      onClick={() => setShipModal(order.id)}
                      disabled={isLoading}
                      className="min-h-12 flex-1 rounded-xl px-4 text-sm font-bold disabled:opacity-50 sm:flex-none"
                      style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
                    >
                      발송 처리
                    </button>
                  )}
                  {order.status === "shipped" && (
                    <button
                      type="button"
                      onClick={() => void handleAction(order, "deliver")}
                      disabled={isLoading}
                      className="min-h-12 flex-1 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
                      style={{ backgroundColor: "#4A7C2E" }}
                    >
                      배송 완료
                    </button>
                  )}
                  {!['delivered', 'cancelled'].includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => void handleAction(order, "cancel")}
                      disabled={isLoading}
                      className="min-h-12 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                      style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}
                    >
                      취소
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {shipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ship-dialog-title"
            aria-describedby="ship-dialog-description"
            className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <h2 id="ship-dialog-title" className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
              발송 정보 입력
            </h2>
            <p id="ship-dialog-description" className="mt-1 text-sm" style={{ color: "#66705F" }}>
              {shippingOrder?.customer_name || "고객"} · {shippingOrder?.product_name || "상품 미정"}
            </p>
            {shippingOrder?.customer_address && (
              <p className="mt-3 rounded-xl p-3 text-sm leading-relaxed" style={{ backgroundColor: "#F7F5F0", color: "#34422F" }}>
                {shippingOrder.customer_address}
              </p>
            )}
            <div className="mt-4 space-y-3">
              <select
                ref={carrierRef}
                aria-label="택배사"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              >
                <option value="">택배사 선택</option>
                <option value="우체국">우체국</option>
                <option value="CJ대한통운">CJ대한통운</option>
                <option value="한진택배">한진택배</option>
                <option value="로젠택배">로젠택배</option>
                <option value="롯데택배">롯데택배</option>
              </select>
              <input
                aria-label="송장번호"
                type="text"
                maxLength={100}
                placeholder="송장번호"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => void handleShip()}
                disabled={!carrier || !trackingNumber.trim() || !!actionLoading}
                className="min-h-13 flex-1 rounded-xl px-3 font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: "#2D5016" }}
              >
                발송 완료
              </button>
              <button
                type="button"
                onClick={() => {
                  setShipModal(null);
                  setCarrier("");
                  setTrackingNumber("");
                }}
                disabled={!!actionLoading}
                className="min-h-13 flex-1 rounded-xl px-3 font-bold disabled:opacity-50"
                style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B" }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
