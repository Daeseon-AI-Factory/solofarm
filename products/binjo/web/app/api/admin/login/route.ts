import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signAdminToken } from "@/lib/auth";

const LoginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "비밀번호를 입력해주세요" } },
        { status: 400 }
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("ADMIN_PASSWORD env var not set");
      return NextResponse.json(
        { error: { code: "SERVER_ERROR", message: "서버 설정 오류입니다" } },
        { status: 500 }
      );
    }

    if (parsed.data.password !== adminPassword) {
      return NextResponse.json(
        { error: { code: "WRONG_PASSWORD", message: "비밀번호가 틀렸습니다" } },
        { status: 401 }
      );
    }

    const token = await signAdminToken();

    const response = NextResponse.json({ ok: true });
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
