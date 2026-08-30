"use client";

import { useEffect, useRef, useState } from "react";
import { generateShareToken } from "@/lib/events";
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

const MAX_REPORTED_INBOUND_ARRIVALS = 128;
const reportedInboundArrivals = new Set<string>();

function consumeInboundArrival(arrivalKey: string): boolean {
  if (reportedInboundArrivals.has(arrivalKey)) return false;
  reportedInboundArrivals.add(arrivalKey);
  if (reportedInboundArrivals.size > MAX_REPORTED_INBOUND_ARRIVALS) {
    const oldest = reportedInboundArrivals.values().next().value;
    if (oldest) reportedInboundArrivals.delete(oldest);
  }
  return true;
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
  const outboundSlugRef = useRef(slug);
  const outboundGenerationRef = useRef(0);
  const outboundTokenRef = useRef<string | null>(null);
  const outboundTokenPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (outboundSlugRef.current === slug) return;
    outboundSlugRef.current = slug;
    outboundGenerationRef.current += 1;
    outboundTokenRef.current = null;
    outboundTokenPromiseRef.current = null;
  }, [slug]);

  useEffect(() => {
    const token = readInitialShareToken();
    if (!token || !measurementEnabled()) return;
    const arrivalKey = `${slug}\u0000${token}`;
    if (!consumeInboundArrival(arrivalKey)) return;
    void reportShareArrival(slug, token);
  }, [slug]);

  async function createOutboundToken(): Promise<string | null> {
    if (outboundSlugRef.current !== slug) {
      outboundSlugRef.current = slug;
      outboundGenerationRef.current += 1;
      outboundTokenRef.current = null;
      outboundTokenPromiseRef.current = null;
    }

    if (outboundTokenRef.current) return outboundTokenRef.current;
    if (outboundTokenPromiseRef.current) return outboundTokenPromiseRef.current;

    const requestSlug = slug;
    const requestGeneration = outboundGenerationRef.current;
    const pending = (async () => {
      const token = measurementEnabled()
        ? await createSignedShare(requestSlug, false)
        : `offline.${generateShareToken()}`;
      if (
        outboundSlugRef.current !== requestSlug ||
        outboundGenerationRef.current !== requestGeneration
      ) {
        return null;
      }
      if (!isValidSignedShareToken(token)) {
        setStatus("Could not create share token.");
        return null;
      }
      outboundTokenRef.current = token;
      return token;
    })();

    outboundTokenPromiseRef.current = pending;
    const token = await pending;
    if (outboundTokenPromiseRef.current === pending) {
      outboundTokenPromiseRef.current = null;
    }
    return token;
  }

  async function ensureOutboundShare(): Promise<{
    token: string;
    url: string;
  } | null> {
    const token = await createOutboundToken();
    if (!token) return null;
    return { token, url: buildShareUrl(slug, token) };
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
