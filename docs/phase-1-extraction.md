# Phase 1 extraction

This repo currently contains the first generalized slice of the workbench:

- `scripts/gemini-ui-review.mjs`
  - persists Gemini sessions
  - supports inspect-only contract checks from disk
- `scripts/gemini-pack-apply.mjs`
  - extracts implementation packs from saved sessions
  - applies deterministic gates before optional writes
- `tests/workbench.test.mjs`
  - validates the synthetic example end to end

Deferred to later phases:
- richer policy presets
- authenticated screenshot capture
- stronger pack schema/versioning
- example demo app
