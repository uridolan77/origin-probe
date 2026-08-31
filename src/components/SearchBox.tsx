"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type SearchItem = {
  slug: string;
  phrase: string;
  aliases: string[];
};

type Props = {
  items: SearchItem[];
};

export function SearchBox({ items }: Props) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => {
        if (item.phrase.toLowerCase().includes(q)) return true;
        return item.aliases.some((a) => a.toLowerCase().includes(q));
      })
      .slice(0, 8);
  }, [items, query]);

  const showUnsupported = query.trim().length >= 2 && matches.length === 0;

  return (
    <div className="search-box">
      <label htmlFor="collection-search">Search the collection</label>
      <input
        id="collection-search"
        type="search"
        name="q"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="A phrase, a name, a year."
      />
      {!showUnsupported ? (
        <p className="search-hint">
          Not traced yet? <Link href="/corrections/">Request a phrase</Link>.
        </p>
      ) : null}
      {matches.length > 0 ? (
        <ul className="search-suggestions" aria-label="Matching phrases">
          {matches.map((item) => (
            <li key={item.slug}>
              <Link href={`/g/${item.slug}/`}>{item.phrase}</Link>
            </li>
          ))}
        </ul>
      ) : null}
      {showUnsupported ? (
        <p className="search-empty">
          No matches in the collection.{" "}
          <Link href="/corrections/">Request this phrase.</Link>
        </p>
      ) : null}
    </div>
  );
}
