import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
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

    return NextResponse.json(calendar);
  } catch (error) {
    console.error("GET /api/v1/calendar failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
