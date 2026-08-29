import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Method",
  description: "How Origin traces phrase genealogies and what the evidence roles mean.",
};

export default function MethodPage() {
  return (
    <article className="prose stack">
      <h1 className="display" style={{ fontSize: "2rem", margin: 0 }}>
        Method
      </h1>
      <p className="lead">
        Origin publishes provisional, sourced genealogies for phrases. The goal is not a
        trophy claim of absolute priority, but a clear map of what evidence supports which
        role — and what remains contested.
      </p>

      <h2 className="display" style={{ fontSize: "1.25rem" }}>
        Evidence roles
      </h2>
      <ul>
        <li>
          <strong>Earliest verified occurrence</strong> — the oldest instance we have
          checked against a citable source within the stated search scope. It is not a
          guarantee that nothing older exists outside that scope.
        </li>
        <li>
          <strong>Claimed coinage</strong> — a person or outlet asserts they coined the
          phrase. Claims are recorded separately from verified occurrences.
        </li>
        <li>
          <strong>Popularized by</strong> — a use or campaign that materially widened
          recognition, even when coinage lies elsewhere.
        </li>
        <li>
          <strong>Misattributed to</strong> — a common but unsupported attribution we
          document so it can be challenged with sources.
        </li>
        <li>
          <strong>Antecedent</strong> — earlier wording or adjacent ideas that illuminate
          lineage without equating to the tracked phrase.
        </li>
        <li>
          <strong>Contested or incomplete</strong> — disagreements or gaps that remain
          unresolved in the current revision.
        </li>
      </ul>

      <h2 className="display" style={{ fontSize: "1.25rem" }}>
        Absolute-claim discipline
      </h2>
      <p>
        Public findings avoid absolute priority wording. Instead of declaring a definitive
        worldwide priority, we state what was verified, under what search scope, and with
        which sources. Absolute priority language is treated as a defect to revise, not a
        rhetorical flourish.
      </p>

      <h2 className="display" style={{ fontSize: "1.25rem" }}>
        Provisional by design
      </h2>
      <p>
        Every genealogy carries a revision number, review date, status, and a hash of its
        source set. New evidence can supersede a prior revision. Corrections are welcome
        through the structured form; there is no public comment stream.
      </p>
    </article>
  );
}
