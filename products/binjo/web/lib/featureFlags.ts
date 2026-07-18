/**
 * Browser-visible feature flags.
 *
 * Next.js embeds NEXT_PUBLIC_* values during `next build`, so deployment
 * manifests must pass the same source flag to both build args and runtime env.
 * Server layouts add a second, runtime-only gate for externally dependent
 * workflows such as payment and receipt OCR.
 */
export const DIRECT_CHECKOUT_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DIRECT_CHECKOUT === "true";

export const RECEIPT_OCR_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_RECEIPT_OCR === "true";

export const VOICE_RECORDING_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_VOICE === "true";

export const FARM_LOG_PHOTO_UPLOAD_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PHOTO_UPLOAD === "true";
