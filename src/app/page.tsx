import Link from "next/link";
import { CollectionIndex } from "@/components/CollectionIndex";
import { listForAutocomplete, listForIndex } from "@/lib/genealogies";

export default function HomePage() {
  const indexed = listForIndex();
  const autocomplete = listForAutocomplete();
  const count = indexed.length;

  return (
    <div className="stack">
      <header className="collection-hero">
        <div className="collection-hero-copy">
          <h1>Who coined it, who made it famous, and what came before</h1>
          <p className="collection-lead">
            {count > 0
              ? `${count} phrases traced to sources you can open. Each entry keeps verified use, claimed coinage, popularization and misattribution apart — and says where the trail goes cold.`
              : "A small research surface for traced phrase genealogies. Each entry keeps verified use, claimed coinage, popularization and misattribution apart — and says where the trail goes cold."}
          </p>
        </div>
      </header>

      {indexed.length > 0 ? (
        <>
          <CollectionIndex items={indexed} searchItems={autocomplete} />
          <p className="collection-footnote">
            Each entry shows its lifecycle status, revision, and review date.{" "}
            <Link href="/method/">How Origin traces a phrase</Link>.
          </p>
        </>
      ) : (
        <p className="collection-lead">
          The traced collection is empty in this build. Reviewed genealogies will appear here
          once data is added.{" "}
          <Link href="/corrections/">Request a phrase</Link> or read the{" "}
          <Link href="/method/">method</Link>.
        </p>
      )}
    </div>
  );
}
