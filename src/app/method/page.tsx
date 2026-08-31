import type { Metadata } from "next";
import { ConfidenceChip } from "@/components/ConfidenceChip";
import { SupportMeter } from "@/components/SupportMeter";
import { VerdictBadge } from "@/components/VerdictBadge";
import {
  CONFIDENCE_DISPLAY,
  EARLIER_USE_DISPLAY,
  ROLE_DISPLAY,
  SOURCE_TYPE_DISPLAY,
  SUPPORT_DISPLAY,
} from "@/lib/display";
import { ERA_BANDS } from "@/lib/time-scale";

export const metadata: Metadata = {
  title: "Method",
  description: "How Origin traces phrase genealogies and what the evidence roles mean.",
};

export default function MethodPage() {
  return (
    <article className="prose stack">
      <h1 className="display display-lg">Method</h1>
      <p className="lead">
        Origin publishes provisional, sourced genealogies for phrases. The goal is not a
        trophy claim of absolute priority, but a clear map of what evidence supports which
        role — and what remains contested.
      </p>

      <h2 className="display display-sm">Evidence roles</h2>
      <div className="legend-grid">
        {(Object.keys(ROLE_DISPLAY) as (keyof typeof ROLE_DISPLAY)[]).map((key) => {
          const d = ROLE_DISPLAY[key];
          return (
            <div key={key} className="legend-row">
              <span className={`chip chip--${d.tone}`}>
                <span className="chip__glyph" aria-hidden="true">
                  {d.glyph}
                </span>
                {d.shortLabel}
              </span>
              <p>
                <strong>{d.label}.</strong>{" "}
                {key === "EARLIEST_VERIFIED_OCCURRENCE"
                  ? "Oldest instance checked against a citable primary source within the stated search scope — not a guarantee that nothing older exists outside that scope."
                  : key === "EARLIEST_REPORTED_OCCURRENCE"
                    ? "Oldest instance known from secondary reporting when the primary hardcopy was not independently inspected. Public surfaces label these dates as Reported."
                    : key === "CLAIMED_COINAGE"
                      ? "A person or outlet asserts they coined the phrase. Claims are recorded separately from verified occurrences."
                      : key === "POPULARIZED_BY"
                        ? "A use or campaign that materially widened recognition, even when coinage lies elsewhere."
                        : key === "MISATTRIBUTED_TO"
                          ? "A common but unsupported attribution, documented so it can be challenged with sources."
                          : key === "ANTECEDENT"
                            ? "Earlier wording or adjacent ideas that illuminate lineage without equating to the tracked phrase."
                            : "Disagreements or gaps that remain unresolved in the current revision."}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="display display-sm">Confidence</h2>
      <p>
        Confidence chips encode how well we know an occurrence — never by color alone.
      </p>
      <div className="legend-grid">
        {(Object.keys(CONFIDENCE_DISPLAY) as (keyof typeof CONFIDENCE_DISPLAY)[]).map(
          (key) => (
            <div key={key} className="legend-row">
              <ConfidenceChip confidence={key} />
              <p>
                {key === "verified"
                  ? "Primary-backed earliest verified occurrence within scope."
                  : key === "reported"
                    ? "Secondary reporting, incomplete primary inspection, or earlier-use uncertainty."
                    : "Contested support or contested earlier-use status."}
              </p>
            </div>
          ),
        )}
      </div>

      <h2 className="display display-sm">Support strength</h2>
      <div className="legend-grid">
        {(Object.keys(SUPPORT_DISPLAY) as (keyof typeof SUPPORT_DISPLAY)[]).map((key) => (
          <div key={key} className="legend-row">
            <SupportMeter supportKind={key} />
            <p>Four-step meter for {SUPPORT_DISPLAY[key].label} support.</p>
          </div>
        ))}
      </div>

      <h2 className="display display-sm">Earlier-use status</h2>
      <div className="legend-grid">
        {(Object.keys(EARLIER_USE_DISPLAY) as (keyof typeof EARLIER_USE_DISPLAY)[]).map(
          (key) => {
            const d = EARLIER_USE_DISPLAY[key];
            return (
              <div key={key} className="legend-row">
                <span className={`chip chip--${d.tone}`}>
                  <span className="chip__glyph" aria-hidden="true">
                    {d.glyph}
                  </span>
                  {d.shortLabel}
                </span>
                <p>{d.label}.</p>
              </div>
            );
          },
        )}
      </div>

      <h2 className="display display-sm">Source types</h2>
      <div className="legend-grid">
        {(Object.keys(SOURCE_TYPE_DISPLAY) as (keyof typeof SOURCE_TYPE_DISPLAY)[]).map(
          (key) => {
            const d = SOURCE_TYPE_DISPLAY[key];
            return (
              <div key={key} className="legend-row">
                <span className={`chip chip--${d.tone}`}>
                  <span className="chip__glyph" aria-hidden="true">
                    {d.glyph}
                  </span>
                  {d.label}
                </span>
                <p>
                  {key === "primary"
                    ? "Inspectable primary text or hardcopy within this corpus."
                    : "Secondary dossier or reporting; not an independently re-inspected primary."}
                </p>
              </div>
            );
          },
        )}
      </div>

      <h2 className="display display-sm">Verdicts</h2>
      <div className="legend-grid">
        <div className="legend-row">
          <VerdictBadge verdict="direct_coinage" decorativeGlyph={false} />
          <p>Primary-backed claim plus index-bound verified occurrence with no earlier use located within scope.</p>
        </div>
        <div className="legend-row">
          <VerdictBadge verdict="claimed_coinage" decorativeGlyph={false} />
          <p>Coinage is claimed; earlier-use or inspection limits keep it short of direct coinage.</p>
        </div>
        <div className="legend-row">
          <VerdictBadge verdict="popularized" decorativeGlyph={false} />
          <p>Recognition widened by a later use or campaign.</p>
        </div>
        <div className="legend-row">
          <VerdictBadge verdict="misattributed" decorativeGlyph={false} />
          <p>Common attribution is not supported by the reviewed evidence.</p>
        </div>
      </div>

      <h2 className="display display-sm">Time scale</h2>
      <p>
        Collection span bars and detail timelines use a <strong>piecewise era scale</strong>
        — each band below gets equal visual width. The axis is deliberately not linear across
        millennia, so ancient and modern entries remain comparable without crushing one end.
      </p>
      <ul>
        {ERA_BANDS.map((b) => (
          <li key={b.id}>
            <strong>{b.label}</strong> — {b.start < 0 ? `${Math.abs(b.start)} BCE` : b.start}
            {" → "}
            {b.end}
          </li>
        ))}
      </ul>
      <p>
        Timeline rows separate <em>event time</em> (when the wording occurred) from{" "}
        <em>documentation time</em> (when a source recorded it). Dossier years never impersonate
        occurrence years.
      </p>

      <h2 className="display display-sm">Absolute-claim discipline</h2>
      <p>
        Public findings avoid absolute priority wording. Instead of declaring a definitive
        worldwide priority, we state what was verified, under what search scope, and with
        which sources. Absolute priority language is treated as a defect to revise, not a
        rhetorical flourish.
      </p>

      <h2 className="display display-sm">Provisional by design</h2>
      <p>
        Every genealogy carries a revision number, review date, status, and a hash of its
        source set. New evidence can supersede a prior revision. Corrections are welcome
        through the structured form; there is no public comment stream.
      </p>
    </article>
  );
}
