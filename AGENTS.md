# AGENTS.md

## Scope

This repo is the clean public-facing workbench for Gemini-first UI review and implementation-pack gating.

## Working rules

- Keep the repo generic; do not add project-specific screenshots, route names, or session dumps from private apps.
- Prefer synthetic fixtures under `examples/` and deterministic tests under `tests/`.
- Treat `scripts/` as the canonical tool entrypoints.
- Keep `README.md` and `LOG.md` current when interfaces change.

## Validation

- Run `npm test` before closing a coherent slice.
- Run the smoke commands in `README.md` when changing the CLI contract.

## Boundaries

Do not copy private Gemini sessions, private screenshots, or product-specific governance docs into this repo.
Generalize behavior and interfaces instead.
