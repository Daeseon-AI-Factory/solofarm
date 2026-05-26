"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { publicCheckout, publicConfirmPayment } from "@/lib/farmerApi";

/**
 * Guest checkout page — no auth required.
 *
 * Flow: brand page "바로 주문" → this page with product params →
 *       shipping form → Toss payment widget → confirmation
 *
 * TossPayments SDK loads via script tag and opens the payment widget
 * after checkout API returns toss_order_id.
 */

type Step = "form" | "processing" | "success" | "error";

interface CheckoutForm {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
  deliveryMessage: string;
  quantity: number;
}

const DELIVERY_OPTIONS = [
  "부재시 문 앞에 놓아주세요",
  "배송 전 연락 부탁드립니다",
  "경비실에 맡겨주세요",
  "직접 입력",
];

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFBF7" }}><p style={{ color: "#9B9B9B" }}>로딩 중...</p></div>}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productName = searchParams.get("product") || "";
  const productId = searchParams.get("productId") || "";
  const weightOption = searchParams.get("weight") || "";
  const unitPrice = parseInt(searchParams.get("price") || "0", 10);

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [form, setForm] = useState<CheckoutForm>({
    recipientName: "",
    recipientPhone: "",
    postalCode: "",
    address: "",
    addressDetail: "",
    deliveryMessage: "",
    quantity: 1,
  });
  const [customMessage, setCustomMessage] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  const totalAmount = unitPrice * form.quantity;

  // Load TossPayments SDK
  useEffect(() => {
    if (document.getElementById("toss-sdk")) return;
    const script = document.createElement("script");
    script.id = "toss-sdk";
    script.src = "https://js.tosspayments.com/v1/payment";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.recipientName.trim()) {
      setError("받는 분 이름을 입력해주세요");
      return;
    }
    if (!form.recipientPhone.trim()) {
      setError("연락처를 입력해주세요");
      return;
    }
    if (!form.address.trim()) {
      setError("주소를 입력해주세요");
      return;
    }

    setStep("processing");

    try {
      // Step 1: Create checkout on server
      const checkout = await publicCheckout({
        product_name: productName,
        product_id: productId || undefined,
        quantity: form.quantity,
        weight_option: weightOption || undefined,
        unit_price: unitPrice,
        total_amount: totalAmount,
        recipient_name: form.recipientName,
        recipient_phone: form.recipientPhone,
        postal_code: form.postalCode || undefined,
        address: form.address,
        address_detail: form.addressDetail || undefined,
        delivery_message:
          selectedPreset === "직접 입력"
            ? customMessage
            : selectedPreset || undefined,
      });

      setOrderId(checkout.order_id);

      // Step 2: Open Toss payment widget
      const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!tossClientKey) {
        // No Toss key — simulate success for dev/testing
        const confirmed = await publicConfirmPayment({
          payment_key: `dev_${Date.now()}`,
          order_id: checkout.toss_order_id,
          amount: checkout.amount,
        });
        setOrderId(confirmed.order_id);
        setStep("success");
        return;
      }

      // Real Toss payment
      const tossPayments = (window as unknown as Record<string, unknown>)
        .TossPayments as (key: string) => {
        requestPayment: (
          method: string,
          params: Record<string, unknown>
        ) => Promise<{
          paymentKey: string;
          orderId: string;
          amount: number;
        }>;
      };

      const payments = tossPayments(tossClientKey);
      const result = await payments.requestPayment("카드", {
        amount: checkout.amount,
        orderId: checkout.toss_order_id,
        orderName: checkout.product_name,
        customerName: form.recipientName,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
      });

      // Step 3: Confirm payment on server
      const confirmed = await publicConfirmPayment({
        payment_key: result.paymentKey,
        order_id: result.orderId,
        amount: result.amount,
      });
      setOrderId(confirmed.order_id);
      setStep("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "결제 처리 중 오류가 발생했습니다";
      setError(msg);
      setStep("error");
    }
  };

  if (!productName || !unitPrice) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "#FDFBF7" }}
      >
        <div className="text-center">
          <p className="text-lg font-bold mb-2" style={{ color: "#1A1A1A" }}>
            상품 정보가 없습니다
          </p>
          <p className="text-sm mb-4" style={{ color: "#6B6B6B" }}>
            브랜드 페이지에서 상품을 선택해주세요
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 rounded-xl font-bold text-white"
            style={{ backgroundColor: "#2D5016" }}
          >
            브랜드 페이지로 이동
          </a>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "#FDFBF7" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#10004;&#65039;</div>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: "#2D5016" }}
          >
            주문이 완료되었습니다
          </h1>
          <p className="text-sm mb-6" style={{ color: "#6B6B6B" }}>
            빈조농장에서 정성껏 준비하겠습니다
          </p>
          <div
            className="rounded-2xl p-6 mb-6 text-left"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
          >
            <p className="text-xs mb-1" style={{ color: "#9B9B9B" }}>
              주문번호
            </p>
            <p
              className="font-mono text-sm font-bold mb-4"
              style={{ color: "#1A1A1A" }}
            >
              {orderId}
            </p>
            <p className="text-xs mb-1" style={{ color: "#9B9B9B" }}>
              상품
            </p>
            <p className="text-sm font-medium mb-2" style={{ color: "#1A1A1A" }}>
              {productName} {weightOption && `(${weightOption})`} x{" "}
              {form.quantity}
            </p>
            <p className="text-xs mb-1" style={{ color: "#9B9B9B" }}>
              결제 금액
            </p>
            <p
              className="text-lg font-bold"
              style={{ color: "#D4421E" }}
            >
              {totalAmount.toLocaleString()}원
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`/order-status?id=${orderId}`}
              className="flex-1 py-3 rounded-xl font-bold text-white text-center"
              style={{ backgroundColor: "#2D5016" }}
            >
              주문 조회
            </a>
            <a
              href="/"
              className="flex-1 py-3 rounded-xl font-bold text-center"
              style={{
                backgroundColor: "#F5F1EC",
                color: "#2D5016",
              }}
            >
              홈으로
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FDFBF7" }}
      >
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">&#9697;</div>
          <p style={{ color: "#6B6B6B" }}>결제를 처리하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFBF7" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 px-4 py-3 border-b"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a
            href="/"
            className="text-xl"
            style={{ color: "#2D5016" }}
          >
            &#8592;
          </a>
          <h1 className="text-lg font-bold" style={{ color: "#2D5016" }}>
            주문하기
          </h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Product summary */}
        <div
          className="rounded-2xl p-4 mb-6"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: "#9B9B9B" }}>
            주문 상품
          </p>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold" style={{ color: "#1A1A1A" }}>
                {productName}
              </p>
              {weightOption && (
                <p className="text-sm" style={{ color: "#6B6B6B" }}>
                  {weightOption}
                </p>
              )}
            </div>
            <p className="font-bold" style={{ color: "#D4421E" }}>
              {unitPrice.toLocaleString()}원
            </p>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: "1px solid #E5E2DB" }}>
            <p className="text-sm" style={{ color: "#6B6B6B" }}>수량</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))
                }
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
              >
                -
              </button>
              <span className="w-8 text-center font-bold" style={{ color: "#1A1A1A" }}>
                {form.quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, quantity: f.quantity + 1 }))
                }
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
              >
                +
              </button>
            </div>
            <p className="ml-auto font-bold" style={{ color: "#1A1A1A" }}>
              {totalAmount.toLocaleString()}원
            </p>
          </div>
        </div>

        {/* Shipping form */}
        <form onSubmit={handleSubmit}>
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
          >
            <p
              className="text-xs font-semibold mb-4"
              style={{ color: "#9B9B9B" }}
            >
              배송 정보
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="받는 분 이름"
                value={form.recipientName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recipientName: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-xl border text-base outline-none focus:ring-2"
                style={{ borderColor: "#E5E2DB" }}
              />
              <input
                type="tel"
                placeholder="연락처 (010-0000-0000)"
                value={form.recipientPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recipientPhone: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-xl border text-base outline-none focus:ring-2"
                style={{ borderColor: "#E5E2DB" }}
              />
              <input
                type="text"
                placeholder="우편번호"
                value={form.postalCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postalCode: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-xl border text-base outline-none focus:ring-2"
                style={{ borderColor: "#E5E2DB" }}
              />
              <input
                type="text"
                placeholder="주소"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-xl border text-base outline-none focus:ring-2"
                style={{ borderColor: "#E5E2DB" }}
              />
              <input
                type="text"
                placeholder="상세주소 (동/호수)"
                value={form.addressDetail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, addressDetail: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-xl border text-base outline-none focus:ring-2"
                style={{ borderColor: "#E5E2DB" }}
              />

              {/* Delivery message presets */}
              <div>
                <p className="text-sm mb-2" style={{ color: "#6B6B6B" }}>
                  배송 메시지
                </p>
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedPreset(opt)}
                      className="px-3 py-1.5 rounded-lg text-xs border transition-colors"
                      style={{
                        borderColor:
                          selectedPreset === opt ? "#2D5016" : "#E5E2DB",
                        backgroundColor:
                          selectedPreset === opt ? "#EDF4E8" : "#FFFFFF",
                        color:
                          selectedPreset === opt ? "#2D5016" : "#6B6B6B",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {selectedPreset === "직접 입력" && (
                  <input
                    type="text"
                    placeholder="배송 메시지를 입력해주세요"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-base outline-none focus:ring-2 mt-2"
                    style={{ borderColor: "#E5E2DB" }}
                  />
                )}
              </div>
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

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl font-bold text-white text-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#D4421E" }}
          >
            {totalAmount.toLocaleString()}원 결제하기
          </button>

          <p
            className="text-center text-xs mt-3"
            style={{ color: "#9B9B9B" }}
          >
            결제는 토스페이먼츠를 통해 안전하게 처리됩니다
          </p>
        </form>
      </div>
    </div>
  );
}
