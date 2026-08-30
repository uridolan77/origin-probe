# Event contract

Typed product events for Origin measurement. Live shipping stays off (`LIVE_ANALYTICS = false`) until an approved sink exists.

## Events

| Type | Purpose |
| --- | --- |
| `qualified_result_view` | A human viewed a traced genealogy result under qualification rules. |
| `share_created` | A share token was minted for a genealogy. **Never counts as propagation.** |
| `propagated_visit` | A distinct client arrived via a share token. |
| `qualified_propagation` | A propagated visit that meets qualification rules (not a bot, not the originator). |
| `correction_submission` | A structured correction or phrase request was accepted by the adapter. |

## Client identity

- `getOrCreateClientId()` stores an opaque id in `localStorage` under `origin_cid`.
- `generateShareToken()` uses `crypto.getRandomValues` for an opaque token.
- `classifyShareArrival(token, clientId, originatingClientIdStored)` returns `originating`, `arriving`, or `unknown`.

## Sinks

- `LocalEventSink` — memory plus optional `localStorage` ring buffer for probe builds.
- `ProductionEventSink` — no-ops while `LIVE_ANALYTICS` is false; when live, POSTs typed JSON to `NEXT_PUBLIC_ORIGIN_EVENT_INGEST_URL` (optional bearer token). Qualified events are dropped client-side when the user agent matches crawler/preview patterns. Network failures are swallowed so the UI never throws.

## Crawler exclusion (G2)

`CRAWLER_EXCLUSION_NOTE` (exported from `src/lib/events.ts`):

> Qualified views and propagation events must exclude known crawler and link-preview user agents. Bot fetches of shared URLs must never count as human arrival or qualified propagation.

Implementations that later enable live analytics must filter crawlers before emitting `qualified_result_view`, `propagated_visit`, or `qualified_propagation`.
