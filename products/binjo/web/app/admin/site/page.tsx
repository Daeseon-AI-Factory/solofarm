"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPage from "@/components/admin/AdminPage";
import AdminNotice from "@/components/admin/AdminNotice";

interface SiteFarmSummary {
  name: string;
  tagline: string | null;
  story: string | null;
  phone: string | null;
  kakao_chat_url: string | null;
  naver_store_url: string | null;
  hero_image_url: string | null;
  farmer_image_url: string | null;
}

interface SiteProductSummary {
  id: string;
  is_available: boolean;
  image_url: string | null;
}

interface SiteOverview {
  farm: SiteFarmSummary | null;
  products: SiteProductSummary[] | null;
  galleryCount: number | null;
  reviewCount: number | null;
  calendarCount: number | null;
}

const EMPTY_OVERVIEW: SiteOverview = {
  farm: null,
  products: null,
  galleryCount: null,
  reviewCount: null,
  calendarCount: null,
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} 요청 실패 (HTTP ${response.status})`);
  return response.json() as Promise<T>;
}

function StatusMark({ ready, unknown = false }: { ready: boolean; unknown?: boolean }) {
  const label = unknown ? "확인 필요" : ready ? "준비됨" : "보완 필요";
  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
      style={{
        backgroundColor: unknown ? "#EEF1ED" : ready ? "#E7F2E1" : "#FFF0DD",
        color: unknown ? "#66705F" : ready ? "#2D5016" : "#8A4515",
      }}
    >
      {label}
    </span>
  );
}

export default function AdminSitePage() {
  const [overview, setOverview] = useState<SiteOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErrors([]);

    const results = await Promise.allSettled([
      fetchJson<SiteFarmSummary>("/api/v1/farm?view=public"),
      fetchJson<SiteProductSummary[]>("/api/v1/products?view=public"),
      fetchJson<unknown[]>("/api/v1/gallery"),
      fetchJson<unknown[]>("/api/v1/reviews"),
      fetchJson<unknown[]>("/api/v1/calendar?view=public"),
    ]);

    const next: SiteOverview = { ...EMPTY_OVERVIEW };
    const nextErrors: string[] = [];
    const labels = ["농장 정보", "상품", "사진", "후기", "제철 달력"];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        nextErrors.push(labels[index]);
        return;
      }
      if (index === 0) next.farm = result.value as SiteFarmSummary;
      if (index === 1) next.products = result.value as SiteProductSummary[];
      if (index === 2) next.galleryCount = (result.value as unknown[]).length;
      if (index === 3) next.reviewCount = (result.value as unknown[]).length;
      if (index === 4) next.calendarCount = (result.value as unknown[]).length;
    });

    setOverview(next);
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadOverview(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadOverview]);

  const readiness = useMemo(() => {
    const farm = overview.farm;
    const products = overview.products;
    return {
      profile: farm
        ? Boolean(farm.name.trim() && farm.tagline?.trim() && farm.story?.trim())
        : false,
      contact: farm
        ? Boolean(farm.phone || farm.kakao_chat_url || farm.naver_store_url)
        : false,
      images: farm
        ? Boolean(farm.hero_image_url && farm.farmer_image_url)
        : false,
      products: products
        ? products.length > 0 && products.every((product) => Boolean(product.image_url))
        : false,
    };
  }, [overview]);

  const cards = [
    {
      href: "/admin/farm",
      title: "농장 소개와 연락처",
      description: "농장 이야기, 대표 사진, 전화·카카오 채널을 관리합니다.",
      detail: overview.farm
        ? `${[readiness.profile, readiness.contact, readiness.images].filter(Boolean).length}/3 항목 준비`
        : "정보를 확인하지 못했습니다",
      ready: Boolean(overview.farm && readiness.profile && readiness.contact && readiness.images),
      unknown: overview.farm === null,
    },
    {
      href: "/admin/products",
      title: "상품과 판매 상태",
      description: "고객에게 보이는 품종, 사진, 가격과 판매 상태를 관리합니다.",
      detail: overview.products
        ? `${overview.products.length}개 상품 · ${overview.products.filter((item) => item.is_available).length}개 판매 문의 가능`
        : "상품을 확인하지 못했습니다",
      ready: readiness.products,
      unknown: overview.products === null,
    },
    {
      href: "/admin/gallery",
      title: "농장 사진",
      description: "과수원과 수확 현장 사진을 고객 페이지에 추가합니다.",
      detail: overview.galleryCount === null ? "사진을 확인하지 못했습니다" : `${overview.galleryCount}장 등록`,
      ready: (overview.galleryCount ?? 0) > 0,
      unknown: overview.galleryCount === null,
    },
    {
      href: "/admin/reviews",
      title: "고객 후기",
      description: "동의를 받은 실제 구매 후기를 등록하고 관리합니다.",
      detail: overview.reviewCount === null ? "후기를 확인하지 못했습니다" : `${overview.reviewCount}개 등록`,
      ready: (overview.reviewCount ?? 0) > 0,
      unknown: overview.reviewCount === null,
    },
    {
      href: "/admin/calendar",
      title: "제철 달력",
      description: "월별 수확 품종과 농장 활동을 안내합니다.",
      detail: overview.calendarCount === null ? "달력을 확인하지 못했습니다" : `${overview.calendarCount}개월 입력`,
      ready: (overview.calendarCount ?? 0) > 0,
      unknown: overview.calendarCount === null,
    },
    {
      href: "/admin/layout-editor",
      title: "섹션 순서와 노출",
      description: "고객 페이지의 섹션 순서와 보이기 여부를 설정합니다.",
      detail: "고급 설정",
      ready: true,
      unknown: false,
    },
  ];

  return (
    <AdminPage
      title="홈페이지"
      description="고객에게 보이는 농장 소개와 판매 정보를 한곳에서 관리합니다."
      eyebrow="CUSTOMER PAGE"
      maxWidth="wide"
      actions={
        <>
          <Link
            href="/"
            target="_blank"
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold sm:flex-none"
            style={{ borderColor: "#CFD6CA", color: "#2D5016" }}
          >
            고객 페이지 보기 ↗
          </Link>
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
            className="min-h-12 flex-1 rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50 sm:flex-none"
            style={{ borderColor: "#CFD6CA", color: "#2D5016" }}
          >
            {loading ? "확인 중" : "새로고침"}
          </button>
        </>
      }
    >
      {errors.length > 0 && (
        <AdminNotice
          tone="warning"
          title="일부 정보를 확인하지 못했습니다"
          className="mb-5"
          action={
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold"
              style={{ borderColor: "#D6AD6A" }}
            >
              다시 확인
            </button>
          }
        >
          {errors.join(", ")} 영역은 저장 전에 다시 확인해주세요.
        </AdminNotice>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex min-h-44 flex-col justify-between rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5016]"
            style={{ borderColor: "#DEE3DA" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "#1F3D12" }}>{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#66705F" }}>{card.description}</p>
              </div>
              <StatusMark ready={card.ready} unknown={card.unknown} />
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <p className="text-sm font-semibold" style={{ color: "#4E5F48" }}>{card.detail}</p>
              <span className="text-xl transition-transform group-hover:translate-x-1" style={{ color: "#2D5016" }} aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: "#DEE3DA" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold" style={{ color: "#1F3D12" }}>연락 버튼 클릭</h2>
            <p className="mt-1 text-sm" style={{ color: "#66705F" }}>
              카카오·전화·스마트스토어 버튼 클릭 추이를 봅니다. 실제 문의 건수와는 다릅니다.
            </p>
          </div>
          <Link
            href="/admin/analytics"
            className="flex min-h-12 items-center rounded-xl px-4 text-sm font-bold"
            style={{ backgroundColor: "#EFF4EC", color: "#2D5016" }}
          >
            클릭 현황 보기
          </Link>
        </div>
      </section>
    </AdminPage>
  );
}
