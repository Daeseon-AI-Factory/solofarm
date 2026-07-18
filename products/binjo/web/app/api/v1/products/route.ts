import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizePublicProductItems } from "@/lib/publicFarmProfile";
import type { ProductItem } from "@/types";

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

    const productItems = products.map((product) => ({
      ...product,
      price_options: product.price_options as ProductItem["price_options"],
    }));
    // The admin screen intentionally reuses this endpoint. Authenticated
    // editors need the raw draft catalog, while anonymous visitors see only
    // content that is no longer identical to the repository demo seed.
    const forcePublicView = req.nextUrl.searchParams.get("view") === "public";
    const canViewDraft = !forcePublicView && (await requireAdmin(req));
    const responseProducts = canViewDraft
      ? productItems
      : sanitizePublicProductItems(productItems);

    return NextResponse.json(responseProducts, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/v1/products failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
