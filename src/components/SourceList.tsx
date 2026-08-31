import type { Assertion, Source } from "@/lib/schema";
import { SOURCE_TYPE_DISPLAY } from "@/lib/display";

type Props = {
  sources: Source[];
  assertions: Assertion[];
};

export function SourceList({ sources, assertions }: Props) {
  const sorted = [...sources].sort((a, b) =>
    a.publicationDate.localeCompare(b.publicationDate),
  );

  return (
    <ul className="source-list">
      {sorted.map((s) => {
        const type = SOURCE_TYPE_DISPLAY[s.sourceType];
        const supported = assertions.filter((a) =>
          s.supportsAssertionIds.includes(a.assertionId),
        );
        return (
          <li key={s.sourceId}>
            <article className="source-card" id={`source-${s.sourceId}`}>
              <h3>{s.title}</h3>
              <p className="source-meta">
                <span className={`chip chip--${type.tone}`}>
                  <span className="chip__glyph" aria-hidden="true">
                    {type.glyph}
                  </span>
                  {type.label}
                </span>{" "}
                {s.author} · {s.publisher} · {s.publicationDate}
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
              {supported.length > 0 ? (
                <p className="source-meta">
                  Supports:{" "}
                  {supported.map((a, i) => (
                    <span key={a.assertionId}>
                      {i > 0 ? ", " : null}
                      <a href={`#assertion-${a.assertionId}`}>{a.subject}</a>
                    </span>
                  ))}
                </p>
              ) : null}
              {s.shortExcerpt ? <p className="excerpt">{s.shortExcerpt}</p> : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
