"use client";

import { useMemo, useState } from "react";
import {
  classifyShareArrival,
  createDefaultEventSink,
  generateShareToken,
  getOrCreateClientId,
} from "@/lib/events";
import { buildShareUrl, copyLink, nativeShare } from "@/lib/share";

type Props = {
  slug: string;
  phrase: string;
};

const ORIGIN_TOKEN_PREFIX = "origin_share_origin_";

function readInitialShareToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = new URLSearchParams(window.location.search).get("s");
    if (!token || token.length < 8) return null;
    return token;
  } catch {
    return null;
  }
}

function noteArrivalIfNeeded(slug: string, token: string | null) {
  if (!token || typeof window === "undefined") return;
  try {
    const clientId = getOrCreateClientId();
    let originating: string | null = null;
    try {
      originating = window.sessionStorage.getItem(`${ORIGIN_TOKEN_PREFIX}${token}`);
    } catch {
      originating = null;
    }
    const kind = classifyShareArrival(token, clientId, originating);
    if (kind === "arriving") {
      createDefaultEventSink().emit({
        type: "propagated_visit",
        genealogySlug: slug,
        shareToken: token,
        arrivingClientId: clientId,
        at: new Date().toISOString(),
      });
    }
  } catch {
    // ignore
  }
}

export function ShareActions({ slug, phrase }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [arrivalToken, setArrivalToken] = useState<string | null>(() => {
    const token = readInitialShareToken();
    if (token) noteArrivalIfNeeded(slug, token);
    return token;
  });
  const sink = useMemo(() => createDefaultEventSink(), []);

  async function ensureToken(): Promise<{ token: string; url: string }> {
    const clientId = getOrCreateClientId();
    let token = arrivalToken?.trim() || "";
    if (!token) {
      token = generateShareToken();
      try {
        window.sessionStorage.setItem(`${ORIGIN_TOKEN_PREFIX}${token}`, clientId);
      } catch {
        // ignore
      }
      sink.emit({
        type: "share_created",
        genealogySlug: slug,
        shareToken: token,
        originatingClientId: clientId,
        at: new Date().toISOString(),
      });
      setArrivalToken(token);
    }
    return { token, url: buildShareUrl(slug, token) };
  }

  async function onCopy() {
    const { url } = await ensureToken();
    const ok = await copyLink(url);
    setStatus(ok ? "Link copied." : "Could not copy link.");
  }

  async function onShare() {
    const { url } = await ensureToken();
    const result = await nativeShare({
      title: `Origin: ${phrase}`,
      text: `Traced genealogy for “${phrase}”`,
      url,
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
