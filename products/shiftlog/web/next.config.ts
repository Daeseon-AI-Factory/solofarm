import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy /backend/* → FastAPI on 8091 — eliminates CORS hassle in dev.
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "http://127.0.0.1:8091/:path*",
      },
    ];
  },
};

export default nextConfig;
