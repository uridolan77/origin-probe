# Future concept measurement events (disabled)

This note records a proposed concept-specific analytics contract. It is **not** bound to the live measurement service and must not emit events from concept pages in the current product.

## Proposed events (unbound)

- `concept_catalog_view` — index visit; not a phrase result view
- `concept_dossier_view` — published concept dossier only
- `concept_research_page_view` — unpublished research-status page

## Explicit non-goals

- Do not add concept slugs to phrase `ALLOWED_SLUGS`
- Do not emit `qualified_result_view` from concept routes
- Do not reuse `ResultViewBeacon` on concept pages
- Do not alter active run IDs, thresholds, seeds, or denominator logic

Activation requires a separate signed measurement-contract change.
