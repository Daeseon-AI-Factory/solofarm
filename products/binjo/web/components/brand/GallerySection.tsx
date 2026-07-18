"use client";

import { useEffect, useState } from "react";
import type { GalleryPhotoItem } from "@/types";

interface GallerySectionProps {
  photos: GalleryPhotoItem[];
}

export default function GallerySection({ photos }: GallerySectionProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const closeLightbox = () => setLightboxIdx(null);
  const prevPhoto = () =>
    setLightboxIdx((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null));
  const nextPhoto = () =>
    setLightboxIdx((i) => (i !== null ? (i + 1) % photos.length : null));

  useEffect(() => {
    if (lightboxIdx === null) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIdx(null);
      if (event.key === "ArrowLeft") {
        setLightboxIdx((index) =>
          index !== null ? (index - 1 + photos.length) % photos.length : null
        );
      }
      if (event.key === "ArrowRight") {
        setLightboxIdx((index) =>
          index !== null ? (index + 1) % photos.length : null
        );
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIdx, photos.length]);

  if (photos.length === 0) return null;

  return (
    <section className="bg-[#F3F0E9] px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-9 md:mb-12">
          <p className="mb-2 text-xs font-bold tracking-[0.16em] text-[#B9381B]">
            FROM THE ORCHARD
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-[#244C19] md:text-4xl">
            농장 풍경
          </h2>
        </div>

        <div className="columns-2 md:columns-3 gap-3 space-y-3">
          {photos.map((photo, idx) => (
            <button
              type="button"
              key={photo.id}
              className="block w-full break-inside-avoid overflow-hidden rounded-2xl text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D9A25A]"
              onClick={() => setLightboxIdx(idx)}
              aria-label={`${photo.caption ?? "농장 사진"} 크게 보기`}
            >
              <img
                src={photo.image_url}
                alt={photo.caption ?? "농장 사진"}
                className="w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="농장 사진 크게 보기"
        >
          <button
            type="button"
            className="absolute right-3 top-3 flex min-h-12 min-w-12 items-center justify-center rounded-full bg-black/35 text-3xl leading-none text-white"
            onClick={closeLightbox}
            aria-label="사진 닫기"
          >
            ×
          </button>
          <button
            type="button"
            className="absolute left-2 flex min-h-12 min-w-12 items-center justify-center rounded-full bg-black/35 px-2 text-4xl leading-none text-white"
            onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
            aria-label="이전 사진"
          >
            ‹
          </button>
          <img
            src={photos[lightboxIdx].image_url}
            alt={photos[lightboxIdx].caption ?? "농장 사진"}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            decoding="async"
          />
          <button
            type="button"
            className="absolute right-2 flex min-h-12 min-w-12 items-center justify-center rounded-full bg-black/35 px-2 text-4xl leading-none text-white"
            onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
            aria-label="다음 사진"
          >
            ›
          </button>
          {photos[lightboxIdx].caption && (
            <p className="absolute bottom-6 max-w-[80vw] rounded-full bg-black/45 px-4 py-2 text-center text-sm text-white/85">
              {photos[lightboxIdx].caption}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
