# Social Preview

This repo ships with a checked-in GitHub social preview asset at `assets/social-preview.png`.

The current asset is generated with Gemini from a constrained spec:
- title: `Gemini UI Workbench`
- subtitle: `UI review • pack gating • authenticated capture`
- visual structure: three workflow blocks (`Review`, `Gate`, `Capture`)

## Regenerate

Run:

```bash
SKILL_DIR="/Users/mitchellbosley/.codex/skills/public/gemini-infographic-genai"
uv run "$SKILL_DIR/scripts/generate_infographic_image.py" \
  --spec-file assets/social-preview-spec.md \
  --output-png assets/social-preview.png \
  --text-density strict \
  --image-size 2K \
  --language English \
  --style "clean, modern, dark GitHub-ready product card with crisp typography and strong hierarchy"
```

The command overwrites `assets/social-preview.png`.

## GitHub upload

GitHub does not expose a reliable CLI path here for setting a repository social preview image directly from this repo. The current operational path is manual:

1. Open the repository settings page.
2. Go to `Settings -> General -> Social preview`.
3. Upload `assets/social-preview.png`.

Current target repo:

- `https://github.com/mbosley/gemini-ui-workbench`
