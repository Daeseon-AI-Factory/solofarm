interface YoutubeSectionProps {
  youtubeUrl: string;
}

function getYouTubeEmbedId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function YoutubeSection({ youtubeUrl }: YoutubeSectionProps) {
  const videoId = getYouTubeEmbedId(youtubeUrl);
  if (!videoId) return null;

  return (
    <section className="py-16 md:py-24 px-4" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#2D5016" }}
          >
            농장 영상
          </h2>
          <div
            className="w-12 h-1 mx-auto rounded"
            style={{ backgroundColor: "#D4421E" }}
          />
        </div>

        <div className="relative w-full rounded-2xl overflow-hidden shadow-lg" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="빈조농장 영상"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
