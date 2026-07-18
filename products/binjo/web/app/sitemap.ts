import type { MetadataRoute } from "next";

const baseUrl = "https://solofarm.daeseon.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
