"use client";

import { useRef } from "react";
import type { ReviewItem } from "@/types";

interface ReviewsSectionProps {
  reviews: ReviewItem[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${rating}점 만점 후기`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="w-4 h-4"
          fill={star <= rating ? "#E8913A" : "#E5E2DB"}
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection({ reviews }: ReviewsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (reviews.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -300 : 300, behavior: "smooth" });
    }
  };

  return (
    <section className="bg-[#FDFBF7] py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-9 md:mb-12">
          <p className="mb-2 text-xs font-bold tracking-[0.16em] text-[#B9381B]">
            CUSTOMER NOTES
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-[#244C19] md:text-4xl">
            고객 후기
          </h2>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <button
          onClick={() => scroll("left")}
          type="button"
          aria-label="이전 후기"
          className="absolute left-2 top-1/2 z-10 hidden min-h-12 min-w-12 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-md md:flex"
          style={{ backgroundColor: "#FFFFFF", color: "#2D5016", border: "1px solid #E5E2DB" }}
        >
          ‹
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto px-4 md:px-16 pb-4 scrollbar-hide"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {reviews.map((review) => (
            <div
              key={review.id}
              className="w-[82vw] max-w-[340px] flex-shrink-0 rounded-[1.4rem] border p-6 shadow-sm md:w-80"
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#E5E2DB",
                scrollSnapAlign: "start",
              }}
            >
              <StarRating rating={review.rating} />
              <p
                className="mt-3 text-sm leading-relaxed italic"
                style={{ color: "#1A1A1A" }}
              >
                &ldquo;{review.content}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: "#4A7C2E" }}
                >
                  {review.customer_name?.charAt(0) ?? "고"}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                    {review.customer_name ?? "고객"}
                  </p>
                  {review.customer_location && (
                    <p className="text-xs" style={{ color: "#66705F" }}>
                      {review.customer_location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          type="button"
          aria-label="다음 후기"
          className="absolute right-2 top-1/2 z-10 hidden min-h-12 min-w-12 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-md md:flex"
          style={{ backgroundColor: "#FFFFFF", color: "#2D5016", border: "1px solid #E5E2DB" }}
        >
          ›
        </button>
      </div>
    </section>
  );
}
