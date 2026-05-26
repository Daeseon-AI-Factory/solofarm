import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

const AddPhotoSchema = z.object({
  image_url: z.string().url().max(500),
  caption: z.string().max(200).optional().nullable(),
  taken_at: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const body = await req.json();
    const parsed = AddPhotoSchema.safeParse(body);

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

    const photo = await prisma.galleryPhoto.create({
      data: {
        farm_id: farm.id,
        image_url: parsed.data.image_url,
        caption: parsed.data.caption ?? null,
        taken_at: parsed.data.taken_at ? new Date(parsed.data.taken_at) : null,
        sort_order: parsed.data.sort_order ?? 0,
      },
    });

    revalidatePath("/");
    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/gallery failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
