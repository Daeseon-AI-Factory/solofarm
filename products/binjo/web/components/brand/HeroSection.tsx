"use client";

import { FarmProfile } from "@/types";

interface HeroSectionProps {
  farm: FarmProfile;
}

export default function HeroSection({ farm }: HeroSectionProps) {
  const scrollToOrder = () => {
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#2D5016" }}
    >
      {farm.hero_image_url && (
        <img
          src={farm.hero_image_url}
          alt="빈조농장"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60" />

      <div className="relative z-10 text-center text-white px-4 max-w-2xl mx-auto">
        <p
          className="text-sm font-medium tracking-widest mb-4 opacity-90"
          style={{ color: "#E8913A" }}
        >
          {farm.address_short ?? "경남 사천시 용치골"}
        </p>
        <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
          {farm.name}
        </h1>
        <p className="text-xl md:text-2xl mb-3 opacity-90 font-medium">
          경남 사천 용치골의 사과
        </p>
        {farm.tagline && (
          <p className="text-base md:text-lg mb-10 opacity-80 italic">
            "{farm.tagline}"
          </p>
        )}
        <button
          onClick={scrollToOrder}
          className="inline-block px-8 py-4 rounded-full text-white font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg"
          style={{ backgroundColor: "#D4421E" }}
        >
          주문 문의하기
        </button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <svg
          className="w-6 h-6 text-white opacity-70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </section>
  );
}
