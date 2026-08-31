# Index projection

The collection homepage renders a compact **index projection** derived from each genealogy record. The projection is not a second source of truth: it summarizes evidence-backed assertions already present in the record.

## Earliest column

`index.earliest` identifies the `EARLIEST_VERIFIED_OCCURRENCE` assertion that justifies the displayed earliest label within the record's stated search scope.

Other roles (`POPULARIZED_BY`, `ANTECEDENT`, `CLAIMED_COINAGE`, `MISATTRIBUTED_TO`, `CONTESTED_INCOMPLETE`) may appear in the record, but they must not be bound as `index.earliest.assertionId`.

The `date` object uses proleptic Gregorian years. `startYear` is the sort key. `display` is the human-readable margin label and may use decade or circa precision. The date must be coherent with the bound earliest-occurrence assertion.

## Verdict column

`index.verdict` is an evidentiary conclusion, not the editorial lifecycle `status` field.

Allowed values:

- `direct_coinage`
- `claimed_coinage`
- `popularized`
- `misattributed`

`index.verdictAssertionId` must point at the assertion that justifies the verdict:

| Verdict | Bound assertion |
| --- | --- |
| `direct_coinage` | `CLAIMED_COINAGE`, `supportKind=direct`, at least one primary source |
| `claimed_coinage` | `CLAIMED_COINAGE`, `supportKind` in `supporting` / `contested` / `incomplete` |
| `popularized` | `POPULARIZED_BY`, `supportKind` not `incomplete` |
| `misattributed` | `MISATTRIBUTED_TO` |

## Publication rule

Records with lifecycle status `provisional` or `reviewed` must include a complete `index` object. Draft, superseded, and withdrawn records must not include `index`.

The application runtime mirrors that membrane: only published records appear in the collection index, autocomplete, static params, and direct slug lookup.
