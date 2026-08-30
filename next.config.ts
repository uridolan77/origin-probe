import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    // ORIGIN-G2-PUBLIC-PROBE-AUTH-001 public probe window binding
    NEXT_PUBLIC_ORIGIN_LIVE_ANALYTICS: "true",
    NEXT_PUBLIC_ORIGIN_EVENT_INGEST_URL: "https://ntfy.sh/origin-g2-b1d8a602337b4c0b818e476e91cb4c55",
    SITE_URL: "https://uridolan77.github.io/origin-probe",
  },
};

export default nextConfig;
