import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/farmer", "/backend", "/api/admin"],
      },
    ],
    sitemap: "https://solofarm.daeseon.ai/sitemap.xml",
  };
}
