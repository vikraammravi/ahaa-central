import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local only: lets the platform surface run beside the business surface
  // (each `next dev` holds a lock in its own build folder). Defaults to .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
