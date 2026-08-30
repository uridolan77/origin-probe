import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { getAll, listForAutocomplete } from "@/lib/genealogies";

export default function HomePage() {
  const all = getAll();
  const listed = all.slice(0, 8);
  const autocomplete = listForAutocomplete();

  return (
    <div className="stack">
      <header className="prose">
        <p className="display" style={{ fontSize: "2.4rem", margin: 0 }}>
          Origin
        </p>
        <h1 className="display" style={{ fontSize: "1.75rem", marginTop: "0.75rem" }}>
          Who coined it, who made it famous, and what came before?
        </h1>
        <p className="lead">
          A small research surface for traced phrase genealogies. Each entry separates
          verified occurrence, claimed coinage, popularization, and antecedents — with
          sources you can check.
        </p>
      </header>

      <SearchBox items={autocomplete} />

      <section aria-labelledby="available-phrases">
        <h2 id="available-phrases" className="display" style={{ fontSize: "1.25rem" }}>
          Available phrases
        </h2>
        {listed.length === 0 ? (
          <p className="lead">
            The traced collection is empty in this build. Reviewed genealogies will appear
            here once data is added.{" "}
            <Link href="/corrections/">Request a phrase</Link> or read the{" "}
            <Link href="/method/">method</Link>.
          </p>
        ) : (
          <ul className="phrase-list">
            {listed.map((g) => (
              <li key={g.slug}>
                <Link href={`/g/${g.slug}/`}>{g.phrase}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
