import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

const CreateReviewSchema = z.object({
  customer_name: z.string().max(50).optional().nullable(),
  customer_location: z.string().max(50).optional().nullable(),
  content: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const body = await req.json();
    const parsed = CreateReviewSchema.safeParse(body);

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

    const review = await prisma.review.create({
      data: { ...parsed.data, farm_id: farm.id },
    });

    revalidatePath("/");
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/reviews failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
