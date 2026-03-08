# Social Preview

This repo ships with a checked-in GitHub social preview asset at `assets/social-preview.png`.

The asset is intentionally simple:
- title: `Gemini UI Workbench`
- subtitle: `UI review • pack gating • authenticated capture`
- visual structure: three workflow blocks (`Review`, `Gate`, `Capture`)

## Regenerate

Run:

```bash
python3 scripts/generate-social-preview.py
```

The script overwrites `assets/social-preview.png`.

## GitHub upload

GitHub does not expose a reliable CLI path here for setting a repository social preview image directly from this repo. The current operational path is manual:

1. Open the repository settings page.
2. Go to `Settings -> General -> Social preview`.
3. Upload `assets/social-preview.png`.

Current target repo:

- `https://github.com/mbosley/gemini-ui-workbench`
