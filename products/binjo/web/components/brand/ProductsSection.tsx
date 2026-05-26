"use client";

import { useState } from "react";
import { ProductItem } from "@/types";

interface ProductsSectionProps {
  products: ProductItem[];
}

const MONTH_NAMES = [
  "", "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

function ProductCard({ product }: { product: ProductItem }) {
  const [expanded, setExpanded] = useState(false);
  const priceOptions = product.price_options ?? [];
  const minPrice = priceOptions.length > 0
    ? Math.min(...priceOptions.map((p) => p.price))
    : null;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm border transition-shadow hover:shadow-md"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
    >
      <div className="relative">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-52 object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-52 flex items-center justify-center text-5xl"
            style={{ backgroundColor: "#F5F1EC" }}
          >
            🍎
          </div>
        )}
        {product.is_available && (
          <span
            className="absolute top-3 right-3 text-white text-xs px-2 py-1 rounded-full font-medium"
            style={{ backgroundColor: "#D4421E" }}
          >
            판매 중
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3
              className="text-lg font-bold"
              style={{ color: "#1A1A1A" }}
            >
              {product.name}
            </h3>
            {product.name_en && (
              <p className="text-xs" style={{ color: "#9B9B9B" }}>
                {product.name_en}
              </p>
            )}
          </div>
          {minPrice && (
            <p className="text-lg font-bold" style={{ color: "#D4421E" }}>
              {minPrice.toLocaleString()}원~
            </p>
          )}
        </div>

        {product.short_description && (
          <p className="text-sm mb-3" style={{ color: "#6B6B6B" }}>
            {product.short_description}
          </p>
        )}

        {product.harvest_start_month && product.harvest_end_month && (
          <p className="text-xs mb-3" style={{ color: "#9B9B9B" }}>
            수확: {MONTH_NAMES[product.harvest_start_month]} ~{" "}
            {MONTH_NAMES[product.harvest_end_month]}
          </p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-sm font-medium py-2 rounded-lg transition-colors"
          style={{
            color: "#2D5016",
            backgroundColor: expanded ? "#EDF4E8" : "#F5F1EC",
          }}
        >
          {expanded ? "접기" : "자세히 보기"}
        </button>

        {expanded && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #E5E2DB" }}>
            {product.description && (
              <p className="text-sm mb-4 leading-relaxed" style={{ color: "#1A1A1A" }}>
                {product.description}
              </p>
            )}
            {priceOptions.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "#6B6B6B" }}>
                  가격 안내
                </p>
                <div className="space-y-1">
                  {priceOptions.map((opt, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span style={{ color: "#1A1A1A" }}>{opt.weight}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold" style={{ color: "#D4421E" }}>
                          {opt.price.toLocaleString()}원
                        </span>
                        {product.is_available && (
                          <a
                            href={`/checkout?product=${encodeURIComponent(product.name)}&productId=${product.id}&weight=${encodeURIComponent(opt.weight)}&price=${opt.price}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95"
                            style={{ backgroundColor: "#D4421E" }}
                          >
                            바로 주문
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsSection({ products }: ProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4" style={{ backgroundColor: "#F5F1EC" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#2D5016" }}
          >
            우리 사과
          </h2>
          <div
            className="w-12 h-1 mx-auto rounded"
            style={{ backgroundColor: "#D4421E" }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
