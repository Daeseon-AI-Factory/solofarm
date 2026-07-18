import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizePublicProductItems } from "@/lib/publicFarmProfile";
import type { ProductItem } from "@/types";

export async function GET(
  req: NextRequest,
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

    const productItem: ProductItem = {
      ...product,
      price_options: product.price_options as ProductItem["price_options"],
    };
    const forcePublicView = req.nextUrl.searchParams.get("view") === "public";
    const canViewDraft = !forcePublicView && (await requireAdmin(req));
    const responseProduct = canViewDraft
      ? productItem
      : sanitizePublicProductItems([productItem])[0];

    if (!responseProduct) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "상품을 찾을 수 없습니다" } },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(responseProduct, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/v1/products/[id] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
