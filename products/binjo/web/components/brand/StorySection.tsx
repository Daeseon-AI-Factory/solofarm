import Image from "next/image";
import { FarmProfile } from "@/types";

interface StorySectionProps {
  farm: FarmProfile;
}

export default function StorySection({ farm }: StorySectionProps) {
  const stats = farm.stats;
  const hasStats = Boolean(
    stats && (stats.area || stats.experience || stats.varieties)
  );

  // An empty CMS section reads like a broken template. Keep it out of the
  // public page until there is real story or farm data to present.
  if (!farm.story && !hasStats) return null;

  return (
    <section id="story" className="bg-[#FDFBF7] px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div
          className={
            farm.farmer_image_url
              ? "grid items-center gap-9 md:grid-cols-[0.9fr_1.1fr] md:gap-14"
              : "mx-auto max-w-3xl"
          }
        >
          {farm.farmer_image_url && (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-[#E8E2D5] shadow-sm">
              <Image
                src={farm.farmer_image_url}
                alt={`${farm.name} 농장주`}
                fill
                quality={80}
                sizes="(max-width: 767px) 100vw, 45vw"
                className="object-cover"
              />
            </div>
          )}

          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.16em] text-[#B9381B]">
              OUR STORY
            </p>
            <h2 className="mt-2 break-keep text-3xl font-bold tracking-[-0.04em] text-[#244C19] md:text-4xl">
              농장에서 직접 전하는 이야기
            </h2>
            <div
              className="mt-6 border-l-2 pl-5"
              style={{ borderColor: "#D9A25A", color: "#30342E" }}
            >
              {farm.story ? (
                farm.story.split("\n\n").map((paragraph, i) => (
                  <p key={i} className="mb-4 break-keep text-base leading-7 last:mb-0">
                    {paragraph}
                  </p>
                ))
              ) : null}
            </div>

            {hasStats && stats && (
              <div
                className="mt-8 grid grid-cols-3 gap-2 rounded-2xl bg-[#F3F0E9] p-4 md:gap-4 md:p-5"
              >
                {stats.area && (
                  <div className="text-center">
                    <p
                      className="break-keep text-xl font-bold md:text-2xl"
                      style={{ color: "#244C19" }}
                    >
                      {stats.area}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#66705F" }}>
                      재배 면적
                    </p>
                  </div>
                )}
                {stats.experience && (
                  <div className="text-center">
                    <p
                      className="break-keep text-xl font-bold md:text-2xl"
                      style={{ color: "#244C19" }}
                    >
                      {stats.experience}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#66705F" }}>
                      재배 경력
                    </p>
                  </div>
                )}
                {stats.varieties && (
                  <div className="text-center">
                    <p
                      className="break-keep text-xl font-bold md:text-2xl"
                      style={{ color: "#244C19" }}
                    >
                      {stats.varieties}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#66705F" }}>
                      주요 품종
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
