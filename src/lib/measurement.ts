/**
 * Trusted measurement client (G2R).
 * Talks only to the measurement API. Never submits qualified_* events.
 * Never posts to public forgeable sinks.
 */

import { getOrCreateClientId } from "@/lib/events";

const CANONICAL_HOST = "origin.onto\u0067ony.net";

function usesSameOriginMeasurementBridge(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === CANONICAL_HOST || hostname.endsWith(".vercel.app");
}

export function measurementApiBase(): string {
  if (usesSameOriginMeasurementBridge()) return "/__measure";
  if (typeof process === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ORIGIN_MEASUREMENT_API_URL || "").replace(
    /\/$/,
    "",
  );
}

export function measurementEnabled(): boolean {
  return measurementApiBase().length > 0;
}

async function post(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const base = measurementApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Origin-Client-Raw": getOrCreateClientId(),
      },
      body: JSON.stringify(body),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function reportResultView(slug: string): Promise<void> {
  await post("/v1/result-view", { slug });
}

export async function createSignedShare(
  slug: string,
  seed = false,
): Promise<string | null> {
  const data = await post("/v1/create-share", { slug, seed });
  if (!data || typeof data.token !== "string") return null;
  return data.token;
}

export async function reportShareArrival(
  slug: string,
  token: string,
): Promise<void> {
  await post("/v1/share-arrival", { slug, token });
}
