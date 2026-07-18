import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "change-me-in-production"
);

function getAdminFarmerId(): string | null {
  const value = process.env.ADMIN_FARMER_ID?.trim();
  return value || null;
}

export async function signAdminToken(): Promise<string> {
  const farmerId = getAdminFarmerId();
  if (!farmerId) {
    throw new Error("ADMIN_FARMER_ID is not configured");
  }

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(farmerId)
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyAdminToken(
  token: string
): Promise<boolean> {
  try {
    const farmerId = getAdminFarmerId();
    if (!farmerId) return false;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.role === "admin" && payload.sub === farmerId;
  } catch {
    return false;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookie = req.cookies.get("admin_token");
  return cookie?.value ?? null;
}

export async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  return verifyAdminToken(token);
}

export function unauthorizedResponse() {
  return Response.json(
    { error: { code: "UNAUTHORIZED", message: "인증이 필요합니다" } },
    { status: 401 }
  );
}
