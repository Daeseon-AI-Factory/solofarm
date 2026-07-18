import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));
const apiInternalUrl = (
  process.env.API_INTERNAL_URL || "http://localhost:8002"
).replace(/\/$/, "");
const remoteImagePatterns: NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> = [];

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol === "https:") {
      remoteImagePatterns.push({
        protocol: "https",
        hostname: parsed.hostname,
        pathname: "/storage/v1/object/public/**",
      });
    }
  }
} catch {
  // An invalid optional URL must not widen the optimizer allow-list.
}

const nextConfig: NextConfig = {
  // Multiple lockfiles exist above this product in some developer machines.
  // Pinning the root prevents Turbopack from resolving dependencies against a
  // guessed parent workspace while remaining portable across Windows and macOS.
  turbopack: {
    root: webRoot,
  },
  images: {
    remotePatterns: remoteImagePatterns,
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/farmer/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/farmer",
        destination: "/farmer/login",
        permanent: false,
      },
    ];
  },
  // Proxy /backend/* → FastAPI on port 8002 — eliminates CORS issues in dev
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
