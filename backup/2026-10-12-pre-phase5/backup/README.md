# Snapshots

Pristine copies of the app taken **before** each roadmap phase in `docs/IMPROVEMENT_PLAN.md`, so a
phase can be rolled back without reading git history.

Each folder is a full copy of `index.html`, `src/` and `docs/` as it stood at that moment.
`<date>-pre-<phase>` names the phase it protects. These are dead copies — never edit them, and
never add code here expecting it to run (GitHub Pages does serve them at `/backup/...`).
