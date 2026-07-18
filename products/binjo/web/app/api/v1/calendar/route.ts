import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizePublicCalendarMonths } from "@/lib/publicFarmProfile";

export async function GET(req: NextRequest) {
  try {
    const calendar = await prisma.seasonalCalendar.findMany({
      select: {
        id: true,
        month: true,
        activities: true,
        available_products: true,
        highlight: true,
      },
      orderBy: { month: "asc" },
    });

    const forcePublicView = req.nextUrl.searchParams.get("view") === "public";
    const canViewDraft = !forcePublicView && (await requireAdmin(req));
    const responseCalendar = canViewDraft
      ? calendar
      : sanitizePublicCalendarMonths(calendar);

    return NextResponse.json(responseCalendar, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/v1/calendar failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
