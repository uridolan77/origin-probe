"use client";

import { useEffect, useRef, useState } from "react";
import {
  createSignedShare,
  measurementEnabled,
  reportShareArrival,
} from "@/lib/measurement";
import {
  buildShareUrl,
  copyLink,
  isValidSignedShareToken,
  nativeShare,
} from "@/lib/share";

type Props = {
  slug: string;
  phrase: string;
};

const reportedInboundArrivals = new Set<string>();
const outboundShares = new Map<
  string,
  { token?: string; pending?: Promise<string | null> }
>();

function consumeInboundArrival(token: string): boolean {
  if (reportedInboundArrivals.has(token)) return false;
  reportedInboundArrivals.add(token);
  return true;
}

async function mintOutboundToken(slug: string): Promise<string | null> {
  const cached = outboundShares.get(slug);
  if (cached?.token) return cached.token;
  if (cached?.pending) return cached.pending;

  const pending = createSignedShare(slug, false).then((token) => {
    const active = outboundShares.get(slug);
    if (!isValidSignedShareToken(token)) {
      if (active?.pending === pending) outboundShares.delete(slug);
      return null;
    }
    if (active?.pending === pending) outboundShares.set(slug, { token });
    return token;
  });
  outboundShares.set(slug, { pending });
  return pending;
}

/** @internal Test isolation for the module-scoped page-session caches. */
export function resetShareActionSessionForTests(): void {
  reportedInboundArrivals.clear();
  outboundShares.clear();
}

function readInitialShareToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = new URLSearchParams(window.location.search).get("s");
    return isValidSignedShareToken(token) ? token : null;
  } catch {
    return null;
  }
}

export function ShareActions({ slug, phrase }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const activeSlugRef = useRef(slug);

  useEffect(() => {
    activeSlugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    const token = readInitialShareToken();
    if (!token || !measurementEnabled()) return;
    if (!consumeInboundArrival(token)) return;
    void reportShareArrival(slug, token);
  }, [slug]);

  async function ensureOutboundShare(): Promise<{
    token: string;
    url: string;
  } | null> {
    if (!measurementEnabled()) {
      setStatus("Sharing is unavailable while measurement is offline.");
      return null;
    }
    const requestSlug = slug;
    const token = await mintOutboundToken(requestSlug);
    if (activeSlugRef.current !== requestSlug) return null;
    if (!token) {
      setStatus("Could not create share token.");
      return null;
    }
    return { token, url: buildShareUrl(requestSlug, token) };
  }

  async function onCopy() {
    const created = await ensureOutboundShare();
    if (!created) return;
    const ok = await copyLink(created.url);
    setStatus(ok ? "Link copied." : "Could not copy link.");
  }

  async function onShare() {
    const created = await ensureOutboundShare();
    if (!created) return;
    const result = await nativeShare({
      title: `Origin: ${phrase}`,
      text: `Traced genealogy for “${phrase}”`,
      url: created.url,
    });
    if (result === "shared") setStatus("Shared.");
    else if (result === "copied") setStatus("Share unavailable — link copied.");
    else setStatus("Could not share.");
  }

  return (
    <div className="share-actions">
      <button type="button" className="btn" onClick={onShare}>
        Share
      </button>
      <button type="button" className="btn btn-secondary" onClick={onCopy}>
        Copy link
      </button>
      {status ? (
        <span className="source-meta" role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}
