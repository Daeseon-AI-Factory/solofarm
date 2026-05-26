import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

const PriceOptionSchema = z.object({
  weight: z.string(),
  price: z.number().int().positive(),
});

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  name_en: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  short_description: z.string().max(200).optional().nullable(),
  harvest_start_month: z.number().int().min(1).max(12).optional().nullable(),
  harvest_end_month: z.number().int().min(1).max(12).optional().nullable(),
  is_available: z.boolean().optional(),
  price_options: z.array(PriceOptionSchema).optional().nullable(),
  image_url: z.string().url().max(500).optional().nullable(),
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
    const parsed = UpdateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "입력값을 확인해주세요" } },
        { status: 400 }
      );
    }

    const { price_options, ...rest } = parsed.data;
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...rest,
        price_options: price_options === null ? Prisma.JsonNull : price_options,
      },
    });

    revalidatePath("/");
    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT /api/admin/products/[id] failed:", error);
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
    await prisma.product.delete({ where: { id } });
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/products/[id] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
