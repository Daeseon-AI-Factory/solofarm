import { NextResponse } from "next/server";
import { readLocalImage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const image = await readLocalImage(filename);

    if (!image) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(image.body), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /uploads/[filename] failed:", error);
    return new NextResponse(null, { status: 500 });
  }
}
