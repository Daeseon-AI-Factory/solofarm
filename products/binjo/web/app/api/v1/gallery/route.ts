import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const photos = await prisma.galleryPhoto.findMany({
      select: {
        id: true,
        image_url: true,
        caption: true,
        taken_at: true,
        sort_order: true,
      },
      orderBy: { sort_order: "asc" },
    });

    return NextResponse.json(photos);
  } catch (error) {
    console.error("GET /api/v1/gallery failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "잠시 후 다시 시도해주세요" } },
      { status: 500 }
    );
  }
}
