import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
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
    });

    if (!product) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/v1/products/[id] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
