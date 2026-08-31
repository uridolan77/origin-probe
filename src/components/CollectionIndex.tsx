"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfidenceChip } from "@/components/ConfidenceChip";
import { DensityToggle } from "@/components/DensityToggle";
import { SearchBox, type SearchItem } from "@/components/SearchBox";
import { VerdictBadge } from "@/components/VerdictBadge";
import {
  indexConfidence,
  type Confidence,
} from "@/lib/display";
import { formatEarliestLabel } from "@/lib/earliest-label";
import type { IndexedGenealogy } from "@/lib/genealogies";
import type { Verdict } from "@/lib/schema";
import {
  buildTimeScale,
  eraOfYear,
  spanUnits,
  type EraId,
} from "@/lib/time-scale";

type SortKey = "earliest" | "phrase" | "verdict";

type Props = {
  items: readonly IndexedGenealogy[];
  searchItems: SearchItem[];
};

const VERDICT_FACETS: { id: Verdict | "all"; label: string }[] = [
  { id: "all", label: "All verdicts" },
  { id: "direct_coinage", label: "Direct coinage" },
  { id: "claimed_coinage", label: "Claimed coinage" },
  { id: "popularized", label: "Popularized" },
  { id: "misattributed", label: "Misattributed" },
];

const CONF_FACETS: { id: Confidence | "all"; label: string }[] = [
  { id: "all", label: "All evidence" },
  { id: "verified", label: "Verified" },
  { id: "reported", label: "Reported" },
  { id: "contested", label: "Contested" },
];

function popularizedYear(g: IndexedGenealogy): number | undefined {
  const pop = g.assertions.find((a) => a.evidenceRole === "POPULARIZED_BY");
  if (!pop) return undefined;
  const related = g.sources.filter(
    (s) =>
      pop.evidenceIds.includes(s.sourceId) ||
      s.supportsAssertionIds.includes(pop.assertionId),
  );
  if (related.length === 0) return undefined;
  const dates = related.map((s) => s.publicationDate).sort();
  const y = Number.parseInt(dates[0]!.slice(0, 4), 10);
  return Number.isFinite(y) ? y : undefined;
}

