import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const availableOnly = searchParams.get("available") === "true";

    const products = await prisma.product.findMany({
      where: availableOnly ? { is_available: true } : undefined,
      select: {
        id: true,
        name: true,
        name_en: true,
        description: true,
        short_description: true,
        harvest_start_month: true,
        harvest_end_month: true,
        is_available: true,
        price_options: true,
        image_url: true,
        sort_order: true,
      },
      orderBy: { sort_order: "asc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/v1/products failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
