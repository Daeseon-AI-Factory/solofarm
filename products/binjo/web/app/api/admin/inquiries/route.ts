import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const inquiries = await prisma.orderInquiry.findMany({
      where: { created_at: { gte: since } },
      include: { product: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    });

    // Aggregate by channel
    const byChannel = inquiries.reduce(
      (acc, i) => {
        acc[i.channel] = (acc[i.channel] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      total: inquiries.length,
      by_channel: byChannel,
      recent: inquiries.slice(0, 20).map((i) => ({
        id: i.id,
        channel: i.channel,
        product_name: i.product?.name ?? null,
        created_at: i.created_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/inquiries failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
