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
    <section className="bg-[#FDFBF7] px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-9 md:mb-12">
          <p className="mb-2 text-xs font-bold tracking-[0.16em] text-[#B9381B]">
            FARM VIDEO
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-[#244C19] md:text-4xl">
            농장 영상
          </h2>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-[1.5rem] bg-[#17370F] shadow-lg">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title="빈조농장 영상"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}
