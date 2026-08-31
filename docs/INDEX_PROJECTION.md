# Index projection

The collection homepage renders a compact **index projection** derived from each genealogy record. The projection is not a second source of truth: it summarizes evidence-backed assertions already present in the record.

## Earliest column

`index.earliest` must bind to one of:

- `EARLIEST_VERIFIED_OCCURRENCE` — oldest instance checked against at least one **primary** source within the stated search scope. The index displays the date as-is (for example `1964`).
- `EARLIEST_REPORTED_OCCURRENCE` — oldest instance known only through secondary reporting when the primary hardcopy was not independently inspected. The index and OG surfaces must prefix the date with **Reported** (for example `Reported 1974`).

Other roles (`POPULARIZED_BY`, `ANTECEDENT`, `CLAIMED_COINAGE`, `MISATTRIBUTED_TO`, `CONTESTED_INCOMPLETE`) may appear in the record, but they must not be bound as `index.earliest.assertionId`.

The structured historical date lives on the bound occurrence assertion as `occurrenceDate` (`display`, `startYear`, precision, calendar). `index.earliest.date` is a projection and must deep-equal that field. The homepage label, OG card line, and detail-page timeline all derive the occurrence label from `occurrenceDate` (with the Reported prefix when the role is `EARLIEST_REPORTED_OCCURRENCE`). `startYear` remains the collection sort key.

Occurrence assertions also carry `earlierUseStatus`:

- `none_located_within_scope`
- `reported_unverified`
- `contested`

## Verdict column

`index.verdict` is an evidentiary conclusion, not the editorial lifecycle `status` field.

Allowed values:

- `direct_coinage`
- `claimed_coinage`
- `popularized`
- `misattributed`

`index.verdictAssertionId` must point at the assertion that justifies the verdict. Support strength (`supportKind`) stays orthogonal to the verdict label:

| Verdict | Bound assertion |
| --- | --- |
| `claimed_coinage` | `CLAIMED_COINAGE` (any `supportKind`, including `direct`) |
| `direct_coinage` | `CLAIMED_COINAGE` with `supportKind=direct` and a primary source, **plus** the **index-bound** `EARLIEST_VERIFIED_OCCURRENCE` itself being `direct`, primary-backed, `earlierUseStatus=none_located_within_scope`, and sharing the same `originatorKey` as the coinage claim |
| `popularized` | `POPULARIZED_BY`, `supportKind` not `incomplete` |
| `misattributed` | `MISATTRIBUTED_TO` |

A direct claim assertion alone is not sufficient for `direct_coinage`. Token overlap between subjects is not accepted as same-subject identity; `originatorKey` must match. Absence of a `caveat` string is not accepted as “no earlier use”; only `earlierUseStatus=none_located_within_scope` qualifies.

## Publication rule

Records with lifecycle status `provisional` or `reviewed` must include a complete `index` object. Draft, superseded, and withdrawn records must not include `index`.

The application runtime and OG card generator mirror that membrane: only published records appear in the collection index, autocomplete, static params, slug lookup, and `/og/<slug>.png` assets.