export function CollectionIndex({ items, searchItems }: Props) {
  const [verdict, setVerdict] = useState<Verdict | "all">("all");
  const [confidence, setConfidence] = useState<Confidence | "all">("all");
  const [era, setEra] = useState<EraId | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("earliest");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const enriched = useMemo(() => {
    return items.map((g) => {
      const conf = indexConfidence(
        g.assertions,
        g.sources,
        g.index.earliest.assertionId,
      );
      const year = g.index.earliest.date.startYear;
      return {
        g,
        conf,
        year,
        era: eraOfYear(year),
        earliestLabel: formatEarliestLabel(g),
        popYear: popularizedYear(g),
      };
    });
  }, [items]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (verdict !== "all") {
      rows = rows.filter((r) => r.g.index.verdict === verdict);
    }
    if (confidence !== "all") {
      rows = rows.filter((r) => r.conf === confidence);
    }
    if (era !== "all") {
      rows = rows.filter((r) => r.era === era);
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "earliest") cmp = a.year - b.year;
      else if (sortKey === "phrase") cmp = a.g.phrase.localeCompare(b.g.phrase, "en");
      else cmp = a.g.index.verdict.localeCompare(b.g.index.verdict);
      if (cmp === 0) cmp = a.g.slug.localeCompare(b.g.slug);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [enriched, verdict, confidence, era, sortKey, sortDir]);

  const scale = useMemo(() => {
    const years = enriched.flatMap((r) =>
      [r.year, r.popYear].filter((y): y is number => y != null),
    );
    return buildTimeScale(years);
  }, [enriched]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function ariaSort(key: SortKey): "ascending" | "descending" | "none" {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  const erasPresent = useMemo(() => {
    const set = new Set(enriched.map((r) => r.era));
    return [...set];
  }, [enriched]);

  return (
    <div className="stack">
      <div className="toolbar toolbar--sticky index-toolbar">
        <div className="collection-search">
          <SearchBox items={searchItems} />
        </div>
        <div className="toolbar__group" role="group" aria-label="Filter by verdict">
          {VERDICT_FACETS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="facet-chip"
              aria-pressed={verdict === f.id}
              onClick={() => setVerdict(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="toolbar__group" role="group" aria-label="Filter by evidence">
          {CONF_FACETS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="facet-chip"
              aria-pressed={confidence === f.id}
              onClick={() => setConfidence(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {erasPresent.length > 1 ? (
          <div className="toolbar__group" role="group" aria-label="Filter by era">
            <button
              type="button"
              className="facet-chip"
              aria-pressed={era === "all"}
              onClick={() => setEra("all")}
            >
              All eras
            </button>
            {erasPresent.map((e) => (
              <button
                key={e}
                type="button"
                className="facet-chip"
                aria-pressed={era === e}
                onClick={() => setEra(e)}
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}
        <DensityToggle />
        <p className="toolbar__meta" aria-live="polite">
          {filtered.length} of {items.length}
        </p>
      </div>

      <table className="phrase-index-table phrase-index-table--desktop">
        <caption className="sr-only">Phrase genealogy collection</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort("earliest")}>
              <button type="button" onClick={() => toggleSort("earliest")}>
                Earliest
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("phrase")}>
              <button type="button" onClick={() => toggleSort("phrase")}>
                Phrase
              </button>
            </th>
            <th scope="col">Span</th>
            <th scope="col">Evidence</th>
            <th scope="col" aria-sort={ariaSort("verdict")}>
              <button type="button" onClick={() => toggleSort("verdict")}>
                Verdict
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(({ g, conf, year, earliestLabel, popYear }) => {
            const span = spanUnits(scale, year, popYear ?? year);
            return (
              <tr key={g.slug}>
                <td className="phrase-index-year">{earliestLabel}</td>
                <td className="phrase-index-phrase">
                  <Link href={`/g/${g.slug}/`}>{g.phrase}</Link>
                  <span className="phrase-index-finding-secondary">
                    {g.index.shortFinding}
                  </span>
                </td>
                <td className="phrase-index-span">
                  <div
                    className="span-bar"
                    style={{
                      ["--x-start" as string]: String(span.start),
                      ["--x-end" as string]: String(span.end),
                    }}
                    aria-hidden="true"
                  >
                    <span className="span-bar__mark" />
                    {popYear != null && popYear !== year ? (
                      <>
                        <span className="span-bar__range" />
                        <span className="span-bar__pop" />
                      </>
                    ) : null}
                  </div>
                </td>
                <td className="phrase-index-evidence">
                  <ConfidenceChip confidence={conf} />
                </td>
                <td>
                  <VerdictBadge verdict={g.index.verdict} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="phrase-index-cards phrase-index-cards--mobile">
        {filtered.map(({ g, conf, earliestLabel }) => (
          <li key={g.slug} className="phrase-index-card">
            <div className="phrase-index-card-badges">
              <ConfidenceChip confidence={conf} />
              <VerdictBadge verdict={g.index.verdict} />
            </div>
            <dl>
              <div className="phrase-index-card-row">
                <dt>Earliest</dt>
                <dd>{earliestLabel}</dd>
              </div>
              <div className="phrase-index-card-row">
                <dt>Verdict</dt>
                <dd className={`phrase-index-verdict phrase-index-verdict--${
                  g.index.verdict === "misattributed"
                    ? "misattributed"
                    : g.index.verdict === "popularized"
                      ? "popularized"
                      : "coinage"
                }`}>
                  {g.index.verdict === "direct_coinage"
                    ? "Direct coinage"
                    : g.index.verdict === "claimed_coinage"
                      ? "Claimed coinage"
                      : g.index.verdict === "popularized"
                        ? "Popularized"
                        : "Misattributed"}
                </dd>
              </div>
              <div className="phrase-index-card-row">
                <dt>Phrase</dt>
                <dd>
                  <Link href={`/g/${g.slug}/`}>{g.phrase}</Link>
                </dd>
              </div>
              <div className="phrase-index-card-row">
                <dt>Finding</dt>
                <dd>{g.index.shortFinding}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
