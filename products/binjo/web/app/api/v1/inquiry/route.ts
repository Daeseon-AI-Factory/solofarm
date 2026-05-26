import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const InquirySchema = z.object({
  channel: z.enum(["kakao", "phone", "naver"]),
  product_id: z.string().uuid().optional(),
  referrer: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InquirySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "잘못된 요청입니다" } },
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

    await prisma.orderInquiry.create({
      data: {
        farm_id: farm.id,
        channel: parsed.data.channel,
        product_id: parsed.data.product_id ?? null,
        referrer: parsed.data.referrer ?? req.headers.get("referer") ?? null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/v1/inquiry failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
