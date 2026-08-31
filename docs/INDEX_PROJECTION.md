# Index projection

The collection homepage renders a compact **index projection** derived from each genealogy record. The projection is not a second source of truth: it summarizes evidence-backed assertions already present in the record.

## Earliest column

`index.earliest` identifies the assertion that justifies the displayed earliest label within the record's stated search scope.

Usually this is an `EARLIEST_VERIFIED_OCCURRENCE` assertion. When no such assertion exists, the index may reference:

- `POPULARIZED_BY` when the label reflects the popularization trail
- `ANTECEDENT` when the label reflects a related earlier passage
- `CLAIMED_COINAGE` when the label reflects an inspectable coinage date

The `date` object uses proleptic Gregorian years. `startYear` is the sort key. `display` is the human-readable margin label and may use decade or circa precision.

## Verdict column

`index.verdict` is an evidentiary conclusion, not the editorial lifecycle `status` field.

Allowed values:

- `direct_coinage`
- `claimed_coinage`
- `popularized`
- `misattributed`

Each verdict must be consistent with assertion roles in the same record (for example, `misattributed` requires a `MISATTRIBUTED_TO` assertion).

## Publication rule

Records with lifecycle status `provisional` or `reviewed` must include a complete `index` object. Draft, superseded, and withdrawn records must not include `index`.
