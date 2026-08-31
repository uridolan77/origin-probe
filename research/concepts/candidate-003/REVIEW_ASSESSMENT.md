# Candidate 002 reviews — assessment and applied disposition

## Final assessment

The reviews correctly identified a release-validation failure and several content-quality failures. Candidate 002 is retained as evidence of the schema transition but is superseded by Candidate 003 for all further work.

### Accepted and applied

- The Candidate 002 instance fails its own Draft 2020-12 schema because `selectionRubric` is closed without declaring its five properties.
- The validator did not load the schema, ignored command-line paths, hard-coded 441 assertions, and parsed checksum manifests fail-open.
- Four records contained single-letter or truncated claims: C010, C032, C081, and C086.
- 376/441 assertions lacked evidence links; all existing evidence was only research-lead quality.
- `subjects` and `namedAnchors` were exactly duplicated on all assertions.
- Contest relations were modeled in prose but no graph edges existed.
- The acceptance policy required named review but the data model could not represent review events.
- Several roles were misapplied, including C049-A03, C066-A05, C071-A06, C092-A01, and C094-A01.
- One constant `entryKind: concept` was inadequate for a heterogeneous research corpus.
- Markdown generation was not part of the sealed package.

### Qualified rather than adopted wholesale

- A complete RDF/CIDOC/PROV migration is not required to close Candidate 003. The authoring format remains strict JSON, while interoperability remains a later export concern.
- Source attachment is not fabricated for all 441 candidate assertions. Every unsourced assertion now carries an explicit source gap and cannot advance; sourced and accepted states are conditionally enforceable.
- The proposed person/work/passage entity graph is partially implemented through `objectKind`, structured temporal data, sources, evidence items, and assertion relations. Full entity normalization is deferred until the first verified pilot demonstrates the needed granularity.
- The six-dimensional confidence proposal is adopted as a structured confidence object, but values remain unknown unless evidence supports them.

### Rejected or held as unverified research leads

- The sealed Candidate 002 delivery does contain `SHA256SUMS`; the actual defect was the fail-open parser, not file absence.
- German penal-law antecedents to the trolley problem were not added because the supplied review relied on weak secondary web sources and the claim requires specialist verification.
- Punch/Froidmont, Chalybäus edition priority, and the 1941/1945 Kierkegaard translation date remain explicitly provisional rather than promoted as settled history.

## Candidate 003 boundary

Candidate 003 is an internal, validated research queue only. It has zero accepted assertions, null publication views, and no product, publication, deployment, measurement, merge, or remote-authorization effect.
