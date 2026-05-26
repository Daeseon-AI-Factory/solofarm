import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Proxy /backend/* → FastAPI on port 8002 — eliminates CORS issues in dev
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "http://localhost:8002/:path*",
      },
    ];
  },
};

export default nextConfig;
