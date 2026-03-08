# Phase 3 fixture integration

This phase makes the capture tool integration-testable end to end.

## Added

- `scripts/fixture-auth-app.mjs`
  - tiny local auth app with login, protected route, and bootstrap endpoint
- `tests/capture-integration.test.mjs`
  - runs the real capture script against the fixture app and verifies a screenshot file is produced
- `npm run smoke:capture-e2e`
  - targeted integration smoke for the capture path

## Validation

- `npm test`
- `npm run smoke:inspect`
- `npm run smoke:gate`
- `npm run smoke:capture-plan`
- `npm run smoke:capture-e2e`

## Notes

The fixture app is intentionally minimal and synthetic. It exists to validate the capture contract without depending on any private product surface.
