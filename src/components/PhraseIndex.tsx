import Link from "next/link";
import type { IndexedGenealogy } from "@/lib/genealogies";
import { formatEarliestLabel } from "@/lib/earliest-label";
import type { Verdict } from "@/lib/schema";

const VERDICT_LABELS: Record<Verdict, string> = {
  direct_coinage: "Direct coinage",
  claimed_coinage: "Claimed coinage",
  popularized: "Popularized",
  misattributed: "Misattributed",
};

function verdictClassName(verdict: Verdict): string {
  if (verdict === "misattributed") {
    return "phrase-index-verdict phrase-index-verdict--misattributed";
  }
  if (verdict === "popularized") {
    return "phrase-index-verdict phrase-index-verdict--popularized";
  }
  return "phrase-index-verdict phrase-index-verdict--coinage";
}

type Props = {
  items: readonly IndexedGenealogy[];
};

export function PhraseIndex({ items }: Props) {
  return (
    <>
      <table className="phrase-index-table phrase-index-table--desktop">
        <caption className="sr-only">Phrase genealogy collection</caption>
        <thead>
          <tr>
            <th scope="col">Earliest</th>
            <th scope="col">Phrase</th>
            <th scope="col">Finding</th>
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {items.map((g) => {
            const earliest = formatEarliestLabel(g);
            return (
              <tr key={g.slug}>
                <td className="phrase-index-year">{earliest}</td>
                <td className="phrase-index-phrase">
                  <Link href={`/g/${g.slug}/`}>{g.phrase}</Link>
                </td>
                <td className="phrase-index-finding">{g.index.shortFinding}</td>
                <td className={verdictClassName(g.index.verdict)}>{VERDICT_LABELS[g.index.verdict]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="phrase-index-cards phrase-index-cards--mobile">
        {items.map((g) => {
          const earliest = formatEarliestLabel(g);
          return (
            <li key={g.slug} className="phrase-index-card">
              <dl>
                <div className="phrase-index-card-row">
                  <dt>Earliest</dt>
                  <dd>{earliest}</dd>
                </div>
                <div className="phrase-index-card-row">
                  <dt>Verdict</dt>
                  <dd className={verdictClassName(g.index.verdict)}>
                    {VERDICT_LABELS[g.index.verdict]}
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
          );
        })}
      </ul>
    </>
  );
}
