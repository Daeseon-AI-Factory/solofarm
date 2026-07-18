"use client";

import { useEffect, useState } from "react";
import type { PublicSalesMode } from "@/lib/publicFarmProfile";

interface StickyOrderCTAProps {
  kakaoUrl: string | null;
  phone: string | null;
  salesMode: PublicSalesMode;
}

export default function StickyOrderCTA({
  kakaoUrl,
  phone,
  salesMode,
}: StickyOrderCTAProps) {
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    const orderSection = document.getElementById("order");

    // Show CTA after scrolling past 300px, hide when order section is in view
    const handleScroll = () => {
      const scrolled = window.scrollY > 300;
      const orderInView = orderSection
        ? orderSection.getBoundingClientRect().top < window.innerHeight
        : false;
      setShowCTA(scrolled && !orderInView);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // run once on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!showCTA) return null;
  if (salesMode === "preparing") return null;
  if (!kakaoUrl && !phone) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 px-3 pt-3 shadow-2xl md:hidden"
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E5E2DB",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
      role="navigation"
      aria-label="빠른 주문 문의"
    >
      {kakaoUrl && (
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold"
          style={{ backgroundColor: "#FEE500", color: "#000000" }}
          onClick={() => {
            fetch("/api/v1/inquiry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channel: "kakao" }),
            }).catch(() => {});
          }}
        >
          카카오 문의
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-white"
          style={{ backgroundColor: "#2D5016" }}
          onClick={() => {
            fetch("/api/v1/inquiry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channel: "phone" }),
            }).catch(() => {});
          }}
        >
          전화 문의
        </a>
      )}
    </div>
  );
}
