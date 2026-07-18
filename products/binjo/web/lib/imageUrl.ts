import { z } from "zod";

export const STORED_IMAGE_FILE_NAME_PATTERN =
  /^[a-f0-9]{32}\.(?:jpg|png|webp|gif)$/;

const LOCAL_IMAGE_URL_PATTERN =
  /^\/uploads\/[a-f0-9]{32}\.(?:jpg|png|webp|gif)$/;

export function isStoredLocalImageUrl(value: string): boolean {
  return LOCAL_IMAGE_URL_PATTERN.test(value);
}

export function isAllowedImageUrl(value: string): boolean {
  if (isStoredLocalImageUrl(value)) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hostname !== ""
    );
  } catch {
    return false;
  }
}

export const ImageUrlSchema = z
  .string()
  .max(500)
  .refine(isAllowedImageUrl, "지원하지 않는 이미지 URL입니다");
