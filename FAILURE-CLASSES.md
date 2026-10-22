# Failure classes

Standing rule, confirmed by the repository owner: for every failure or bug, analyze the root cause, generalize it into a failure class, and update the docs so it cannot recur.

Each entry has:

- **Symptom:** what was observed.
- **Root cause:** why it happened, as recorded in the cited source.
- **General class:** the wider family of failures this belongs to.
- **Rule going forward:** what we do from now on.
- **Guard:** a named test or check that catches the whole class, cited by file path and test name. If none exists, the entry says **GAP** and gives a one-line suggestion. A guard that only covers the original instance is marked GAP (instance-only).
- **Source:** where the failure is documented (file path, PR, or commit).

Status: author draft. This file has not been reviewed or accepted. Entries describe only documented failures; nothing here is inferred beyond the cited sources.

## Scope of this pass

Mined on 2026-10-22: tracked closeout and records files (runs/*, CLOSEOUT*, DELIVERY*, REPAIR*, review receipts, LIMITATIONS*), pull request descriptions, issues, and fix-commit messages on the default branch. Fix commits whose messages do not state a cause were not turned into entries. This pass is bounded, not exhaustive; add entries as older failures are rediscovered.

## Invariants live runs must prove

1. Launch, publication and deployment stay unauthorized (README).
2. `npm run verify`, `npm run guard:all` and `npm run test:e2e` pass before any readiness claim (README).
3. Seeds are never counted as qualified propagation (issue #2).

## Entries

No failures are recorded yet in the sources mined for this pass. Add the first entry when a failure or bug is found, using the template below.

## Template for new entries

```markdown
### FC-NN. Short title

- **Symptom:**
- **Root cause:**
- **General class:**
- **Rule going forward:**
- **Guard:** `path/to/test_file` :: `test_name` (or GAP: one-line suggestion)
- **Source:** file path, PR, or commit
```
