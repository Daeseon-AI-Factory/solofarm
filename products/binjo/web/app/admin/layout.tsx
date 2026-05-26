"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "대시보드", icon: "🏠" },
  { href: "/admin/farm", label: "농장 정보", icon: "🌿" },
  { href: "/admin/products", label: "상품 관리", icon: "🍎" },
  { href: "/admin/orders", label: "주문 관리", icon: "📦" },
  { href: "/admin/gallery", label: "사진 갤러리", icon: "📷" },
  { href: "/admin/reviews", label: "고객 후기", icon: "⭐" },
  { href: "/admin/calendar", label: "제철 달력", icon: "📅" },
  { href: "/admin/layout-editor", label: "페이지 관리", icon: "🎨" },
  { href: "/admin/analytics", label: "방문 통계", icon: "📊" },
];

// First 4 items show in the bottom bar; the rest appear in the "More" popup
const MOBILE_MAIN_COUNT = 4;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check if already authenticated
    fetch("/api/admin/inquiries")
      .then((r) => {
        if (r.ok) setAuthed(true);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setAuthed(true);
    } else {
      const data = await res.json();
      setError(data.error?.message ?? "로그인 실패");
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFBF7" }}>
        <p style={{ color: "#9B9B9B" }}>확인 중...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold" style={{ color: "#2D5016" }}>
              빈조농장
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6B6B6B" }}>관리자 페이지</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 text-base"
              style={{ borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" }}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#2D5016" }}
            >
              {loading ? "확인 중..." : "로그인"}
            </button>
          </form>
          <button
            onClick={() => {
              setPassword("ㅇ");
              setTimeout(() => {
                const form = document.querySelector("form");
                if (form) form.requestSubmit();
              }, 50);
            }}
            className="w-full py-3 rounded-xl text-sm font-medium mt-3 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E5E2DB", color: "#6B6B6B" }}
          >
            🔧 Dev Login (테스트용)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F5F1EC" }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 hidden md:flex flex-col py-6"
        style={{ backgroundColor: "#2D5016" }}
      >
        <div className="px-4 mb-8">
          <h1 className="text-lg font-bold text-white">빈조농장</h1>
          <p className="text-xs text-white/50 mt-0.5">관리자</p>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                  color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 mt-4">
          <Link
            href="/"
            target="_blank"
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            브랜드 페이지 보기 →
          </Link>
        </div>
      </aside>

      {/* Mobile nav — 4 main tabs + "More" button */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t" style={{ backgroundColor: "#2D5016", borderColor: "#4A7C2E" }}>
        {/* "More" popup — slides up above the nav bar */}
        {moreOpen && (
          <>
            {/* Backdrop to close on tap outside */}
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div
              className="absolute bottom-full left-0 right-0 z-50 rounded-t-2xl shadow-lg p-4 grid grid-cols-4 gap-3"
              style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E5E2DB" }}
            >
              {NAV_ITEMS.slice(MOBILE_MAIN_COUNT).map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium"
                    style={{
                      backgroundColor: isActive ? "#EDF4E8" : "transparent",
                      color: isActive ? "#2D5016" : "#6B6B6B",
                    }}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <div className="flex">
          {NAV_ITEMS.slice(0, MOBILE_MAIN_COUNT).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="flex-1 flex flex-col items-center py-2 text-xs gap-1"
              style={{ color: pathname === item.href ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          {/* "More" tab — highlights when any hidden page is active */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex-1 flex flex-col items-center py-2 text-xs gap-1"
            style={{
              color: moreOpen || NAV_ITEMS.slice(MOBILE_MAIN_COUNT).some((item) => pathname === item.href)
                ? "#FFFFFF"
                : "rgba(255,255,255,0.5)",
            }}
          >
            <span className="text-lg">⋯</span>
            <span>더보기</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
