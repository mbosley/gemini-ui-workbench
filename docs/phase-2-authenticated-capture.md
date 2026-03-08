# Phase 2 authenticated capture

This phase adds the screenshot companion tool for the Gemini-first UI workflow.

## Added

- `scripts/capture-authenticated-route.mjs`
  - generic authenticated screenshot capture
  - configurable login labels/selectors
  - optional bootstrap request with JSON templating
  - optional seed script execution
  - dry-run mode for deterministic validation

- `docs/authenticated-capture.md`
  - usage examples and workflow notes

- `examples/synthetic-pack/bootstrap-user.json`
  - synthetic bootstrap template fixture

## Validation

- `npm test`
- `npm run smoke:capture-plan`

## Deferred

- reusable storage-state helpers
- richer interaction macros beyond click/hover/tap
- example app/service for full capture integration testing
