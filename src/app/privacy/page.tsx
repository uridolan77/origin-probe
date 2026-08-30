import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Origin handles measurement and personal data.",
};

export default function PrivacyPage() {
  return (
    <article className="prose stack">
      <h1 className="display" style={{ fontSize: "2rem", margin: 0 }}>
        Privacy
      </h1>
      <p className="lead">
        Origin is a static research site. There are no accounts, no advertising networks,
        and no browser fingerprinting.
      </p>
      <h2 className="display" style={{ fontSize: "1.25rem" }}>
        What we do not do
      </h2>
      <ul>
        <li>No login or user profiles.</li>
        <li>No third-party ad pixels.</li>
        <li>No canvas, audio, or similar fingerprinting techniques.</li>
      </ul>
      <h2 className="display" style={{ fontSize: "1.25rem" }}>
        Measurement (plain language)
      </h2>
      <p>
        Optional product events — such as viewing a traced result, creating a share link,
        or noting that someone arrived via a share — may be recorded through a typed event
        contract. In this probe build, live analytics remain off. When enabled later, a
        random client identifier may be stored in local storage solely to distinguish an
        originating sharer from an arriving visitor. Share creation is never counted as
        propagation.
      </p>
      <p>
        Automated crawlers and link-preview agents must be excluded from qualified view and
        propagation counts so bot fetches do not look like human interest.
      </p>
      <h2 className="display" style={{ fontSize: "1.25rem" }}>
        Corrections
      </h2>
      <p>
        Correction forms validate structured fields. In this probe, submissions stay in
        your browser storage. Do not include secrets or sensitive personal data in notes.
      </p>
    </article>
  );
}
