import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: { is_visible: true },
      select: {
        id: true,
        customer_name: true,
        customer_location: true,
        content: true,
        rating: true,
        sort_order: true,
      },
      orderBy: { sort_order: "asc" },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("GET /api/v1/reviews failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
