# Origin

Phrase-genealogy research probe (static export).

> Who coined it, who made it famous, and what came before?

## Status

```text
LAUNCH_AUTHORIZED=false
PUBLICATION_AUTHORIZED=false
DEPLOYMENT_AUTHORIZED=false
```

Launch, publication, and deployment are unauthorized. See `LAUNCH_READINESS.md`.

## Local setup

```bash
npm ci
npm run verify
npm run build
npm run start
```

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run guard:all
npm run build
npm run test:e2e
```

## Launch readiness

Launch is unauthorized. Do not deploy, publish, or open the repository publicly from this candidate.
