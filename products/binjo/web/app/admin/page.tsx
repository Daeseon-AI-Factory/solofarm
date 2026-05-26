"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  by_channel: Record<string, number>;
}

const PAGE_SECTIONS = [
  {
    title: "관리자 페이지",
    color: "#2D5016",
    pages: [
      { href: "/admin/farm", label: "농장 정보", icon: "🌿", desc: "이름, 소개글, 연락처 수정" },
      { href: "/admin/products", label: "상품 관리", icon: "🍎", desc: "사과 품종 추가·수정·가격" },
      { href: "/admin/orders", label: "주문 관리", icon: "📦", desc: "주문 확인·발송·배송완료 처리" },
      { href: "/admin/gallery", label: "사진 갤러리", icon: "📷", desc: "농장 사진 업로드·관리" },
      { href: "/admin/reviews", label: "고객 후기", icon: "⭐", desc: "고객 후기 등록·관리" },
      { href: "/admin/calendar", label: "제철 달력", icon: "📅", desc: "사과 품종별 수확 시기" },
      { href: "/admin/layout-editor", label: "페이지 관리", icon: "🎨", desc: "브랜드 페이지 섹션 순서·표시" },
      { href: "/admin/analytics", label: "방문 통계", icon: "📊", desc: "페이지 방문 수·트래픽 분석" },
    ],
  },
  {
    title: "농부 페이지 (테스트)",
    color: "#B8860B",
    pages: [
      { href: "/farmer/login", label: "농부 로그인", icon: "🔐", desc: "카카오 로그인 / Dev 로그인" },
      { href: "/farmer/dashboard", label: "농부 대시보드", icon: "🏡", desc: "오늘 날씨·최근 일지·필드 현황" },
      { href: "/farmer/record", label: "음성 기록", icon: "🎙️", desc: "음성으로 영농일지 작성" },
      { href: "/farmer/logs", label: "영농일지 목록", icon: "📋", desc: "일지 조회·수정·PDF 내보내기" },
      { href: "/farmer/finance", label: "재무 현황", icon: "💰", desc: "수입·지출·월간 손익 차트" },
      { href: "/farmer/receipt", label: "영수증 촬영", icon: "🧾", desc: "영수증 OCR → 자동 거래 등록" },
      { href: "/farmer/insights", label: "데이터 인사이트", icon: "📈", desc: "고객 분석·매출 추이·AI 제안" },
    ],
  },
  {
    title: "공개 페이지",
    color: "#D4421E",
    pages: [
      { href: "/", label: "브랜드 페이지", icon: "🏠", desc: "빈조농장 메인 (고객용)", target: "_blank" },
      { href: "/checkout?product=테스트사과&productId=test&weight=5kg&price=30000", label: "주문 페이지", icon: "🛒", desc: "상품 주문·결제 (토스페이먼츠)", target: "_blank" },
      { href: "/order-status", label: "주문 조회", icon: "🔍", desc: "주문번호로 배송 상태 확인", target: "_blank" },
    ],
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/inquiries?days=30")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#2D5016" }}>대시보드</h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>
        빈조농장 전체 페이지 허브 — 총 {PAGE_SECTIONS.reduce((n, s) => n + s.pages.length, 0)}개 페이지
      </p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF" }}>
            <p className="text-xs" style={{ color: "#6B6B6B" }}>30일 총 문의</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "#2D5016" }}>{stats.total}</p>
          </div>
          {Object.entries(stats.by_channel).map(([channel, count]) => (
            <div key={channel} className="rounded-xl p-4" style={{ backgroundColor: "#FFFFFF" }}>
              <p className="text-xs" style={{ color: "#6B6B6B" }}>
                {channel === "kakao" ? "카카오 문의" : channel === "phone" ? "전화 문의" : "스마트스토어"}
              </p>
              <p className="text-3xl font-bold mt-1" style={{ color: "#D4421E" }}>{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* All pages by section */}
      {PAGE_SECTIONS.map((section) => (
        <div key={section.title} className="mb-8">
          <h2
            className="text-base font-semibold mb-3 flex items-center gap-2"
            style={{ color: section.color }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: section.color }}
            />
            {section.title}
            <span className="text-xs font-normal" style={{ color: "#9B9B9B" }}>
              ({section.pages.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {section.pages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                target={"target" in page ? (page as { target: string }).target : undefined}
                className="flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <span className="text-2xl shrink-0">{page.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>
                    {page.label}
                    {"target" in page && (
                      <span className="text-xs font-normal ml-1" style={{ color: "#9B9B9B" }}>↗</span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#6B6B6B" }}>{page.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
