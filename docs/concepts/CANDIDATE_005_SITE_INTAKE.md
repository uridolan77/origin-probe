# Candidate 005 — site intake report

Sanitized transformation boundary for the Origin product site. The raw research package is **not** part of the web build.

## Package identity

| Field | Value |
|-------|-------|
| Package ID | `ORIGIN-CONCEPT-GENEALOGIES-100-CANDIDATE-005` |
| Disposition | `PASS_V005_CONTRACT_AND_PARTIAL_REAL_PILOT` |
| Product publication authorized | **No** |
| Delivery ZIP SHA-256 | `3f04b12ef5ad712af25673fccda0b06a521f7c0bdf5661eafc01be277e0c9919` |
| Public canonical domain | Bound at deploy time to the Origin custom host (see product launch evidence); not restated as a clean-room literal here |

Authoritative receipts used (sealed delivery naming):

- `PACKAGE_INDEX.json`
- `ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE_005_ROOT_TRUST_RECEIPT.json`
- `reports/VALIDATION_REPORT.json`

## Nested artifact digests (verified)

| Artifact | SHA-256 | Bytes |
|----------|---------|-------|
| `ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE_005_ARTIFACT.zip` | `a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814` | 164484 |
| `ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE_005_C092_PILOT_WORKSPACE.zip` | `74ace215ecc436399e5f57da0b4e1b4ad6d61672a3025a8e930ff679c5d209d0` | 10132 |
| `ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE_005_TRUSTED_VERIFIER.zip` | `c93857ac4a8031b3b5b3e0cdaef0f19bc5993a9e1297a82d1afc4b88401a25b3` | 79089 |
| Root trust receipt | `67759c9e5892fca9c33e493a1c645753eb1e746409223db7d903ed951c54b641` | 1164 |
| Package index | `3cbff9b5c66f2f5b2d85f74dc455362a18996d49dde12452a1dd7b3b7748d4c7` | 2327 |
| Validation report | `fa104005685dc8b6ee58185e63c9ca66ca87ad26e6dc1c00276c83739552c155` | 6076 |

## Counts at intake

| Metric | Value |
|--------|-------|
| Catalog records | 100 |
| Accepted assertions | 0 |
| Published concept dossiers | 0 |
| C092 public state | Partially verified — no public finding |
| Product publication ready | false |

## Transformation boundary

**Allowed into the product repository:**

- Neutral catalog metadata only (`data/concepts/catalog.json` + receipt)
- Signed site publication bundles of kind `origin_site_concept_publication_v1` (none at intake)
- Product schemas, importers, guards, and UI that render catalog / accepted dossiers
- AES-256-GCM encrypted custody blobs under `data/concepts/custody/*.zip.enc` (ciphertext only; passphrase lives in the GitHub `publication-trust` environment)

**Excluded from the product repository and web build:**

- Candidate 005 delivery / artifact / workspace / trusted-verifier ZIPs in plaintext
- Research workspaces and TASK_GRAPH / ROLE_AUDIT_QUEUE raw graphs
- Candidate assertion prose and unaccepted historical claims
- Fixture private keys and trusted-verifier executables
- Internal review-event ledgers

## Sealed catalog custody (CI witness)

Controlling digests are GitHub Environment variables on `publication-trust` (not inline workflow YAML):

| Variable | Value |
|----------|-------|
| `CANDIDATE_005_ARTIFACT_SHA256` | `a2e463e0b134b4ed49ebb6cced8d0bf1afbb2dcf5780568d7e66ac31299d6814` |
| `CANDIDATE_005_C092_ZIP_SHA256` | `74ace215ecc436399e5f57da0b4e1b4ad6d61672a3025a8e930ff679c5d209d0` |

Environment secret:

| Secret | Purpose |
|--------|---------|
| `CANDIDATE_005_CUSTODY_PASSPHRASE` | Decrypts committed `*.zip.enc` custody blobs |

Operator encrypt (local only; never commit the passphrase):

```bash
export CANDIDATE_005_CUSTODY_PASSPHRASE='...'
node tools/encrypt-custody-artifacts.mjs \
  --artifact-zip /path/to/ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE_005_ARTIFACT.zip \
  --c092-zip /path/to/ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE_005_C092_PILOT_WORKSPACE.zip
```

Hosted witness: manually dispatch the `verify-sealed-catalog` job. It fails closed when passphrase or digest vars are absent, decrypts, verifies digests, rebuilds the catalog, and compares rebuilt `catalog.json` / `catalog-receipt.json` to the committed tree.

## Source filenames (logical)

- Delivery envelope: `ORIGIN_CONCEPT_GENEALOGIES_100_CANDIDATE_005_DELIVERY.zip`
- Nested: ARTIFACT, C092_PILOT_WORKSPACE, TRUSTED_VERIFIER, ROOT_TRUST_RECEIPT, REVIEW_SYNTHESIS, PACKAGE_INDEX, reports/*

Extraction and verification occur outside `origin-probe`. Production code imports only sanitized catalog and publication outputs under `data/concepts/`.
