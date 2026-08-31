import { afterEach, describe, expect, it, vi } from "vitest";
import { measurementApiBase } from "@/lib/measurement";

const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_ORIGIN_MEASUREMENT_API_URL;
const CANONICAL_HOST = "origin.onto\u0067ony.net";

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_API_URL === undefined) {
    delete process.env.NEXT_PUBLIC_ORIGIN_MEASUREMENT_API_URL;
  } else {
    process.env.NEXT_PUBLIC_ORIGIN_MEASUREMENT_API_URL = ORIGINAL_API_URL;
  }
});

describe("measurementApiBase", () => {
  it("uses the same-origin bridge on the canonical domain", () => {
    process.env.NEXT_PUBLIC_ORIGIN_MEASUREMENT_API_URL =
      "https://origin-probe-measure.vercel.app";
    vi.stubGlobal("window", {
      location: { hostname: CANONICAL_HOST },
    });

    expect(measurementApiBase()).toBe("/__measure");
  });

  it("uses the same-origin bridge on Vercel preview domains", () => {
    vi.stubGlobal("window", {
      location: { hostname: "origin-probe-abc.vercel.app" },
    });

    expect(measurementApiBase()).toBe("/__measure");
  });

  it("keeps the configured API on other hosts", () => {
    process.env.NEXT_PUBLIC_ORIGIN_MEASUREMENT_API_URL =
      "https://origin-probe-measure.vercel.app/";
    vi.stubGlobal("window", { location: { hostname: "localhost" } });

    expect(measurementApiBase()).toBe(
      "https://origin-probe-measure.vercel.app",
    );
  });
});
