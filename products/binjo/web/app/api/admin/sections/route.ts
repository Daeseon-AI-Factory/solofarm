import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

const SectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  visible: z.boolean(),
  bgColor: z.string().optional(),
  bgImage: z.string().optional(),
});

const UpdateSchema = z.object({
  sections: z.array(SectionSchema),
});

// GET — fetch current sections config
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const farm = await prisma.farm.findFirst({
    select: { sections_config: true },
  });

  return NextResponse.json({ sections_config: farm?.sections_config ?? null });
}

// PUT — update sections order and visibility
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "잘못된 요청입니다" } },
      { status: 400 }
    );
  }

  const farm = await prisma.farm.findFirst();
  if (!farm) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "농장 정보가 없습니다" } },
      { status: 404 }
    );
  }

  await prisma.farm.update({
    where: { id: farm.id },
    data: { sections_config: parsed.data.sections },
  });

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
