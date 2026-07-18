"use client";

import { useState } from "react";
import Image from "next/image";
import type { PublicSalesMode } from "@/lib/publicFarmProfile";
import type { ProductItem } from "@/types";

interface ProductsSectionProps {
  products: ProductItem[];
  directCheckoutEnabled: boolean;
  salesMode: PublicSalesMode;
}

const MONTH_NAMES = [
  "", "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

function salesBadge(product: ProductItem, salesMode: PublicSalesMode) {
  if (!product.is_available) {
    return { label: "수확 예정", background: "#F5F1EC", color: "#5E6559" };
  }
  if (salesMode === "direct") {
    return { label: "온라인 주문 가능", background: "#FCE8DF", color: "#A63218" };
  }
  if (salesMode === "inquiry") {
    return { label: "재고 문의 가능", background: "#E3EFE0", color: "#244C19" };
  }
  return { label: "판매 준비 중", background: "#FEF0D9", color: "#7B4B12" };
}

function ProductCard({
  product,
  directCheckoutEnabled,
  salesMode,
}: {
  product: ProductItem;
  directCheckoutEnabled: boolean;
  salesMode: PublicSalesMode;
}) {
  const [expanded, setExpanded] = useState(false);
  const priceOptions = product.price_options ?? [];
  const canShowSaleDetails = product.is_available && salesMode !== "preparing";
  const minPrice =
    canShowSaleDetails && priceOptions.length > 0
      ? Math.min(...priceOptions.map((option) => option.price))
      : null;
  const badge = salesBadge(product, salesMode);
  const detailId = `product-detail-${product.id}`;

  return (
    <article
      className="w-[82vw] max-w-[340px] flex-none snap-start overflow-hidden rounded-[1.4rem] border bg-white shadow-sm transition-shadow hover:shadow-md md:w-auto md:max-w-none"
      style={{ borderColor: "#DED9CE" }}
    >
      {product.image_url ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-[#EFEAE0]">
          <Image
            src={product.image_url}
            alt={`${product.name} 사과`}
            fill
            quality={78}
            sizes="(max-width: 767px) 82vw, (max-width: 1023px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div
          className="flex aspect-[4/3] items-end p-5"
          style={{
            background:
              "radial-gradient(circle at 78% 25%, rgba(212,66,30,0.22), transparent 26%), linear-gradient(145deg, #E8E2D5, #F7F3EA)",
          }}
        >
          <p className="text-xs font-semibold" style={{ color: "#596052" }}>
            실제 상품 사진 준비 중
          </p>
        </div>
      )}

      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ backgroundColor: badge.background, color: badge.color }}
          >
            {badge.label}
          </span>
          {product.harvest_start_month && product.harvest_end_month && (
            <span className="text-xs font-medium" style={{ color: "#66705F" }}>
              {MONTH_NAMES[product.harvest_start_month]}–
              {MONTH_NAMES[product.harvest_end_month]}
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold tracking-[-0.02em]" style={{ color: "#1A1A1A" }}>
              {product.name}
            </h3>
            {product.name_en && (
              <p className="mt-0.5 text-xs" style={{ color: "#66705F" }}>
                {product.name_en}
              </p>
            )}
          </div>
          {minPrice !== null && (
            <p className="flex-none text-lg font-bold" style={{ color: "#B9381B" }}>
              {minPrice.toLocaleString()}원~
            </p>
          )}
        </div>

        {product.short_description && (
          <p className="mt-3 break-keep text-sm leading-6" style={{ color: "#5F655B" }}>
            {product.short_description}
          </p>
        )}

        {(product.description || (canShowSaleDetails && priceOptions.length > 0)) && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={detailId}
            className="mt-5 min-h-12 w-full rounded-xl px-4 py-2 text-sm font-bold transition-colors"
            style={{
              color: "#244C19",
              backgroundColor: expanded ? "#E3EFE0" : "#F3F0E9",
            }}
          >
            {expanded ? "상품 정보 접기" : "상품 정보 보기"}
          </button>
        )}

        {expanded && (
          <div id={detailId} className="mt-4 border-t pt-4" style={{ borderColor: "#E5E2DB" }}>
            {product.description && (
              <p className="break-keep text-sm leading-6" style={{ color: "#30342E" }}>
                {product.description}
              </p>
            )}

            {canShowSaleDetails && priceOptions.length > 0 && (
              <div className="mt-4 space-y-3">
                {priceOptions.map((option) => (
                  <div
                    key={`${option.weight}-${option.price}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF8F3] px-3 py-3 text-sm"
                  >
                    <span style={{ color: "#30342E" }}>{option.weight}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: "#B9381B" }}>
                        {option.price.toLocaleString()}원
                      </span>
                      {directCheckoutEnabled && salesMode === "direct" ? (
                        <a
                          href={`/checkout?productId=${product.id}&weight=${encodeURIComponent(option.weight)}`}
                          className="inline-flex min-h-12 items-center rounded-lg px-3 text-xs font-bold text-white"
                          style={{ backgroundColor: "#B9381B" }}
                        >
                          주문하기
                        </a>
                      ) : salesMode === "inquiry" ? (
                        <a
                          href="#order"
                          className="inline-flex min-h-12 items-center rounded-lg px-3 text-xs font-bold"
                          style={{ backgroundColor: "#E3EFE0", color: "#244C19" }}
                        >
                          재고 문의
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function ProductsSection({
  products,
  directCheckoutEnabled,
  salesMode,
}: ProductsSectionProps) {
  const orderedProducts = [...products].sort(
    (left, right) => Number(right.is_available) - Number(left.is_available)
  );

  return (
    <section id="products" className="scroll-mt-4 bg-[#F3F0E9] py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-9 md:mb-12">
          <p className="mb-2 text-xs font-bold tracking-[0.16em]" style={{ color: "#B9381B" }}>
            SEASONAL APPLES
          </p>
          <h2 className="break-keep text-3xl font-bold tracking-[-0.04em] md:text-4xl" style={{ color: "#244C19" }}>
            올해 만날 사과
          </h2>
          <p className="mt-3 max-w-xl break-keep text-sm leading-6 md:text-base" style={{ color: "#5F655B" }}>
            확인된 판매 상태와 수확 시기만 안내합니다.
          </p>
        </div>

        {orderedProducts.length > 0 ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 scrollbar-hide md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
            {orderedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                directCheckoutEnabled={directCheckoutEnabled}
                salesMode={salesMode}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[1.5rem] border bg-white p-6 md:p-9" style={{ borderColor: "#DED9CE" }}>
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <span className="inline-flex rounded-full bg-[#FEF0D9] px-3 py-1 text-xs font-bold text-[#7B4B12]">
                  판매 준비 중
                </span>
                <h3 className="mt-4 break-keep text-xl font-bold text-[#24331E] md:text-2xl">
                  올해 상품과 출고 일정을 확인하고 있습니다
                </h3>
                <p className="mt-2 max-w-xl break-keep text-sm leading-6 text-[#5F655B]">
                  확인되지 않은 가격이나 상품을 먼저 공개하지 않습니다. 준비가 끝나면 이곳에서 정확한 판매 정보를 안내하겠습니다.
                </p>
              </div>
              <div aria-hidden="true" className="flex h-24 w-24 items-center justify-center rounded-full bg-[#EDF3E9] text-[#B63A20] md:h-28 md:w-28">
                <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none">
                  <path d="M33 20c1-8 6-13 13-15" stroke="#24482B" strokeWidth="4" strokeLinecap="round" />
                  <path d="M34 15c6-4 12-3 16 1-6 4-12 3-16-1Z" fill="#4F713E" />
                  <path d="M32 20c-14-8-24 3-22 17 2 14 12 23 22 18 10 5 20-4 22-18 2-14-8-25-22-17Z" fill="currentColor" />
                  <path d="M21 29c3-4 7-5 11-5" stroke="#F7F3E9" strokeWidth="3" strokeLinecap="round" opacity=".72" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
