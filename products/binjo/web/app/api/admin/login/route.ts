import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signAdminToken } from "@/lib/auth";
import {
  adminCredentialsMatch,
  adminLoginClientKey,
  adminLoginFailureLimiter,
} from "@/lib/adminLoginSecurity";

const LoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const clientKey = adminLoginClientKey(req.headers, {
      trustProxyHeaders: process.env.ADMIN_LOGIN_TRUST_PROXY === "true",
      directAddress: (req as NextRequest & { ip?: string }).ip,
    });
    const rateLimit = adminLoginFailureLimiter.check(clientKey);
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: {
            code: "TOO_MANY_ATTEMPTS",
            message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요",
          },
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "아이디와 비밀번호를 입력해주세요" } },
        { status: 400 }
      );
    }

    const adminUsername = process.env.ADMIN_USERNAME?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminUsername || !adminPassword) {
      console.error("ADMIN_USERNAME or ADMIN_PASSWORD env var not set");
      return NextResponse.json(
        { error: { code: "SERVER_ERROR", message: "서버 설정 오류입니다" } },
        { status: 500 }
      );
    }

    if (!adminCredentialsMatch(parsed.data, {
      username: adminUsername,
      password: adminPassword,
    })) {
      adminLoginFailureLimiter.recordFailure(clientKey);
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "아이디 또는 비밀번호가 틀렸습니다" } },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const token = await signAdminToken();
    adminLoginFailureLimiter.clear(clientKey);

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("POST /api/admin/login failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
