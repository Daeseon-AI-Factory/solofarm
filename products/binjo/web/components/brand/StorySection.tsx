import { FarmProfile } from "@/types";

interface StorySectionProps {
  farm: FarmProfile;
}

export default function StorySection({ farm }: StorySectionProps) {
  const stats = farm.stats;

  return (
    <section className="py-16 md:py-24 px-4" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#2D5016" }}
          >
            농장 이야기
          </h2>
          <div
            className="w-12 h-1 mx-auto rounded"
            style={{ backgroundColor: "#D4421E" }}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="flex justify-center">
            {farm.farmer_image_url ? (
              <img
                src={farm.farmer_image_url}
                alt="농장주"
                className="w-72 h-80 object-cover rounded-2xl shadow-lg"
                loading="lazy"
              />
            ) : (
              <div
                className="w-72 h-80 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "#E5E2DB" }}
              >
                <span style={{ color: "#9B9B9B" }} className="text-sm">
                  농장주 사진
                </span>
              </div>
            )}
          </div>

          <div>
            <div
              className="prose prose-lg"
              style={{ color: "#1A1A1A" }}
            >
              {farm.story ? (
                farm.story.split("\n\n").map((paragraph, i) => (
                  <p key={i} className="mb-4 leading-relaxed text-base">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-gray-400">농장 이야기를 준비 중입니다.</p>
              )}
            </div>

            {stats && (
              <div
                className="mt-8 grid grid-cols-3 gap-4 pt-6"
                style={{ borderTop: "1px solid #E5E2DB" }}
              >
                {stats.area && (
                  <div className="text-center">
                    <p
                      className="text-2xl font-bold"
                      style={{ color: "#2D5016" }}
                    >
                      {stats.area}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#6B6B6B" }}>
                      재배 면적
                    </p>
                  </div>
                )}
                {stats.experience && (
                  <div className="text-center">
                    <p
                      className="text-2xl font-bold"
                      style={{ color: "#2D5016" }}
                    >
                      {stats.experience}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#6B6B6B" }}>
                      재배 경력
                    </p>
                  </div>
                )}
                {stats.varieties && (
                  <div className="text-center">
                    <p
                      className="text-2xl font-bold"
                      style={{ color: "#2D5016" }}
                    >
                      {stats.varieties}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#6B6B6B" }}>
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
