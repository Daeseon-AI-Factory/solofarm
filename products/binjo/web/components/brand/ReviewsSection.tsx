"use client";

import { useRef } from "react";
import { ReviewItem } from "@/types";

interface ReviewsSectionProps {
  reviews: ReviewItem[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="w-4 h-4"
          fill={star <= rating ? "#E8913A" : "#E5E2DB"}
          viewBox="0 0 20 20"
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
    <section className="py-16 md:py-24" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#2D5016" }}
          >
            고객 후기
          </h2>
          <div
            className="w-12 h-1 mx-auto rounded"
            style={{ backgroundColor: "#D4421E" }}
          />
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full shadow-md flex items-center justify-center text-lg hidden md:flex"
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
              className="flex-shrink-0 w-72 md:w-80 rounded-2xl p-6 shadow-sm border"
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
                "{review.content}"
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
                    <p className="text-xs" style={{ color: "#9B9B9B" }}>
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
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full shadow-md items-center justify-center text-lg hidden md:flex"
          style={{ backgroundColor: "#FFFFFF", color: "#2D5016", border: "1px solid #E5E2DB" }}
        >
          ›
        </button>
      </div>
    </section>
  );
}
