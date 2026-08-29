import type { Source } from "@/lib/schema";

type Props = {
  sources: Source[];
};

export function SourceList({ sources }: Props) {
  const sorted = [...sources].sort((a, b) =>
    a.publicationDate.localeCompare(b.publicationDate),
  );

  return (
    <ul className="source-list">
      {sorted.map((s) => (
        <li key={s.sourceId}>
          <article>
            <h3>{s.title}</h3>
            <p className="source-meta">
              {s.author} · {s.publisher} · {s.publicationDate} · {s.sourceType}
            </p>
            <p className="source-meta">
              <a href={s.url} rel="noopener noreferrer">
                Source link
              </a>
              {s.archiveUrl ? (
                <>
                  {" · "}
                  <a href={s.archiveUrl} rel="noopener noreferrer">
                    Archive
                  </a>
                </>
              ) : null}
              {" · Accessed "}
              {s.accessedAt}
            </p>
            {s.shortExcerpt ? <p className="excerpt">{s.shortExcerpt}</p> : null}
          </article>
        </li>
      ))}
    </ul>
  );
}
