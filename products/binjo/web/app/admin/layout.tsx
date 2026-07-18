"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon from "@/components/admin/AdminIcon";
import AdminNotice from "@/components/admin/AdminNotice";
import {
  ADMIN_NAV_ITEMS,
  adminNavKeyForPath,
} from "@/lib/adminNavigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const pathname = usePathname();
  const activeKey = adminNavKeyForPath(pathname);

  const checkSession = useCallback(async () => {
    setChecking(true);
    setSessionError("");
    try {
      const response = await fetch("/api/admin/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.ok) {
        setAuthed(true);
      } else if (response.status === 401) {
        setAuthed(false);
      } else {
        throw new Error(`로그인 상태 확인 실패 (HTTP ${response.status})`);
      }
    } catch (sessionCheckError) {
      setSessionError(
        sessionCheckError instanceof Error
          ? sessionCheckError.message
          : "로그인 상태를 확인하지 못했습니다"
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const handleLogout = async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("로그아웃 요청에 실패했습니다");
      setAuthed(false);
      setPassword("");
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "로그아웃하지 못했습니다"
      );
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        setAuthed(true);
        setPassword("");
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.error?.message ?? "로그인 실패");
      }
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#F8F5EF", color: "#66705F" }}
      >
        <p className="text-sm font-medium">관리자 화면을 준비하고 있습니다...</p>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ backgroundColor: "#F8F5EF" }}
      >
        <div className="w-full max-w-md">
          <AdminNotice
            tone="error"
            title="로그인 상태를 확인하지 못했습니다"
            action={
              <button
                type="button"
                onClick={() => void checkSession()}
                className="min-h-12 rounded-xl border px-4 text-sm font-bold"
                style={{ borderColor: "#C9806E", backgroundColor: "#FFFFFF" }}
              >
                다시 시도
              </button>
            }
          >
            {sessionError}
          </AdminNotice>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4 py-10"
        style={{ backgroundColor: "#F8F5EF" }}
      >
        <div className="w-full max-w-sm rounded-3xl border bg-white p-6 shadow-sm sm:p-8" style={{ borderColor: "#E2DDD3" }}>
          <div className="mb-7">
            <p className="text-xs font-bold tracking-[0.16em]" style={{ color: "#9A541B" }}>
              BINJO FARM
            </p>
            <h1 className="mt-2 text-2xl font-bold" style={{ color: "#1F3D12" }}>
              농장 운영 관리
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#66705F" }}>
              주문과 홈페이지를 관리하려면 로그인하세요.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-sm font-semibold" style={{ color: "#34422F" }}>
              아이디
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1 min-h-13 w-full rounded-xl border px-4 text-base outline-none focus:ring-2 focus:ring-[#2D5016]/25"
                style={{ borderColor: "#D8D4CB", backgroundColor: "#FFFFFF" }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
            </label>
            <label className="block text-sm font-semibold" style={{ color: "#34422F" }}>
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 min-h-13 w-full rounded-xl border px-4 text-base outline-none focus:ring-2 focus:ring-[#2D5016]/25"
                style={{ borderColor: "#D8D4CB", backgroundColor: "#FFFFFF" }}
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-medium" style={{ color: "#A63218" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="min-h-14 w-full rounded-xl px-5 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: "#2D5016" }}
            >
              {loading ? "확인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#F7F4EE" }}>
      <aside
        className="hidden w-60 flex-shrink-0 flex-col border-r px-4 py-6 md:flex"
        style={{ backgroundColor: "#203A17", borderColor: "#36502D" }}
      >
        <div className="px-2">
          <p className="text-xs font-bold tracking-[0.16em] text-white/55">BINJO FARM</p>
          <h1 className="mt-1 text-xl font-bold text-white">농장 운영</h1>
        </div>

        <nav className="mt-8 flex-1 space-y-2" aria-label="관리자 주요 메뉴">
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="flex min-h-13 items-center gap-3 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{
                  backgroundColor: isActive ? "#FFFFFF" : "transparent",
                  color: isActive ? "#203A17" : "rgba(255,255,255,0.72)",
                }}
              >
                <AdminIcon name={item.key} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
          <Link
            href="/"
            target="_blank"
            className="flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
          >
            고객 페이지 보기 ↗
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="min-h-12 w-full rounded-xl px-3 text-left text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white"
          >
            로그아웃
          </button>
          {error && <p className="px-3 text-xs text-[#FFD7CF]">{error}</p>}
        </div>
      </aside>

      <main
        className="min-w-0 flex-1 overflow-auto md:pb-0"
        style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t md:hidden"
        aria-label="관리자 주요 메뉴"
        style={{
          backgroundColor: "#203A17",
          borderColor: "#36502D",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="flex min-h-18 flex-col items-center justify-center gap-1 px-1 text-xs font-bold focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-white"
              style={{ color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}
            >
              <AdminIcon name={item.key} />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
