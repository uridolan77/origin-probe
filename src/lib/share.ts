const MAX_QUERY_PARAM_LENGTH = 128;

export const MAX_SIGNED_SHARE_TOKEN_LENGTH = 4096;

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

export function sanitizeQueryParam(value: string, max = MAX_QUERY_PARAM_LENGTH): string {
  return value.trim().slice(0, max).replace(/[^\w\-.:]/g, "");
}

/**
 * A measurement-grade share token is exactly two non-empty base64url segments.
 * Validate without normalizing so the signed bytes are preserved verbatim.
 */
export function isValidSignedShareToken(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_SIGNED_SHARE_TOKEN_LENGTH
  ) {
    return false;
  }

  const segments = value.split(".");
  return (
    segments.length === 2 &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment.length % 4 !== 1 &&
        BASE64URL_SEGMENT.test(segment),
    )
  );
}

export function buildShareUrl(slug: string, token: string, base?: string): string {
  const safeSlug = sanitizeQueryParam(slug, 80);
  if (!isValidSignedShareToken(token)) {
    throw new TypeError(
      `Share token must contain exactly two base64url segments and be at most ${MAX_SIGNED_SHARE_TOKEN_LENGTH} characters.`,
    );
  }
  const basePath =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH) || "";
  const origin =
    base || (typeof window !== "undefined" ? window.location.origin : "") || "";
  const path = `${basePath}/g/${safeSlug}/`;
  if (!origin) {
    return `${path}?s=${encodeURIComponent(token)}`;
  }
  const url = new URL(path, origin);
  url.searchParams.set("s", token);
  return url.toString();
}

export async function copyLink(url: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    if (typeof document === "undefined") return false;
    const el = document.createElement("textarea");
    el.value = url;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export async function nativeShare(opts: {
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(opts);
      return "shared";
    } catch {
      // user cancel or unsupported
    }
  }
  const copied = await copyLink(opts.url);
  return copied ? "copied" : "failed";
}
