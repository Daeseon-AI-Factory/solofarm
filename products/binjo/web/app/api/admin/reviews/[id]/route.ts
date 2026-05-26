import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

const UpdateReviewSchema = z.object({
  customer_name: z.string().max(50).optional().nullable(),
  customer_location: z.string().max(50).optional().nullable(),
  content: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "입력값을 확인해주세요" } },
        { status: 400 }
      );
    }

    const review = await prisma.review.update({
      where: { id },
      data: parsed.data,
    });

    revalidatePath("/");
    return NextResponse.json(review);
  } catch (error) {
    console.error("PUT /api/admin/reviews/[id] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const { id } = await params;
    await prisma.review.delete({ where: { id } });
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/reviews/[id] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
