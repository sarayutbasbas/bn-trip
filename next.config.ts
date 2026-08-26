import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/flags/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 375, 430, 640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [64, 96, 128, 160, 256],
    qualities: [70, 76, 82],
    localPatterns: [
      { pathname: "/**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
