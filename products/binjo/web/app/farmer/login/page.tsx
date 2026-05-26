"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getKakaoLoginUrl, loginWithKakao, isLoggedIn } from "@/lib/farmerApi";

const API_BASE =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002")
    : "/backend";

/**
 * Kakao login page — one big yellow button.
 * After Kakao redirects back with a code, we exchange it for our JWT.
 * In dev mode, a "Dev Login" button bypasses Kakao OAuth for testing.
 */
export default function FarmerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devLoading, setDevLoading] = useState(false);

  useEffect(() => {
    // Already logged in — redirect to dashboard
    if (isLoggedIn()) {
      router.replace("/farmer/dashboard");
      return;
    }

    // Check for Kakao callback code
    const code = searchParams.get("code");
    if (code) {
      loginWithKakao(code)
        .then(() => router.replace("/farmer/dashboard"))
        .catch(() => alert("로그인에 실패했습니다. 다시 시도해주세요."));
    }
  }, [router, searchParams]);

  const handleLogin = async () => {
    try {
      const loginUrl = await getKakaoLoginUrl();
      window.location.href = loginUrl;
    } catch {
      alert("로그인 URL을 가져올 수 없습니다.");
    }
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "Test Farmer" }),
      });
      if (!res.ok) throw new Error("Dev login failed");
      const data = await res.json();
      localStorage.setItem("farmer_token", data.access_token);
      router.replace("/farmer/dashboard");
    } catch {
      alert("Dev login 실패 — 백엔드가 실행 중인지 확인하세요.");
    }
    setDevLoading(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#FDFBF7" }}
    >
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2" style={{ color: "#2D5016" }}>
          빈조농장
        </h1>
        <p className="text-sm" style={{ color: "#6B6B6B" }}>
          음성으로 간편하게 영농일지를 기록하세요
        </p>
      </div>

      <button
        onClick={handleLogin}
        className="w-full max-w-sm py-4 rounded-xl font-bold text-lg transition-opacity hover:opacity-90 active:scale-98"
        style={{ backgroundColor: "#FEE500", color: "#000000" }}
      >
        카카오로 시작하기
      </button>

      {/* Dev login — only for local testing, bypasses Kakao OAuth */}
      <button
        onClick={handleDevLogin}
        disabled={devLoading}
        className="w-full max-w-sm py-3 rounded-xl text-sm font-medium mt-3 transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "#E5E2DB", color: "#6B6B6B" }}
      >
        {devLoading ? "로그인 중..." : "🔧 Dev Login (테스트용)"}
      </button>

      <p className="text-xs mt-8 text-center max-w-xs" style={{ color: "#9B9B9B" }}>
        카카오 계정으로 간편하게 로그인하세요.
        <br />
        별도의 회원가입이 필요 없습니다.
      </p>
    </div>
  );
}
