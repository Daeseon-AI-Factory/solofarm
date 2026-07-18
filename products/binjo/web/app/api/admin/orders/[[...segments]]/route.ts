import { NextRequest, NextResponse } from "next/server";
import {
  getTokenFromRequest,
  requireAdmin,
  unauthorizedResponse,
} from "@/lib/auth";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://localhost:8002";

type RouteContext = {
  params: Promise<{ segments?: string[] }>;
};

async function proxyAdminOrderRequest(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  if (!(await requireAdmin(req))) {
    return unauthorizedResponse() as NextResponse;
  }

  const token = getTokenFromRequest(req);
  if (!token) return unauthorizedResponse() as NextResponse;

  const { segments = [] } = await context.params;
  const suffix = segments.length
    ? `/${segments.map(encodeURIComponent).join("/")}`
    : "";
  const target = `${API_INTERNAL_URL.replace(/\/$/, "")}/api/v1/admin/orders${suffix}${req.nextUrl.search}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(req.headers.get("content-type")
          ? { "Content-Type": req.headers.get("content-type")! }
          : {}),
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : await req.arrayBuffer(),
      cache: "no-store",
    });

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers.set("retry-after", retryAfter);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Admin order proxy failed:", error);
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "주문 서버에 연결할 수 없습니다",
        },
      },
      { status: 502 }
    );
  }
}

export const GET = proxyAdminOrderRequest;
export const POST = proxyAdminOrderRequest;
export const PUT = proxyAdminOrderRequest;
