import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse } from "@/lib/auth";
import {
  ImageUploadValidationError,
  MAX_IMAGE_SIZE,
  uploadImage,
} from "@/lib/storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorizedResponse();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "NO_FILE", message: "파일을 선택해주세요" } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { code: "INVALID_TYPE", message: "JPG, PNG, WebP 사진만 업로드 가능합니다" } },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: { code: "TOO_LARGE", message: "10MB 이하의 파일만 업로드 가능합니다" } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImage(buffer, file.type);

    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ImageUploadValidationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 400 }
      );
    }

    const message = err instanceof Error ? err.message : "Unknown upload error";
    console.error("Upload error:", message);
    return NextResponse.json(
      {
        error: {
          code: "UPLOAD_FAILED",
          message: "업로드에 실패했습니다. 잠시 후 다시 시도해주세요",
        },
      },
      { status: 500 }
    );
  }
}
