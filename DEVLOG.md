# Dev Log - WHS Track & Field Attendance Tracker

This log captures day-to-day development notes: what changed, why it changed, and what's next.

## 2026-02-07

### Started
- Created initial documentation scaffolding: `DEVLOG.md` and `APP_CONCEPTS.md`.
- Clarified concept: GitHub Pages UI -> Google Apps Script Web App -> Google Sheets (daily log + aggregates + absent highlighting).
- Confirmed requirements:
  - Roster source: static `roster.json`
  - Stable athlete IDs
  - One row per date; re-submit overwrites
  - Submit requires a password (validated by Apps Script)

### Current Focus
- Define the first usable version (MVP) and the simplest workflow for coaches.

### Open Questions
- Apps Script endpoint URL (once deployed).
- Final `roster.json` fields (minimum `id` + `name`; optional grade/group).
- Exact Google Sheet names (default: `Attendance` and `Summary`).

### Next Steps
- Implement GitHub Pages UI that reads `roster.json`, toggles `Yes/No`, and submits with a password.
- Implement Apps Script Web App that validates password, overwrites by date, highlights absences, and recomputes aggregates.
