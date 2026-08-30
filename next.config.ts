import type { NextConfig } from "next";

const pagesBase = process.env.ORIGIN_PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  ...(pagesBase
    ? {
        basePath: pagesBase,
        assetPrefix: pagesBase,
      }
    : {}),
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    // ORIGIN_G2_WINDOW_001 invalidated — no forgeable public sink.
    NEXT_PUBLIC_ORIGIN_LIVE_ANALYTICS: "false",
    NEXT_PUBLIC_BASE_PATH: pagesBase,
    SITE_URL:
      process.env.SITE_URL ||
      (pagesBase
        ? "https://uridolan77.github.io/origin-probe"
        : "http://localhost:3000"),
  },
};

export default nextConfig;
