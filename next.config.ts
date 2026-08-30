import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/origin-probe",
  assetPrefix: "/origin-probe",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    // ORIGIN_G2_WINDOW_001 invalidated — do not emit to forgeable public sink.
    // G2R will bind NEXT_PUBLIC_ORIGIN_MEASUREMENT_API_URL to a trusted endpoint.
    NEXT_PUBLIC_ORIGIN_LIVE_ANALYTICS: "false",
    NEXT_PUBLIC_BASE_PATH: "/origin-probe",
    SITE_URL: "https://uridolan77.github.io/origin-probe",
  },
};

export default nextConfig;
