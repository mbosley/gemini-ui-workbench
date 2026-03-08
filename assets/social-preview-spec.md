# Social preview spec

## 1) Project context

- Project: Gemini UI Workbench
- Document or chapter: GitHub repository social preview card
- Stakeholder context: public GitHub visitors, collaborators, and profile viewers
- What this visual must help decide: whether this repo is a real reusable tool for Gemini-first frontend workflows

## 2) Audience and use setting

- Primary audience: technical GitHub users evaluating the repository quickly
- Secondary audience: collaborators and potential adopters of the workflow
- Display mode, screen, print, slide: GitHub social preview card, desktop and mobile share surfaces
- Time available to read: under 5 seconds

## 3) Core message hierarchy

- Primary message: Gemini UI Workbench is a polished tool repo for Gemini-first frontend workflows
- Secondary message: the workflow has three clear stages: Review, Gate, Capture
- Tertiary message: the repo is modern, technical, minimal, and trustworthy

## 4) Must-include evidence

1. repo name
- value or claim: Gemini UI Workbench
- unit and time reference: repo title, current
- source tag: repo-name
- confidence level: high

2. workflow subtitle
- value or claim: UI review • pack gating • authenticated capture
- unit and time reference: current workflow summary
- source tag: workflow-summary
- confidence level: high

3. tool framing
- value or claim: Tools for Gemini-first frontend workflows
- unit and time reference: current repo positioning
- source tag: repo-positioning
- confidence level: high

4. workflow blocks
- value or claim: Review, Gate, Capture
- unit and time reference: current workflow stages
- source tag: workflow-stages
- confidence level: high

## 5) Must-not-lose constraints

- Non-negotiable terms: Gemini UI Workbench; Review; Gate; Capture
- Terms to avoid: dashboards, enterprise platform, analytics suite, marketing buzzwords
- Sensitive wording constraints: do not imply private screenshots, client work, or proprietary app surfaces

## 6) Visual architecture

- Preferred structure, flow, matrix, timeline, pyramid: wide GitHub social card with bold title area on left and three stacked workflow blocks on right
- Dominant focal element: large repo title on left
- Supporting blocks: short subtitle, short one-line framing, three right-side stage blocks
- Relative emphasis order: title, subtitle, three workflow blocks, one-line framing

## 7) Text policy

- Text density, strict, balanced, rich: strict
- Max visible words target: 22
- Max words per label target: 5
- Language: English

## 8) Style and accessibility

- Desired tone: modern, calm, technical, polished, minimal
- Color constraints: dark navy or charcoal background with one violet accent and optional teal/cyan support accents
- Accessibility constraints, contrast, colorblind-safe: high contrast text, large readable type, no tiny footer text, no low-contrast decorative gradients

## 9) Footer and source line

- Exact footer source text: github.com/mbosley/gemini-ui-workbench
- Caveat text, if required: none

## 10) Generation constraints

- Model: gemini-3-pro-image-preview
- Image size: 2K
- Master anchor image path: none
- Master anchor lock, fixed across reruns, yes or no: no
- Bootstrap mode, no anchor yet, yes or no: yes
- First-pass only, yes or no: yes
- Revision budget, max runs: 2
- No-edit-chain rule enabled, yes or no: yes

## 11) Revision focus, only if needed

- What is wrong in current image: n/a
- What must stay unchanged: repo title, workflow subtitle, three-stage structure, dark technical tone
- What to change precisely: n/a
- Confirm rerun uses the same master anchor and not a generated draft: yes
