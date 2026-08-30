/**
 * Analytics event contract (G2).
 *
 * Crawler exclusion: measurement must ignore automated crawlers and link-preview
 * agents so bot fetches never inflate qualified views or propagation counts.
 * See `CRAWLER_EXCLUSION_NOTE` and docs/EVENT_CONTRACT.md.
 */

export const LIVE_ANALYTICS = false as const;

/** Exported for G2: crawlers and preview bots must be excluded from measurement. */
export const CRAWLER_EXCLUSION_NOTE =
  "Qualified views and propagation events must exclude known crawler and link-preview user agents. Bot fetches of shared URLs must never count as human arrival or qualified propagation.";

export const CLIENT_ID_STORAGE_KEY = "origin_cid";

export type QualifiedResultViewEvent = {
  type: "qualified_result_view";
  genealogySlug: string;
  clientId: string;
  at: string;
};

export type ShareCreatedEvent = {
  type: "share_created";
  genealogySlug: string;
  shareToken: string;
  originatingClientId: string;
  at: string;
};

export type PropagatedVisitEvent = {
  type: "propagated_visit";
  genealogySlug: string;
  shareToken: string;
  arrivingClientId: string;
  at: string;
};

export type QualifiedPropagationEvent = {
  type: "qualified_propagation";
  genealogySlug: string;
  shareToken: string;
  arrivingClientId: string;
  at: string;
};

export type CorrectionSubmissionEvent = {
  type: "correction_submission";
  phrase: string;
  clientId: string;
  at: string;
};

export type AnalyticsEvent =
  | QualifiedResultViewEvent
  | ShareCreatedEvent
  | PropagatedVisitEvent
  | QualifiedPropagationEvent
  | CorrectionSubmissionEvent;

export type ShareArrivalKind = "originating" | "arriving" | "unknown";

export function generateShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateClientId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "server";
  }
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing && existing.length >= 8) return existing;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
  return id;
}

/**
 * Distinguishes the originating sharer from an arriving client.
 * `share_created` must never be counted as propagation.
 */
export function classifyShareArrival(
  token: string | null | undefined,
  clientId: string,
  originatingClientIdStored: string | null | undefined,
): ShareArrivalKind {
  if (!token || token.length < 8) return "unknown";
  if (
    originatingClientIdStored &&
    originatingClientIdStored.length >= 8 &&
    originatingClientIdStored === clientId
  ) {
    return "originating";
  }
  if (originatingClientIdStored && originatingClientIdStored !== clientId) {
    return "arriving";
  }
  return "arriving";
}

export interface EventSink {
  emit(event: AnalyticsEvent): void | Promise<void>;
}

const MEMORY_KEY = "origin_events_v1";

export class LocalEventSink implements EventSink {
  private memory: AnalyticsEvent[] = [];

  emit(event: AnalyticsEvent): void {
    // share_created is stored for audit but never treated as propagation upstream.
    this.memory.push(event);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const prev = window.localStorage.getItem(MEMORY_KEY);
        const list: AnalyticsEvent[] = prev ? (JSON.parse(prev) as AnalyticsEvent[]) : [];
        list.push(event);
        window.localStorage.setItem(MEMORY_KEY, JSON.stringify(list.slice(-200)));
      } catch {
        // ignore
      }
    }
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.memory];
  }
}

export class ProductionEventSink implements EventSink {
  emit(event: AnalyticsEvent): void {
    void event;
    if (LIVE_ANALYTICS) {
      throw new Error(
        "ProductionEventSink is unconfigured. LIVE_ANALYTICS must remain false until an approved endpoint exists.",
      );
    }
  }
}

export function createDefaultEventSink(): EventSink {
  if (LIVE_ANALYTICS) return new ProductionEventSink();
  return new LocalEventSink();
}
