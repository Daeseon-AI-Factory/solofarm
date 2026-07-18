"use client";

import type { PublicSalesMode } from "@/lib/publicFarmProfile";
import type { FarmProfile, ProductItem } from "@/types";

interface OrderSectionProps {
  farm: FarmProfile;
  products: ProductItem[];
  directCheckoutEnabled: boolean;
  salesMode: PublicSalesMode;
}

export default function OrderSection({
  farm,
  products,
  directCheckoutEnabled,
  salesMode,
}: OrderSectionProps) {
  const availableProducts = products.filter((product) => product.is_available);
  const hasInquiryChannel = Boolean(
    farm.kakao_chat_url || farm.phone || farm.naver_store_url
  );
  const showAvailableProducts = salesMode !== "preparing" && availableProducts.length > 0;

  const trackInquiry = (channel: "kakao" | "phone" | "naver") => {
    fetch("/api/v1/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    }).catch(() => {});
  };

  const title =
    salesMode === "direct"
      ? "판매 중인 사과를 만나보세요"
      : hasInquiryChannel
        ? "판매 일정과 재고를 문의하세요"
        : "정확한 판매 정보를 준비하고 있습니다";

  return (
    <section id="order" className="scroll-mt-4 bg-[#17370F] px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center text-white">
        <p className="text-xs font-bold tracking-[0.18em] text-[#F2B36D]">
          ORDER & CONTACT
        </p>
        <h2 className="mt-3 break-keep text-3xl font-bold tracking-[-0.04em] md:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl break-keep text-sm leading-6 text-white/70 md:text-base">
          {hasInquiryChannel
            ? directCheckoutEnabled && salesMode === "direct"
              ? "원하는 상품과 용량을 선택하면 온라인 주문으로 이어집니다."
              : "농장 일을 마친 뒤 순서대로 답변드립니다. 재고와 출고일을 먼저 확인해 주세요."
            : "실제 판매 상품과 주문 연락처가 확인되기 전에는 주문을 접수하지 않습니다."}
        </p>

        {showAvailableProducts && (
          <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-5 text-left md:p-6">
            <p className="mb-4 text-xs font-bold tracking-wide text-[#F2B36D]">
              {directCheckoutEnabled ? "현재 주문 가능" : "현재 재고 문의 가능"}
            </p>
            <div className="space-y-4">
              {availableProducts.map((product) => (
                <div key={product.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                  <span className="font-bold">{product.name}</span>
                  {(product.price_options ?? []).length > 0 && (
                    <div className="text-right text-sm text-white/75">
                      {(product.price_options ?? []).map((option) => (
                        <p key={`${option.weight}-${option.price}`}>
                          {option.weight} · {option.price.toLocaleString()}원
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {salesMode === "direct" ? (
          <div className="mt-8 space-y-3">
            <a
              href="#products"
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-6 py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
              style={{ backgroundColor: "#B63A20" }}
            >
              상품 선택하고 주문하기
              <span aria-hidden="true" className="ml-2">↑</span>
            </a>
            {hasInquiryChannel && (
              <p className="text-sm leading-6 text-white/65">
                재고나 출고일이 궁금하면 아래 연락 채널로 먼저 확인할 수 있습니다.
              </p>
            )}
          </div>
        ) : hasInquiryChannel ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {farm.kakao_chat_url && (
              <a
                href={farm.kakao_chat_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackInquiry("kakao")}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl px-6 py-4 text-base font-bold text-black transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "#FEE500" }}
              >
                카카오톡 문의
              </a>
            )}
            {farm.phone && (
              <a
                href={`tel:${farm.phone}`}
                onClick={() => trackInquiry("phone")}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl border-2 border-white px-6 py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
              >
                전화 문의
              </a>
            )}
          </div>
        ) : (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[#F2B36D]/30 bg-[#F2B36D]/10 p-5 text-left">
            <p className="font-bold text-[#F7CF98]">판매 준비 중</p>
            <p className="mt-2 break-keep text-sm leading-6 text-white/70">
              연락처와 출고 일정을 확인하는 중입니다. 확인되지 않은 전화번호나 주문 링크는 표시하지 않습니다.
            </p>
          </div>
        )}

        {salesMode === "direct" && hasInquiryChannel && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {farm.kakao_chat_url && (
              <a
                href={farm.kakao_chat_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackInquiry("kakao")}
                className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-black"
                style={{ backgroundColor: "#FEE500" }}
              >
                카카오톡으로 확인
              </a>
            )}
            {farm.phone && (
              <a
                href={`tel:${farm.phone}`}
                onClick={() => trackInquiry("phone")}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/60 px-5 py-3 text-sm font-bold text-white"
              >
                전화로 확인
              </a>
            )}
          </div>
        )}

        {farm.naver_store_url && (
          <a
            href={farm.naver_store_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackInquiry("naver")}
            className="mx-auto mt-5 inline-flex min-h-12 items-center px-4 text-sm font-bold text-white/80 underline underline-offset-4 hover:text-white"
          >
            네이버 스마트스토어에서 보기 →
          </a>
        )}

        {farm.address_short && (
          <div className="mt-10 border-t border-white/15 pt-7">
            <p className="text-xs font-bold tracking-wide text-white/50">농장 위치</p>
            <p className="mt-2 font-bold text-white">{farm.address_short}</p>
            {farm.address && (
              <p className="mt-1 text-xs leading-5 text-white/55">{farm.address}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
