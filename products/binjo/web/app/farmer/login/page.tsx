"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getKakaoLoginUrl, loginWithKakao, isLoggedIn } from "@/lib/farmerApi";

const API_BASE =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_API_URL || "/backend")
    : "/backend";

const KAKAO_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_KAKAO_LOGIN === "true";
const TEST_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true";

/**
 * Kakao login page — one big yellow button.
 * After Kakao redirects back with a code, we exchange it for our JWT.
 * In dev mode, a "Dev Login" button bypasses Kakao OAuth for testing.
 */
function FarmerLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devLoading, setDevLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Already logged in — redirect to dashboard
    if (isLoggedIn()) {
      router.replace("/farmer/dashboard");
      return;
    }

    // Check for Kakao callback code
    const code = searchParams.get("code");
    if (code && KAKAO_LOGIN_ENABLED) {
      loginWithKakao(code)
        .then(() => router.replace("/farmer/dashboard"))
        .catch(() => setLoginError("카카오 로그인에 실패했습니다. 다시 시도해주세요."));
    }
  }, [router, searchParams]);

  const handleLogin = async () => {
    setKakaoLoading(true);
    setLoginError(null);
    try {
      const loginUrl = await getKakaoLoginUrl();
      window.location.href = loginUrl;
    } catch {
      setLoginError("카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
      setKakaoLoading(false);
    }
  };

  const handleDevLogin = async () => {
    if (!accessCode.trim()) {
      setLoginError("접근 코드를 입력해주세요.");
      return;
    }
    setDevLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: "빈조농장",
          access_code: accessCode,
        }),
      });
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "접근 코드를 확인해주세요."
            : res.status === 429
              ? "로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요."
            : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요."
        );
      }
      const data = await res.json();
      localStorage.setItem("farmer_token", data.access_token);
      router.replace("/farmer/dashboard");
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#FDFBF7" }}
    >
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-2" style={{ color: "#2D5016" }}>
          빈조농장
        </h1>
        <p className="text-sm" style={{ color: "#6B6B6B" }}>
          현장에서 빠르게 영농일지를 기록하세요
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {KAKAO_LOGIN_ENABLED && (
          <button
            onClick={handleLogin}
            disabled={kakaoLoading}
            className="w-full py-4 rounded-xl font-bold text-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#FEE500", color: "#000000", minHeight: "56px" }}
          >
            {kakaoLoading ? "연결 중..." : "카카오로 시작하기"}
          </button>
        )}

        {TEST_LOGIN_ENABLED && (
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E2DB" }}
          >
            <label
              htmlFor="farmer-access-code"
              className="block text-sm font-semibold mb-2"
              style={{ color: "#2D5016" }}
            >
              농장 접근 코드
            </label>
            <input
              id="farmer-access-code"
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !devLoading) void handleDevLogin();
              }}
              autoComplete="current-password"
              placeholder="접근 코드를 입력하세요"
              className="w-full rounded-xl px-4 py-3 text-base outline-none focus:ring-2"
              style={{
                minHeight: "52px",
                backgroundColor: "#F5F1EC",
                color: "#1A1A1A",
              }}
            />
            <button
              onClick={handleDevLogin}
              disabled={devLoading || !accessCode.trim()}
              className="w-full mt-3 py-4 rounded-xl text-base font-bold text-white transition-opacity active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#2D5016", minHeight: "56px" }}
            >
              {devLoading ? "로그인 중..." : "농장 관리 시작"}
            </button>
          </div>
        )}

        {!KAKAO_LOGIN_ENABLED && !TEST_LOGIN_ENABLED && (
          <div
            className="rounded-xl p-4 text-sm text-center"
            style={{ backgroundColor: "#FEF3E2", color: "#9A3412" }}
          >
            현재 사용할 수 있는 로그인 방식이 없습니다.
          </div>
        )}

        {loginError && (
          <div
            role="alert"
            className="rounded-xl p-3 text-sm"
            style={{ backgroundColor: "#FEF3E2", color: "#9A3412" }}
          >
            {loginError}
          </div>
        )}
      </div>

      <p className="text-xs mt-8 text-center max-w-xs" style={{ color: "#9B9B9B" }}>
        농장 기록은 승인된 사용자만 확인할 수 있습니다.
      </p>
    </div>
  );
}

export default function FarmerLoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center text-sm"
          style={{ backgroundColor: "#FDFBF7", color: "#2D5016" }}
        >
          로그인 화면을 불러오는 중...
        </div>
      }
    >
      <FarmerLoginPageContent />
    </Suspense>
  );
}
