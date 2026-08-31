import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Origin handles measurement and personal data.",
};

export default function PrivacyPage() {
  return (
    <article className="prose stack">
      <h1 className="display display-lg">
        Privacy
      </h1>
      <p className="lead">
        Origin&apos;s research pages are statically served. There are no accounts, no
        advertising networks, and no browser fingerprinting.
      </p>
      <h2 className="display display-sm">
        What we do not do
      </h2>
      <ul>
        <li>No login or user profiles.</li>
        <li>No third-party ad pixels.</li>
        <li>No canvas, audio, or similar fingerprinting techniques.</li>
      </ul>
      <h2 className="display display-sm">
        Measurement (plain language)
      </h2>
      <p>
        During a documented acceptance run or an authorized public decision window, live
        measurement is on. Your browser stores a random pseudonymous client identifier in
        local storage. When you view a traced result, create a share link, or arrive
        through a signed share link, the browser sends that identifier and limited event
        context to the measurement service.
      </p>
      <p>
        Before an event is written, the service transforms the identifier with a keyed HMAC
        using a server-held secret. The private durable ledger stores the resulting hash,
        event type, time, genealogy slug, share-token fingerprint when applicable, and any
        qualification exclusions; it does not store the raw browser identifier. Share-link
        creation is recorded for lineage but is never counted as propagation.
      </p>
      <p>
        Automated crawlers and link-preview agents are excluded from qualified counts, as
        are operator arrivals, designated seed-token arrivals, same-client arrivals,
        invalid tokens, and duplicate qualifications. The private ledger is evaluated only
        against the authorized 14-day window for the probe decision.
      </p>
      <h2 className="display display-sm">
        Corrections
      </h2>
      <p>
        Correction forms validate structured fields. In this probe, submissions stay in
        your browser storage. Do not include secrets or sensitive personal data in notes.
      </p>
    </article>
  );
}
