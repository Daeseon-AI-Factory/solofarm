import Image from "next/image";
import type { PublicSalesMode } from "@/lib/publicFarmProfile";
import type { FarmProfile } from "@/types";

interface HeroSectionProps {
  farm: FarmProfile;
  salesMode: PublicSalesMode;
}

const SALES_COPY: Record<
  PublicSalesMode,
  { eyebrow: string; description: string; ctaLabel?: string; ctaHref?: string }
> = {
  direct: {
    eyebrow: "온라인 주문 가능",
    description: "판매 중인 상품과 용량을 확인하고 바로 주문할 수 있습니다.",
    ctaLabel: "판매 상품 보기",
    ctaHref: "#products",
  },
  inquiry: {
    eyebrow: "주문 문의 가능",
    description: "재고와 출고일을 확인한 뒤 예약을 도와드립니다.",
    ctaLabel: "주문·예약 문의",
    ctaHref: "#order",
  },
  preparing: {
    eyebrow: "판매 준비 중",
    description: "올해 판매 상품과 주문 연락처를 확인하고 있습니다.",
  },
};

export default function HeroSection({ farm, salesMode }: HeroSectionProps) {
  const salesCopy = SALES_COPY[salesMode];

  return (
    <section
      className="relative flex h-[76svh] min-h-[600px] max-h-[760px] items-end overflow-hidden md:items-center"
      style={{ backgroundColor: "#17370F" }}
    >
      {farm.hero_image_url ? (
        <Image
          src={farm.hero_image_url}
          alt={`${farm.name} 농장 풍경`}
          fill
          priority
          quality={82}
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 82% 16%, rgba(232,145,58,0.2), transparent 28%), radial-gradient(circle at 8% 88%, rgba(74,124,46,0.42), transparent 34%), linear-gradient(145deg, #17370F 0%, #264D19 52%, #102B0B 100%)",
          }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          background: farm.hero_image_url
            ? "linear-gradient(180deg, rgba(8,22,5,0.2) 0%, rgba(8,22,5,0.52) 58%, rgba(8,22,5,0.88) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.2) 100%)",
        }}
      />

      {!farm.hero_image_url && (
        <div
          aria-hidden="true"
          className="absolute -right-20 top-24 h-56 w-56 rounded-full border border-white/10 md:h-80 md:w-80"
        />
      )}

      <div className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-white md:px-8">
          <p className="text-sm font-bold tracking-[0.18em]">BINJO FARM</p>
          {farm.address_short && (
            <p className="text-xs font-medium text-white/75">
              {farm.address_short}
            </p>
          )}
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-5xl px-5 pb-10 text-white md:px-8 md:pb-16">
        <div className="max-w-2xl min-w-0">
          <p
            className="mb-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide"
            style={{
              borderColor: "rgba(255,255,255,0.28)",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "#F5C383",
            }}
          >
            {salesCopy.eyebrow}
          </p>

          <h1 className="break-keep text-[clamp(2.8rem,13vw,4.75rem)] font-bold leading-[1.02] tracking-[-0.04em]">
            {farm.name}
          </h1>
          <p className="mt-5 max-w-xl break-keep text-lg font-medium leading-8 text-white/90 md:text-2xl md:leading-9">
            농장에서 직접 전하는 사과와 계절 이야기
          </p>
          {farm.tagline && (
            <p className="mt-3 max-w-xl break-keep text-sm leading-6 text-white/70 md:text-base">
              {farm.tagline}
            </p>
          )}

          <div className="mt-8 max-w-lg rounded-2xl border border-white/15 bg-black/20 p-4 backdrop-blur-sm md:p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full"
                style={{
                  backgroundColor:
                    salesMode === "preparing" ? "#E8913A" : "#84B866",
                }}
              />
              <p className="break-keep text-sm leading-6 text-white/85">
                {salesCopy.description}
              </p>
            </div>
          </div>

          {salesCopy.ctaLabel && salesCopy.ctaHref && (
            <a
              href={salesCopy.ctaHref}
              className="mt-6 inline-flex min-h-12 w-full max-w-[18rem] items-center justify-center rounded-full px-7 py-3 text-base font-bold text-white shadow-lg transition-transform active:scale-[0.98] md:w-auto"
              style={{ backgroundColor: "#D4421E" }}
            >
              {salesCopy.ctaLabel}
              <span aria-hidden="true" className="ml-2">→</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
