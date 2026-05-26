"use client";

import { useEffect, useState } from "react";

interface StickyOrderCTAProps {
  kakaoUrl: string | null;
  phone: string | null;
}

export default function StickyOrderCTA({ kakaoUrl, phone }: StickyOrderCTAProps) {
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
  if (!kakaoUrl && !phone) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 p-3 flex gap-2 shadow-2xl md:hidden"
      style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E5E2DB" }}
    >
      {kakaoUrl && (
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
          style={{ backgroundColor: "#FEE500", color: "#000000" }}
          onClick={() => {
            fetch("/api/v1/inquiry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channel: "kakao" }),
            }).catch(() => {});
          }}
        >
          💬 카카오 문의
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white"
          style={{ backgroundColor: "#2D5016" }}
          onClick={() => {
            fetch("/api/v1/inquiry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channel: "phone" }),
            }).catch(() => {});
          }}
        >
          📞 전화 주문
        </a>
      )}
    </div>
  );
}
