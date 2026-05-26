"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn, getMyProfile, logout } from "@/lib/farmerApi";

const NAV_ITEMS = [
  { href: "/farmer/dashboard", label: "홈", icon: "🏠" },
  { href: "/farmer/record", label: "기록", icon: "✏️" },
  { href: "/farmer/calendar", label: "달력", icon: "📅" },
  { href: "/farmer/logs", label: "일지", icon: "📋" },
  { href: "/farmer/finance", label: "가계부", icon: "💰" },
  { href: "/farmer/fields", label: "필지", icon: "🌳" },
  { href: "/farmer/receipt", label: "영수증", icon: "📷" },
  { href: "/farmer/insights", label: "인사이트", icon: "📊" },
];

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [nickname, setNickname] = useState<string>("");
  const [checking, setChecking] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    // Check auth status
    if (!isLoggedIn()) {
      // Allow the login page through
      if (pathname === "/farmer/login") {
        setChecking(false);
        return;
      }
      router.replace("/farmer/login");
      return;
    }

    // Fetch profile
    getMyProfile()
      .then((p) => {
        setNickname(p.nickname || "농부");
        setChecking(false);
      })
      .catch(() => {
        // Token expired or invalid
        logout();
        router.replace("/farmer/login");
      });
  }, [pathname, router]);

  if (checking) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FDFBF7" }}
      >
        <p style={{ color: "#9B9B9B" }}>로딩 중...</p>
      </div>
    );
  }

  // Login page gets no nav
  if (pathname === "/farmer/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FDFBF7" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between border-b"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#2D5016" }}>
            빈조농장
          </h1>
          <p className="text-xs" style={{ color: "#6B6B6B" }}>
            안녕하세요, {nickname}님
          </p>
        </div>
        <button
          onClick={() => { logout(); router.replace("/farmer/login"); }}
          className="text-xs px-4 py-2.5 rounded-lg"
          style={{ backgroundColor: "#F5F1EC", color: "#6B6B6B", minHeight: "44px" }}
        >
          로그아웃
        </button>
      </header>

      {/* Content */}
      <main className="pb-20">{children}</main>

      {/* Bottom nav — mobile-first, first 4 tabs + "more" */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
      >
        {/* "More" popup */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div
              className="absolute bottom-full left-0 right-0 z-50 rounded-t-2xl shadow-lg p-4 grid grid-cols-3 gap-3"
              style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E5E2DB" }}
            >
              {NAV_ITEMS.slice(4).map((item) => {
                const active = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { router.push(item.href); setMoreOpen(false); }}
                    className="flex flex-col items-center gap-1 py-4 rounded-xl text-xs font-medium"
                    style={{
                      backgroundColor: active ? "#EDF4E8" : "transparent",
                      color: active ? "#2D5016" : "#6B6B6B",
                    }}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="flex">
          {NAV_ITEMS.slice(0, 4).map((item) => {
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setMoreOpen(false); }}
                className="flex-1 flex flex-col items-center py-3 transition-colors"
                style={{ color: active ? "#2D5016" : "#9B9B9B" }}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex-1 flex flex-col items-center py-3 transition-colors"
            style={{
              color: moreOpen || NAV_ITEMS.slice(4).some((i) => pathname === i.href)
                ? "#2D5016"
                : "#9B9B9B",
            }}
          >
            <span className="text-xl">&#8943;</span>
            <span className="text-[10px] mt-0.5 font-medium">더보기</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
