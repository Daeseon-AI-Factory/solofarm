import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isAllowedImageUrl } from "../lib/imageUrl";
import {
  ImageUploadValidationError,
  MAX_IMAGE_SIZE,
  readLocalImage,
  uploadImage,
  validateImageUpload,
} from "../lib/storage";

const IMAGE_FIXTURES = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
  "image/png": Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]),
  "image/webp": Buffer.from("RIFF\x00\x00\x00\x00WEBP", "binary"),
  "image/gif": Buffer.from("GIF89a", "ascii"),
} as const;

test("image validation accepts matching static image signatures", () => {
  for (const [contentType, body] of Object.entries(IMAGE_FIXTURES).filter(
    ([contentType]) => contentType !== "image/gif"
  )) {
    assert.equal(validateImageUpload(body, contentType), contentType);
  }

  assert.throws(
    () => validateImageUpload(IMAGE_FIXTURES["image/gif"], "image/gif"),
    (error) =>
      error instanceof ImageUploadValidationError &&
      error.code === "INVALID_TYPE"
  );

  assert.throws(
    () => validateImageUpload(IMAGE_FIXTURES["image/png"], "image/jpeg"),
    (error) =>
      error instanceof ImageUploadValidationError &&
      error.code === "INVALID_TYPE"
  );
  assert.throws(
    () => validateImageUpload(Buffer.alloc(0), "image/png"),
    (error) =>
      error instanceof ImageUploadValidationError && error.code === "EMPTY_FILE"
  );
  assert.throws(
    () => validateImageUpload(Buffer.alloc(MAX_IMAGE_SIZE + 1), "image/png"),
    (error) =>
      error instanceof ImageUploadValidationError && error.code === "TOO_LARGE"
  );
});

test("image URLs allow generated local paths and safe HTTPS URLs", () => {
  assert.equal(
    isAllowedImageUrl(`/uploads/${"a".repeat(32)}.webp`),
    true
  );
  assert.equal(isAllowedImageUrl("https://cdn.example.com/photo.jpg"), true);
  assert.equal(isAllowedImageUrl("http://cdn.example.com/photo.jpg"), false);
  assert.equal(isAllowedImageUrl("../uploads/photo.jpg"), false);
  assert.equal(isAllowedImageUrl("/uploads/../../secret.png"), false);
  assert.equal(isAllowedImageUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedImageUrl("https://user:pass@example.com/photo.jpg"), false);
});

test("local uploads use random safe names and are readable by URL filename", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "binjo-uploads-"));
  const originalProvider = process.env.IMAGE_STORAGE_PROVIDER;
  const originalUploadDir = process.env.LOCAL_UPLOAD_DIR;

  process.env.IMAGE_STORAGE_PROVIDER = "local";
  process.env.LOCAL_UPLOAD_DIR = uploadDir;

  try {
    const body = IMAGE_FIXTURES["image/png"];
    const firstUrl = await uploadImage(body, "image/png");
    const secondUrl = await uploadImage(body, "image/png");

    assert.match(firstUrl, /^\/uploads\/[a-f0-9]{32}\.png$/);
    assert.match(secondUrl, /^\/uploads\/[a-f0-9]{32}\.png$/);
    assert.notEqual(firstUrl, secondUrl);

    const storedFileName = firstUrl.slice("/uploads/".length);
    const stored = await readLocalImage(storedFileName);
    assert.equal(stored?.contentType, "image/png");
    assert.deepEqual(stored?.body, body);

    assert.equal(await readLocalImage("../secret.png"), null);
    assert.equal(await readLocalImage("not-a-generated-name.png"), null);

    const files = await readdir(uploadDir);
    assert.equal(files.length, 2);
    assert.equal(files.some((file) => file.endsWith(".tmp")), false);
  } finally {
    if (originalProvider === undefined) {
      delete process.env.IMAGE_STORAGE_PROVIDER;
    } else {
      process.env.IMAGE_STORAGE_PROVIDER = originalProvider;
    }

    if (originalUploadDir === undefined) {
      delete process.env.LOCAL_UPLOAD_DIR;
    } else {
      process.env.LOCAL_UPLOAD_DIR = originalUploadDir;
    }

    await rm(uploadDir, { recursive: true, force: true });
  }
});
