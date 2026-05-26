"use client";

import { useState } from "react";
import { GalleryPhotoItem } from "@/types";

interface GallerySectionProps {
  photos: GalleryPhotoItem[];
}

export default function GallerySection({ photos }: GallerySectionProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const closeLightbox = () => setLightboxIdx(null);
  const prevPhoto = () =>
    setLightboxIdx((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null));
  const nextPhoto = () =>
    setLightboxIdx((i) => (i !== null ? (i + 1) % photos.length : null));

  return (
    <section className="py-16 md:py-24 px-4" style={{ backgroundColor: "#F5F1EC" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#2D5016" }}
          >
            농장 풍경
          </h2>
          <div
            className="w-12 h-1 mx-auto rounded"
            style={{ backgroundColor: "#D4421E" }}
          />
        </div>

        <div className="columns-2 md:columns-3 gap-3 space-y-3">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="break-inside-avoid cursor-pointer overflow-hidden rounded-xl"
              onClick={() => setLightboxIdx(idx)}
            >
              <img
                src={photo.image_url}
                alt={photo.caption ?? "농장 사진"}
                className="w-full object-cover hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            onClick={closeLightbox}
          >
            ×
          </button>
          <button
            className="absolute left-4 text-white text-4xl leading-none px-2"
            onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
          >
            ‹
          </button>
          <img
            src={photos[lightboxIdx].image_url}
            alt={photos[lightboxIdx].caption ?? "농장 사진"}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute right-4 text-white text-4xl leading-none px-2"
            onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
          >
            ›
          </button>
          {photos[lightboxIdx].caption && (
            <p className="absolute bottom-6 text-white text-sm opacity-80">
              {photos[lightboxIdx].caption}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
