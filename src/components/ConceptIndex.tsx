"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DensityToggle } from "@/components/DensityToggle";
import { MaturityChip } from "@/components/MaturityChip";
import {
  MATURITY_DISPLAY,
  OBJECT_KIND_DISPLAY,
} from "@/lib/concepts/display";
import type {
  ConceptCatalogItem,
  ConceptObjectKind,
  ResearchMaturity,
} from "@/lib/concepts/schema";

type SortKey = "label" | "domain" | "maturity";

type Props = {
  items: readonly ConceptCatalogItem[];
};

const MATURITY_ORDER: ResearchMaturity[] = [
  "research_queue",
  "source_leads_mapped",
  "partially_verified",
  "published",
];

export function ConceptIndex({ items }: Props) {
  const [domain, setDomain] = useState<string>("all");
  const [kind, setKind] = useState<ConceptObjectKind | "all">("all");
  const [maturity, setMaturity] = useState<ResearchMaturity | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) for (const d of item.domains) set.add(d);
    return [...set].sort((a, b) => a.localeCompare(b, "en"));
  }, [items]);

  const kinds = useMemo(() => {
    const set = new Set<ConceptObjectKind>();
    for (const item of items) set.add(item.objectKind);
    return [...set].sort((a, b) => a.localeCompare(b, "en"));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((item) => {
      if (domain !== "all" && !item.domains.includes(domain)) return false;
      if (kind !== "all" && item.objectKind !== kind) return false;
      if (maturity !== "all" && item.researchMaturity !== maturity) return false;
      if (!q) return true;
      if (item.label.toLowerCase().includes(q)) return true;
      return item.aliases.some((a) => a.toLowerCase().includes(q));
    });

    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "label") cmp = a.label.localeCompare(b.label, "en");
      else if (sortKey === "domain") {
        cmp = (a.domains[0] ?? "").localeCompare(b.domains[0] ?? "", "en");
      } else {
        cmp =
          MATURITY_ORDER.indexOf(a.researchMaturity) -
          MATURITY_ORDER.indexOf(b.researchMaturity);
      }
      if (cmp === 0) cmp = a.conceptId.localeCompare(b.conceptId, "en");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, domain, kind, maturity, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function ariaSort(key: SortKey): "ascending" | "descending" | "none" {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.aliases.some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [items, query]);

  return (
    <div className="stack">
      <div className="toolbar toolbar--sticky index-toolbar">
        <div className="collection-search">
          <div className="search-box">
            <label htmlFor="concept-search">Search concepts</label>
            <input
              id="concept-search"
              type="search"
              name="q"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Label or alias"
            />
            {searchMatches.length > 0 ? (
              <ul className="search-suggestions" aria-label="Matching concepts">
                {searchMatches.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/concepts/${item.slug}/`}>
                      <span className="search-type">Concept</span> {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="toolbar__group" role="group" aria-label="Filter by domain">
          <label className="sr-only" htmlFor="concept-domain">
            Domain
          </label>
          <select
            id="concept-domain"
            className="facet-select"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            <option value="all">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar__group" role="group" aria-label="Filter by kind">
          <label className="sr-only" htmlFor="concept-kind">
            Object kind
          </label>
          <select
            id="concept-kind"
            className="facet-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as ConceptObjectKind | "all")}
          >
            <option value="all">All kinds</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {OBJECT_KIND_DISPLAY[k]}
              </option>
            ))}
          </select>
        </div>

        <div
          className="toolbar__group"
          role="group"
          aria-label="Filter by research maturity"
        >
          <button
            type="button"
            className="facet-chip"
            aria-pressed={maturity === "all"}
            onClick={() => setMaturity("all")}
          >
            All statuses
          </button>
          {MATURITY_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              className="facet-chip"
              aria-pressed={maturity === m}
              onClick={() => setMaturity(m)}
            >
              {MATURITY_DISPLAY[m].shortLabel}
            </button>
          ))}
        </div>

        <DensityToggle />
        <p className="toolbar__meta" aria-live="polite">
          {filtered.length} of {items.length} concepts
        </p>
      </div>

      <table className="phrase-index-table phrase-index-table--desktop concept-index-table">
        <caption className="sr-only">Philosophical concept research catalog</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort("label")}>
              <button type="button" onClick={() => toggleSort("label")}>
                Concept
              </button>
            </th>
            <th scope="col">Kind</th>
            <th scope="col" aria-sort={ariaSort("domain")}>
              <button type="button" onClick={() => toggleSort("domain")}>
                Domain
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("maturity")}>
              <button type="button" onClick={() => toggleSort("maturity")}>
                Research status
              </button>
            </th>
            <th scope="col">Public dossier</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.conceptId}>
              <td className="phrase-index-phrase">
                <Link href={`/concepts/${item.slug}/`}>{item.label}</Link>
                <span className="phrase-index-finding-secondary">
                  {item.conceptId}
                </span>
              </td>
              <td>{OBJECT_KIND_DISPLAY[item.objectKind]}</td>
              <td>{item.domains[0]}</td>
              <td>
                <MaturityChip maturity={item.researchMaturity} />
                <span className="sr-only">
                  {MATURITY_DISPLAY[item.researchMaturity].label}
                </span>
              </td>
              <td>
                {item.publicFindingAvailable ? (
                  <Link href={`/concepts/${item.slug}/`}>Published</Link>
                ) : (
                  "None yet"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="phrase-index-cards phrase-index-cards--mobile">
        {filtered.map((item) => (
          <li key={item.conceptId} className="phrase-index-card">
            <div className="phrase-index-card-badges">
              <MaturityChip maturity={item.researchMaturity} />
              <span className="chip chip--neutral">{OBJECT_KIND_DISPLAY[item.objectKind]}</span>
            </div>
            <dl>
              <div className="phrase-index-card-row">
                <dt>Concept</dt>
                <dd>
                  <Link href={`/concepts/${item.slug}/`}>{item.label}</Link>
                </dd>
              </div>
              <div className="phrase-index-card-row">
                <dt>Domain</dt>
                <dd>{item.domains.join("; ")}</dd>
              </div>
              <div className="phrase-index-card-row">
                <dt>Research status</dt>
                <dd>{MATURITY_DISPLAY[item.researchMaturity].label}</dd>
              </div>
              <div className="phrase-index-card-row">
                <dt>Public dossier</dt>
                <dd>{item.publicFindingAvailable ? "Published" : "None yet"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
