"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn, getMyProfile, logout } from "@/lib/farmerApi";
import FarmerIcon from "@/components/farmer/FarmerIcon";

const PRIMARY_NAV_ITEMS = [
  { href: "/farmer/dashboard", label: "오늘", icon: "today" },
  { href: "/farmer/record", label: "작업 기록", icon: "record" },
  { href: "/farmer/logs", label: "일지 보기", icon: "logs" },
  { href: "/farmer/finance", label: "가계부", icon: "finance" },
] as const;

const MANAGEMENT_ITEMS = [
  { href: "/farmer/calendar", label: "달력", icon: "calendar" },
  { href: "/farmer/fields", label: "필지", icon: "fields" },
] as const;

function isPrimaryItemActive(pathname: string, href: string): boolean {
  if (href === "/farmer/finance") {
    return ["/farmer/finance", "/farmer/transactions", "/farmer/receipt"].some(
      (path) => pathname.startsWith(path)
    );
  }
  return pathname === href;
}

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [nickname, setNickname] = useState<string>("");
  const [checking, setChecking] = useState(true);
  const [managementOpen, setManagementOpen] = useState(false);

  useEffect(() => {
    // The login route renders immediately without the authenticated shell.
    if (pathname === "/farmer/login") return;

    // Check auth status
    if (!isLoggedIn()) {
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

  // Login page gets no auth-loading screen or navigation.
  if (pathname === "/farmer/login") {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FDFBF7" }}
      >
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="farmer-shell" style={{ backgroundColor: "#FDFBF7" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between border-b px-4 pb-3"
        style={{
          backgroundColor: "#FFFFFF",
          borderColor: "#E5E2DB",
          paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
        }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#2D5016" }}>
            빈조농장
          </h1>
          <p className="text-sm" style={{ color: "#6B6B6B" }}>
            안녕하세요, {nickname}님
          </p>
        </div>
        <button
          type="button"
          onClick={() => setManagementOpen(true)}
          className="min-h-12 rounded-xl px-4 text-sm font-bold"
          style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
          aria-haspopup="dialog"
          aria-expanded={managementOpen}
        >
          관리
        </button>
      </header>

      {/* Content */}
      <main className="farmer-main">{children}</main>

      {managementOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="farmer-management-title"
          onClick={() => setManagementOpen(false)}
        >
          <section
            className="w-full max-w-lg rounded-t-3xl p-5 shadow-2xl"
            style={{ backgroundColor: "#FFFFFF" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="farmer-management-title" className="text-lg font-bold" style={{ color: "#2D5016" }}>
                농장 관리
              </h2>
              <button
                type="button"
                onClick={() => setManagementOpen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: "#F5F1EC", color: "#66705F" }}
                aria-label="관리 메뉴 닫기"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MANAGEMENT_ITEMS.map((item) => (
                <button
                  type="button"
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setManagementOpen(false);
                  }}
                  className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl text-base font-bold"
                  style={{ backgroundColor: "#F5F1EC", color: "#2D5016" }}
                >
                  <FarmerIcon name={item.icon} className="h-7 w-7" />
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!window.confirm("로그아웃하시겠습니까?")) return;
                logout();
                setManagementOpen(false);
                router.replace("/farmer/login");
              }}
              className="mt-4 min-h-14 w-full rounded-2xl text-base font-bold"
              style={{ backgroundColor: "#FFF2EC", color: "#9F3F24" }}
            >
              로그아웃
            </button>
          </section>
        </div>
      )}

      {/* Bottom nav — four stable destinations for one-handed field use. */}
      <nav
        className="farmer-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E5E2DB" }}
        aria-label="농장 주요 메뉴"
      >
        <div
          className="grid grid-cols-4"
          style={{ minHeight: "var(--farmer-nav-height)" }}
        >
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isPrimaryItemActive(pathname, item.href);
            return (
              <button
                type="button"
                key={item.href}
                onClick={() => router.push(item.href)}
                className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-semibold transition-colors"
                style={{ color: active ? "#2D5016" : "var(--color-text-muted)" }}
                aria-current={active ? "page" : undefined}
              >
                <FarmerIcon name={item.icon} className="h-6 w-6" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
