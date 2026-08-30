const MAX_QUERY_PARAM_LENGTH = 128;

export function sanitizeQueryParam(value: string, max = MAX_QUERY_PARAM_LENGTH): string {
  return value.trim().slice(0, max).replace(/[^\w\-.:]/g, "");
}

export function buildShareUrl(slug: string, token: string, base?: string): string {
  const safeSlug = sanitizeQueryParam(slug, 80);
  const safeToken = sanitizeQueryParam(token, 64);
  const origin =
    base || (typeof window !== "undefined" ? window.location.origin : "") || "";
  if (!origin) {
    return `/g/${safeSlug}/?s=${encodeURIComponent(safeToken)}`;
  }
  const url = new URL(`/g/${safeSlug}/`, origin);
  url.searchParams.set("s", safeToken);
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
