# App Concepts — WHS Track & Field Attendance Tracker

## Problem
Track & field attendance is often recorded inconsistently (paper sheets, texts, scattered spreadsheets). Coaches need a reliable way to record daily attendance, review history, and export summaries for eligibility and communication.

## Proposed Architecture (GitHub Pages + Google Sheets)
- **Frontend**: a GitHub Pages–hosted static site that shows the roster and lets a coach toggle attendance (`Yes/No`) for each athlete, then submit the whole day at once.
- **Backend**: a **Google Apps Script Web App** endpoint that receives the submitted attendance payload and writes it into a **Google Sheet**.
- **Data store**: Google Sheets is the source of truth (daily log + aggregates).
- **Roster source**: a static `roster.json` file in this repo.
- **Athlete identity**: each athlete has a stable `id` (do not use names as keys).

## Goals
- Fast attendance taking (≤ 2 minutes for a typical practice)
- Accurate history per athlete and per date
- Easy exports (CSV) and simple summaries (weekly/monthly)
- Minimal setup and low maintenance

## Non-Goals (for MVP)
- Complex role-based permissions
- Full athlete management suite (medical forms, payments, etc.)
- Live multi-device synchronization (unless it’s required)

## Primary Users
- Head coach (admin-like tasks, exports, roster maintenance)
- Assistant coaches (quick attendance entry)

## Core Concepts
- **Athlete**: stable `id`, name, grade, group/event (optional fields beyond `id` + `name`)
- **Roster**: active athletes for the season
- **Session**: a dated practice/meet with an attendance status per athlete
- **Attendance status**: for MVP, `Yes/No` (present/absent)
- **Notes**: optional per athlete per session

## MVP Feature Set
- Roster display (from `roster.json`) and quick toggles per athlete
- Create a session for a date (default: today) and mark `Yes/No` quickly
- Search/filter roster (grade, group/event, name)
- Submit attendance to Apps Script in one request (with a password required to submit)

## Nice-to-Have Features
- Templates: “Mon/Wed/Fri practice” pre-filled sessions
- Bulk actions: mark all Present, then adjust exceptions
- Quick “Late” timestamp or minutes-late field
- Injured list view and return-to-practice tracking
- Printed sign-in sheet generator (backup mode)
- QR code check-in (athletes scan and self-check in)

## UX Flow (MVP)
1. Open app → select date (defaults to today)
2. Roster list with filters + search
3. Tap/click athlete to toggle `Yes/No`
4. Submit attendance
5. Confirm saved (and show a quick summary)

## Google Sheet Behavior (Concept)
- **Daily entry (not aggregated)**: one row per date; a re-submit for the same date overwrites that date’s row.
- **Absent highlighting**: absent cells are highlighted red for fast scanning later.
- **Grade separation**: athlete columns are grouped by grade (9–12) to keep the sheet readable.
- **Aggregates**: per-athlete totals (present vs absent) are written as the last section at the bottom of the `Attendance` sheet (and optionally also in a `Summary` tab).

## Google Sheet Layout (Recommended)
- Sheet `Attendance`
  - Row 1: headers with athlete IDs (stable)
  - Row 2: headers with athlete names (display)
  - Row 3: headers with athlete grade (9–12)
  - Column A: `Date` (YYYY-MM-DD)
  - Rows 4+: one row per date, with `Yes/No` values across athlete columns
  - After the last date row: **Totals (auto)** section with per-athlete present/absent totals
- Sheet `Summary` (optional)
  - One row per athlete ID with present/absent totals computed from `Attendance` (helpful for exports)

## Data & Storage Options
### Option A: Local-first (simplest)
- Store data in a local file (e.g., SQLite or JSON) on one coach computer.
- Pros: simple, fast, works offline
- Cons: sharing/sync is manual

### Option B: Cloud-first
- Store in a hosted DB; login required.
- Pros: multi-device, better backups
- Cons: more setup/cost/complexity

### Option C: Spreadsheet-backed
- Use Google Sheets as the database; app/scripts as the UI.
- Pros: familiar, easy sharing, built-in backup/history
- Cons: performance/structure limits, API complexity

## Security / Access Control (Important for GitHub Pages)
- GitHub Pages is public by default. A “password prompt” in the UI is not sufficient by itself (it can be bypassed).
- The Apps Script endpoint must validate the submitted password (or secret) before writing to the sheet.

## Reporting Ideas
- Weekly attendance % per athlete
- Absence count (unexcused vs excused)
- Eligibility flag rules (configurable thresholds)
- Export formats: CSV, printable PDF summary

## Risks / Unknowns
- What “source of truth” the team prefers (Sheets vs app database)
- Required access patterns (single device vs multi-coach vs athletes self-check-in)
- Privacy expectations (student data handling)

## Decisions To Make (Answer These First)
- Platform: web/desktop/spreadsheet-backed
- Roster source: hardcoded JSON, Google Sheet roster tab, or a separate roster file
- Athlete identifier: name only vs stable ID (recommended)
- Access control: how the Apps Script validates submissions
- Sheet layout: daily log orientation + aggregates layout

## Decisions Made (Current)
- Platform: GitHub Pages static site
- Roster source: static `roster.json` in repo
- Athlete identifier: stable ID
- Daily log: one row per date; re-submit overwrites
- Submit gating: password required and validated by Apps Script
