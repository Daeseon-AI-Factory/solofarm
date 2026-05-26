import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

const UpdateCalendarSchema = z.object({
  activities: z.array(z.string()).optional(),
  available_products: z.array(z.string()).optional(),
  highlight: z.string().optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const { month: monthStr } = await params;
    const month = parseInt(monthStr, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "월은 1~12 사이여야 합니다" } },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = UpdateCalendarSchema.safeParse(body);

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

    const entry = await prisma.seasonalCalendar.upsert({
      where: { farm_id_month: { farm_id: farm.id, month } },
      update: parsed.data,
      create: {
        farm_id: farm.id,
        month,
        activities: parsed.data.activities ?? [],
        available_products: parsed.data.available_products ?? [],
        highlight: parsed.data.highlight ?? null,
      },
    });

    revalidatePath("/");
    return NextResponse.json(entry);
  } catch (error) {
    console.error("PUT /api/admin/calendar/[month] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
