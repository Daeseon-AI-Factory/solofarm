import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { STORED_IMAGE_FILE_NAME_PATTERN } from "@/lib/imageUrl";

const BUCKET = "images";

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const IMAGE_FORMATS = {
  "image/jpeg": {
    extension: "jpg",
    matches: (file: Buffer) =>
      file.length >= 3 &&
      file[0] === 0xff &&
      file[1] === 0xd8 &&
      file[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    matches: (file: Buffer) =>
      file.length >= 8 &&
      file.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ),
  },
  "image/webp": {
    extension: "webp",
    matches: (file: Buffer) =>
      file.length >= 12 &&
      file.subarray(0, 4).toString("ascii") === "RIFF" &&
      file.subarray(8, 12).toString("ascii") === "WEBP",
  },
  "image/gif": {
    extension: "gif",
    matches: (file: Buffer) => {
      const signature = file.subarray(0, 6).toString("ascii");
      return signature === "GIF87a" || signature === "GIF89a";
    },
  },
} as const;

export type AllowedImageType = keyof typeof IMAGE_FORMATS;
type UploadImageType = Exclude<AllowedImageType, "image/gif">;
type StorageProvider = "local" | "supabase";

export class ImageUploadValidationError extends Error {
  constructor(
    public readonly code: "EMPTY_FILE" | "INVALID_TYPE" | "TOO_LARGE",
    message: string
  ) {
    super(message);
    this.name = "ImageUploadValidationError";
  }
}

function isAllowedUploadImageType(
  contentType: string
): contentType is UploadImageType {
  return (
    contentType !== "image/gif" && Object.hasOwn(IMAGE_FORMATS, contentType)
  );
}

function getStorageProvider(): StorageProvider {
  const configured = process.env.IMAGE_STORAGE_PROVIDER?.trim().toLowerCase();

  if (!configured || configured === "local") return "local";
  if (configured === "supabase") return "supabase";

  throw new Error(
    `Unsupported IMAGE_STORAGE_PROVIDER: ${configured}. Use "local" or "supabase".`
  );
}

export function getLocalUploadDir(): string {
  const configured = process.env.LOCAL_UPLOAD_DIR?.trim();
  return resolve(
    configured ||
      join(/* turbopackIgnore: true */ process.cwd(), ".data", "uploads")
  );
}

export function validateImageUpload(
  file: Buffer,
  contentType: string
): UploadImageType {
  if (file.length === 0) {
    throw new ImageUploadValidationError(
      "EMPTY_FILE",
      "빈 파일은 업로드할 수 없습니다"
    );
  }

  if (file.length > MAX_IMAGE_SIZE) {
    throw new ImageUploadValidationError(
      "TOO_LARGE",
      "10MB 이하의 파일만 업로드 가능합니다"
    );
  }

  if (
    !isAllowedUploadImageType(contentType) ||
    !IMAGE_FORMATS[contentType].matches(file)
  ) {
    throw new ImageUploadValidationError(
      "INVALID_TYPE",
      "실제 JPG, PNG, WebP 사진만 업로드 가능합니다"
    );
  }

  return contentType;
}

function createStoredFileName(contentType: AllowedImageType): string {
  const extension = IMAGE_FORMATS[contentType].extension;
  return `${randomBytes(16).toString("hex")}.${extension}`;
}

async function uploadLocalImage(
  file: Buffer,
  contentType: AllowedImageType
): Promise<string> {
  const uploadDir = getLocalUploadDir();
  await mkdir(uploadDir, { recursive: true, mode: 0o750 });

  const storedFileName = createStoredFileName(contentType);
  const finalPath = join(uploadDir, storedFileName);
  const temporaryPath = join(
    uploadDir,
    `.${storedFileName}.${randomBytes(8).toString("hex")}.tmp`
  );

  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporaryPath, "wx", 0o640);
    await handle.writeFile(file);
    await handle.sync();
    await handle.close();
    handle = undefined;

    // Both paths are inside the same directory, so rename is atomic on the
    // local Docker volume and avoids exposing partially-written images.
    await rename(temporaryPath, finalPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return `/uploads/${storedFileName}`;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function uploadSupabaseImage(
  file: Buffer,
  contentType: AllowedImageType
): Promise<string> {
  const supabase = getSupabaseClient();
  const storedFileName = createStoredFileName(contentType);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storedFileName, new Uint8Array(file), {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(storedFileName).data.publicUrl;
}

export async function uploadImage(
  file: Buffer,
  contentType: string
): Promise<string> {
  const validatedType = validateImageUpload(file, contentType);

  if (getStorageProvider() === "supabase") {
    return uploadSupabaseImage(file, validatedType);
  }

  return uploadLocalImage(file, validatedType);
}

export type StoredLocalImage = {
  body: Buffer;
  contentType: AllowedImageType;
};

export async function readLocalImage(
  storedFileName: string
): Promise<StoredLocalImage | null> {
  if (!STORED_IMAGE_FILE_NAME_PATTERN.test(storedFileName)) return null;

  const uploadDir = getLocalUploadDir();
  const filePath = resolve(uploadDir, storedFileName);

  // The strict filename pattern already excludes separators. Keep the parent
  // check as a second boundary in case the pattern changes later.
  if (dirname(filePath) !== uploadDir) return null;

  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile() || metadata.size === 0 || metadata.size > MAX_IMAGE_SIZE) {
      return null;
    }

    const extension = extname(storedFileName).slice(1);
    const contentType = (
      Object.entries(IMAGE_FORMATS) as Array<
        [AllowedImageType, (typeof IMAGE_FORMATS)[AllowedImageType]]
      >
    ).find(([, format]) => format.extension === extension)?.[0];

    if (!contentType) return null;

    const body = await readFile(filePath);
    if (!IMAGE_FORMATS[contentType].matches(body)) return null;

    return { body, contentType };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
