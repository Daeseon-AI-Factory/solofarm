"use client";

import { FarmProfile, ProductItem } from "@/types";

interface OrderSectionProps {
  farm: FarmProfile;
  products: ProductItem[];
}

export default function OrderSection({ farm, products }: OrderSectionProps) {
  const availableProducts = products.filter((p) => p.is_available);

  const handleKakao = () => {
    if (farm.kakao_chat_url) {
      fetch("/api/v1/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "kakao" }),
      }).catch(() => {});
      window.open(farm.kakao_chat_url, "_blank");
    }
  };

  const handlePhone = () => {
    if (farm.phone) {
      fetch("/api/v1/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone" }),
      }).catch(() => {});
      window.location.href = `tel:${farm.phone}`;
    }
  };

  const handleNaver = () => {
    if (farm.naver_store_url) {
      fetch("/api/v1/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "naver" }),
      }).catch(() => {});
      window.open(farm.naver_store_url, "_blank");
    }
  };

  return (
    <section
      id="order"
      className="py-16 md:py-24 px-4"
      style={{ backgroundColor: "#2D5016" }}
    >
      <div className="max-w-2xl mx-auto text-center text-white">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">주문 안내</h2>
        <div
          className="w-12 h-1 mx-auto rounded mb-8"
          style={{ backgroundColor: "#E8913A" }}
        />

        {/* Available products */}
        {availableProducts.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-8 text-left"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-4"
              style={{ color: "#E8913A" }}
            >
              현재 판매 중
            </p>
            <div className="space-y-3">
              {availableProducts.map((p) => {
                const priceOptions = p.price_options ?? [];
                return (
                  <div key={p.id} className="flex justify-between items-start">
                    <span className="font-medium">{p.name}</span>
                    <div className="text-right text-sm">
                      {priceOptions.map((opt, i) => (
                        <p key={i} className="text-white/80">
                          {opt.weight} — {opt.price.toLocaleString()}원
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {availableProducts.length === 0 && (
          <p className="text-white/70 mb-8">현재 판매 중인 상품이 없습니다. 문의 주시면 안내해드립니다.</p>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          {farm.kakao_chat_url && (
            <button
              onClick={handleKakao}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: "#FEE500", color: "#000000" }}
            >
              <span>💬</span>
              카카오톡 문의
            </button>
          )}
          {farm.phone && (
            <button
              onClick={handlePhone}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-transform hover:scale-105 active:scale-95 border-2 border-white text-white"
            >
              <span>📞</span>
              전화 주문
            </button>
          )}
        </div>

        {farm.naver_store_url && (
          <button
            onClick={handleNaver}
            className="text-sm underline text-white/70 hover:text-white mb-8 block mx-auto"
          >
            네이버 스마트스토어 바로가기 →
          </button>
        )}

        {/* Address */}
        {farm.address_short && (
          <div className="pt-6 border-t border-white/20">
            <p className="text-white/60 text-sm">농장 위치</p>
            <p className="text-white font-medium mt-1">{farm.address_short}</p>
            {farm.address && (
              <p className="text-white/60 text-xs mt-1">{farm.address}</p>
            )}
          </div>
        )}

        <p className="text-white/50 text-xs mt-6">
          카카오톡 및 전화 문의는 오전 9시 ~ 오후 6시에 답변드립니다
        </p>
      </div>
    </section>
  );
}
