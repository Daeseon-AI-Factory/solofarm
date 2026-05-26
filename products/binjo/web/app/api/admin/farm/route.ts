import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

const UpdateFarmSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  name_en: z.string().max(100).optional().nullable(),
  tagline: z.string().optional().nullable(),
  story: z.string().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  kakao_chat_url: z.string().url().max(500).optional().nullable(),
  naver_store_url: z.string().url().max(500).optional().nullable(),
  youtube_url: z.string().url().max(500).optional().nullable(),
  address: z.string().optional().nullable(),
  address_short: z.string().max(100).optional().nullable(),
  hero_image_url: z.string().url().max(500).optional().nullable(),
  farmer_image_url: z.string().url().max(500).optional().nullable(),
  stats: z
    .object({
      area: z.string().optional(),
      experience: z.string().optional(),
      varieties: z.string().optional(),
    })
    .optional()
    .nullable(),
});

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const body = await req.json();
    const parsed = UpdateFarmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "입력값을 확인해주세요" } },
        { status: 400 }
      );
    }

    const farm = await prisma.farm.findFirst({ select: { id: true } });
    if (!farm) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "농장 정보를 찾을 수 없습니다" } },
        { status: 404 }
      );
    }

    const { stats, ...rest } = parsed.data;
    const updated = await prisma.farm.update({
      where: { id: farm.id },
      data: {
        ...rest,
        stats: stats === null ? Prisma.JsonNull : stats,
      },
    });

    revalidatePath("/");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/admin/farm failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
