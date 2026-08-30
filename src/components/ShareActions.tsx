"use client";

import { useEffect, useState } from "react";
import { generateShareToken } from "@/lib/events";
import {
  createSignedShare,
  measurementEnabled,
  reportShareArrival,
} from "@/lib/measurement";
import { buildShareUrl, copyLink, nativeShare } from "@/lib/share";

type Props = {
  slug: string;
  phrase: string;
};

function readInitialShareToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = new URLSearchParams(window.location.search).get("s");
    if (!token || token.length < 16) return null;
    return token;
  } catch {
    return null;
  }
}

export function ShareActions({ slug, phrase }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [arrivalToken, setArrivalToken] = useState<string | null>(() =>
    readInitialShareToken(),
  );

  useEffect(() => {
    const token = readInitialShareToken();
    if (!token || !measurementEnabled()) return;
    void reportShareArrival(slug, token);
  }, [slug]);

  async function ensureToken(): Promise<{ token: string; url: string } | null> {
    if (arrivalToken?.trim()) {
      return { token: arrivalToken, url: buildShareUrl(slug, arrivalToken) };
    }
    if (measurementEnabled()) {
      const token = await createSignedShare(slug, false);
      if (!token) {
        setStatus("Could not create share token.");
        return null;
      }
      setArrivalToken(token);
      return { token, url: buildShareUrl(slug, token) };
    }
    // Preview / offline: local opaque token for UX only — not measurement-grade.
    const token = generateShareToken();
    setArrivalToken(token);
    return { token, url: buildShareUrl(slug, token) };
  }

  async function onCopy() {
    const created = await ensureToken();
    if (!created) return;
    const ok = await copyLink(created.url);
    setStatus(ok ? "Link copied." : "Could not copy link.");
  }

  async function onShare() {
    const created = await ensureToken();
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
