"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPage from "@/components/admin/AdminPage";
import AdminNotice from "@/components/admin/AdminNotice";

interface InquiryStats {
  total: number;
  by_channel: Record<string, number>;
}

interface OrderSummary {
  id: string;
  status: string;
}

interface ProductSummary {
  id: string;
  is_available: boolean;
  image_url: string | null;
}

interface FarmSummary {
  story: string | null;
  phone: string | null;
  kakao_chat_url: string | null;
  hero_image_url: string | null;
  farmer_image_url: string | null;
}

interface DashboardData {
  inquiries: InquiryStats | null;
  orders: OrderSummary[] | null;
  products: ProductSummary[] | null;
  farm: FarmSummary | null;
  galleryCount: number | null;
  reviewCount: number | null;
}

interface WorkItem {
  href: string;
  label: string;
  detail: string;
  tone: "urgent" | "warning" | "setup";
}

const EMPTY_DATA: DashboardData = {
  inquiries: null,
  orders: null,
  products: null,
  farm: null,
  galleryCount: null,
  reviewCount: null,
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function hasRealPhone(phone: string | null): boolean {
  if (!phone) return false;
  const normalized = phone.replace(/\s/g, "");
  return normalized !== "010-0000-0000" && !/^0+$/.test(normalized.replace(/\D/g, ""));
}

function hasRealUrl(url: string | null): boolean {
  if (!url) return false;
  return !url.includes("_xxxxx") && !url.includes("example.com");
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setUnavailable([]);

    const results = await Promise.allSettled([
      fetchJson<InquiryStats>("/api/admin/inquiries?days=30"),
      fetchJson<OrderSummary[]>("/api/admin/orders"),
      fetchJson<ProductSummary[]>("/api/v1/products?view=public"),
      fetchJson<FarmSummary>("/api/v1/farm?view=public"),
      fetchJson<unknown[]>("/api/v1/gallery"),
      fetchJson<unknown[]>("/api/v1/reviews"),
    ]);
    const labels = ["연락 클릭", "주문", "상품", "농장 정보", "사진", "후기"];
    const next: DashboardData = { ...EMPTY_DATA };
    const nextUnavailable: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        nextUnavailable.push(labels[index]);
        return;
      }
      if (index === 0) next.inquiries = result.value as InquiryStats;
      if (index === 1) next.orders = result.value as OrderSummary[];
      if (index === 2) next.products = result.value as ProductSummary[];
      if (index === 3) next.farm = result.value as FarmSummary;
      if (index === 4) next.galleryCount = (result.value as unknown[]).length;
      if (index === 5) next.reviewCount = (result.value as unknown[]).length;
    });

    setData(next);
    setUnavailable(nextUnavailable);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  const overview = useMemo(() => {
    const paid = data.orders?.filter((order) => order.status === "paid").length ?? null;
    const readyToShip = data.orders?.filter((order) => order.status === "confirmed").length ?? null;
    const shipping = data.orders?.filter((order) => order.status === "shipped").length ?? null;
    const availableProducts = data.products?.filter((product) => product.is_available).length ?? null;
    const productsWithoutImages = data.products?.filter((product) => !product.image_url).length ?? null;
    const workItems: WorkItem[] = [];

    if (paid && paid > 0) {
      workItems.push({
        href: "/admin/orders",
        label: `결제 확인 ${paid}건`,
        detail: "결제된 주문을 확인하고 발송 준비로 넘기세요.",
        tone: "urgent",
      });
    }
    if (readyToShip && readyToShip > 0) {
      workItems.push({
        href: "/admin/orders",
        label: `발송 대기 ${readyToShip}건`,
        detail: "택배사와 송장번호를 입력해 발송 처리하세요.",
        tone: "urgent",
      });
    }
    if (shipping && shipping > 0) {
      workItems.push({
        href: "/admin/orders",
        label: `배송 중 ${shipping}건`,
        detail: "도착이 확인된 주문을 배송 완료로 정리하세요.",
        tone: "warning",
      });
    }
    if (
      data.farm &&
      !hasRealPhone(data.farm.phone) &&
      !hasRealUrl(data.farm.kakao_chat_url)
    ) {
      workItems.push({
        href: "/admin/farm",
        label: "주문 연락처 등록",
        detail: "고객이 연락할 수 있는 실제 전화 또는 카카오 채널을 입력하세요.",
        tone: "setup",
      });
    }
    if (
      data.farm &&
      (!data.farm.hero_image_url || !data.farm.farmer_image_url || !data.farm.story?.trim())
    ) {
      workItems.push({
        href: "/admin/farm",
        label: "농장 소개 보완",
        detail: "대표 사진, 농장주 사진과 실제 농장 이야기를 등록하세요.",
        tone: "setup",
      });
    }
    if (productsWithoutImages && productsWithoutImages > 0) {
      workItems.push({
        href: "/admin/products",
        label: `상품 사진 ${productsWithoutImages}개 보완`,
        detail: "사진이 없는 상품은 고객에게 신뢰를 주기 어렵습니다.",
        tone: "setup",
      });
    }
    if (data.galleryCount === 0) {
      workItems.push({
        href: "/admin/gallery",
        label: "농장 현장 사진 등록",
        detail: "과수원과 수확 현장 사진을 고객 페이지에 추가하세요.",
        tone: "setup",
      });
    }
    if (data.reviewCount === 0) {
      workItems.push({
        href: "/admin/reviews",
        label: "동의받은 고객 후기 등록",
        detail: "실제 구매자의 동의를 받은 후기만 추가하세요.",
        tone: "setup",
      });
    }

    return { paid, readyToShip, shipping, availableProducts, workItems };
  }, [data]);

  const metrics = [
    { label: "결제 확인", value: overview.paid, accent: Boolean(overview.paid) },
    { label: "발송 대기", value: overview.readyToShip, accent: Boolean(overview.readyToShip) },
    { label: "배송 중", value: overview.shipping, accent: false },
    { label: "판매 문의 가능", value: overview.availableProducts, accent: false },
  ];

  return (
    <AdminPage
      title="오늘"
      description="처리할 주문부터 확인하고 필요한 홈페이지 작업을 이어가세요."
      eyebrow="TODAY'S FARM WORK"
      maxWidth="wide"
      actions={
        <>
          <Link
            href="/admin/orders?new=1"
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl px-5 text-sm font-bold text-white sm:flex-none"
            style={{ backgroundColor: "#2D5016" }}
          >
            + 주문 받기
          </Link>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="min-h-12 flex-1 rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50 sm:flex-none"
            style={{ borderColor: "#CFD6CA", color: "#2D5016" }}
          >
            {loading ? "확인 중" : "새로고침"}
          </button>
        </>
      }
    >
      {unavailable.length > 0 && (
        <AdminNotice
          tone="warning"
          title="일부 운영 정보를 불러오지 못했습니다"
          className="mb-5"
          action={
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold"
              style={{ borderColor: "#D6AD6A" }}
            >
              다시 확인
            </button>
          }
        >
          {unavailable.join(", ")} 정보는 현재 표시하지 않습니다. 나머지 영역은 계속 사용할 수 있습니다.
        </AdminNotice>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="오늘의 운영 현황">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="min-h-28 rounded-2xl border bg-white p-4 md:p-5"
            style={{ borderColor: item.accent ? "#E7B16A" : "#DEE3DA" }}
          >
            <p className="text-sm font-semibold" style={{ color: "#66705F" }}>{item.label}</p>
            <p
              className="mt-2 text-3xl font-bold"
              style={{ color: item.accent ? "#A65019" : "#1F3D12" }}
            >
              {item.value === null ? "—" : item.value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border bg-white p-5 md:p-6" style={{ borderColor: "#DEE3DA" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#1F3D12" }}>지금 처리할 일</h2>
              <p className="mt-1 text-sm" style={{ color: "#66705F" }}>주문과 고객 신뢰에 가까운 순서입니다.</p>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}>
              {overview.workItems.length}개
            </span>
          </div>

          {overview.workItems.length === 0 ? (
            <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#F3F6F1" }}>
              <p className="font-bold" style={{ color: "#2D5016" }}>
                {loading ? "운영 상태를 확인하고 있습니다" : "지금 급한 작업이 없습니다"}
              </p>
              <p className="mt-1 text-sm" style={{ color: "#66705F" }}>
                새 주문이 들어오면 이곳에 먼저 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.workItems.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="group flex min-h-24 items-center justify-between gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5016]"
                  style={{
                    backgroundColor: item.tone === "urgent" ? "#FFF7ED" : "#F8FAF6",
                    borderColor: item.tone === "urgent" ? "#F2C48D" : "#DFE5DA",
                  }}
                >
                  <div>
                    <p className="font-bold" style={{ color: item.tone === "urgent" ? "#8A4515" : "#243D18" }}>
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "#66705F" }}>{item.detail}</p>
                  </div>
                  <span className="text-xl transition-transform group-hover:translate-x-1" style={{ color: "#2D5016" }} aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border p-5 text-white" style={{ backgroundColor: "#203A17", borderColor: "#203A17" }}>
            <p className="text-xs font-bold tracking-widest text-white/60">최근 30일</p>
            <p className="mt-2 text-4xl font-bold">{data.inquiries?.total ?? "—"}</p>
            <p className="mt-1 text-sm text-white/75">연락 버튼 클릭</p>
            <p className="mt-3 text-xs leading-relaxed text-white/55">
              실제 상담이나 주문 건수가 아닌 카카오·전화·스토어 버튼 클릭 수입니다.
            </p>
            <Link href="/admin/analytics" className="mt-5 inline-flex min-h-12 items-center text-sm font-bold underline underline-offset-4">
              클릭 현황 보기
            </Link>
          </section>

          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: "#DEE3DA" }}>
            <h2 className="font-bold" style={{ color: "#1F3D12" }}>바로가기</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { href: "/admin/orders", label: "주문" },
                { href: "/admin/products", label: "상품" },
                { href: "/admin/site", label: "홈페이지" },
                { href: "/", label: "고객 화면", external: true },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  className="flex min-h-12 items-center justify-center rounded-xl px-3 text-center text-sm font-bold"
                  style={{ backgroundColor: "#F1F5EE", color: "#2D5016" }}
                >
                  {item.label}{item.external ? " ↗" : ""}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
