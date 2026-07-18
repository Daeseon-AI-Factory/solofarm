import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sanitizePublicFarmProfile } from "@/lib/publicFarmProfile";
import type { FarmProfile } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const farm = await prisma.farm.findFirst({
      select: {
        id: true,
        name: true,
        name_en: true,
        tagline: true,
        story: true,
        phone: true,
        kakao_chat_url: true,
        naver_store_url: true,
        youtube_url: true,
        address: true,
        address_short: true,
        latitude: true,
        longitude: true,
        hero_image_url: true,
        farmer_image_url: true,
        stats: true,
      },
    });

    if (!farm) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "농장 정보를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    const farmProfile = {
      ...farm,
      latitude: farm.latitude ? Number(farm.latitude) : null,
      longitude: farm.longitude ? Number(farm.longitude) : null,
      stats: farm.stats as FarmProfile["stats"],
    };
    // The admin editor reuses this route and must be able to replace draft seed
    // values. Anonymous visitors receive the sanitized public projection.
    const forcePublicView = req.nextUrl.searchParams.get("view") === "public";
    const canViewDraft = !forcePublicView && (await requireAdmin(req));
    const responseFarm = canViewDraft
      ? farmProfile
      : sanitizePublicFarmProfile(farmProfile);

    return NextResponse.json(responseFarm, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/v1/farm failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
