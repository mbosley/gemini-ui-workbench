# Gemini UI Workbench

> Legacy compatibility repo. Canonical development now lives in [`mbosley/gemini-studio`](https://github.com/mbosley/gemini-studio) under `packages/ui-workbench`.

`gemini-ui-workbench` is a small tool repo for Gemini-first UI workflows.

It is built around one repeatable loop:
- assemble a design packet
- persist the Gemini session
- inspect the returned implementation pack from disk
- gate the pack before writing files
- capture authenticated screenshots for critique and verification

This repo is the software half of that workflow. The runbook/policy half lives separately as the `gemini-frontend-studio` skill.

## What it includes

- `scripts/gemini-ui-review.mjs`
  - runs or inspects Gemini UI review sessions
  - persists session artifacts under `.gemini-sessions/`
  - performs contract checks against the last model turn

- `scripts/gemini-pack-apply.mjs`
  - extracts implementation packs from saved sessions
  - validates file maps, required files, imports, API references, and path boundaries
  - optionally applies the pack only after gates pass

- `scripts/capture-authenticated-route.mjs`
  - captures authenticated screenshots for UI review
  - supports configurable login selectors, optional bootstrap requests, optional seed scripts, and storage-state reuse

- `scripts/fixture-auth-app.mjs`
  - runs a tiny synthetic auth app for end-to-end capture testing

- `assets/social-preview-spec.md`
  - the Gemini generation spec for the repository social preview image

## Why this exists

A lot of UI-design workflows break down because they rely on chat-only output, ad hoc copy/paste, or ungated code application.

This repo is intended to make the workflow more reliable:
- sessions are persisted to disk
- implementation packs are inspectable before use
- file writes are gated deterministically
- screenshot capture is testable end to end against a synthetic fixture

## Quick start

Install dependencies:

```bash
npm install
```

Run the synthetic validation path:

```bash
npm test
npm run smoke:inspect
npm run smoke:gate
npm run smoke:capture-plan
npm run smoke:capture-e2e
```

## Synthetic example

The repo ships with one minimal synthetic implementation-pack example:

- session: `.gemini-sessions/synthetic-demo.json`
- expected file: `src/components/Hero.tsx`
- bootstrap template: `examples/synthetic-pack/bootstrap-user.json`

This keeps the repo runnable without publishing private screenshots, private sessions, or app-specific route contracts.

## Repo layout

- `.gemini-sessions/` — saved synthetic or local session artifacts
- `scripts/` — canonical CLI tools
- `examples/` — synthetic fixtures only
- `tests/` — deterministic tests, including the end-to-end capture test
- `docs/` — extraction notes and usage docs
- `assets/` — checked-in social preview and other lightweight public repo assets

## Boundaries

In scope:
- generic Gemini session handling
- generic implementation-pack gating
- generic authenticated screenshot capture
- synthetic examples and fixture apps

Out of scope:
- app-specific governance docs
- private screenshots or private session dumps
- product-specific policy presets
- direct copies of client or product UI artifacts
