# WHS Track & Field Attendance Tracker (GitHub Pages + Google Sheets)

Static GitHub Pages “app” for taking attendance, backed by Google Sheets via a Google Apps Script Web App.

## How it works
- `roster.json` (in this repo) defines athletes with a stable `id`.
- The site loads the roster, defaults everyone to **Yes**, and lets you toggle **Yes/No**.
- Clicking **Submit** prompts for a password and POSTs the attendance to an Apps Script endpoint.
- Apps Script validates the password, writes/overwrites the row for that date, highlights absences red, keeps columns grouped by grade (9–12), and writes per-athlete aggregates as a totals section at the bottom.

## Files
- `index.html` / `style.css` / `app.js`: the GitHub Pages frontend
- `roster.json`: roster source of truth (edit this as athletes change)
- `apps-script/Code.gs`: Apps Script backend (deploy as Web App)

## Setup (high level)
1. Edit `roster.json` with your real roster.
2. Create a Google Sheet with tabs named `Attendance` and `Summary` (or update the script constants).
3. Paste `apps-script/Code.gs` into a new Google Apps Script project bound to the sheet.
4. Set a script property for the submit password (documented in `apps-script/Code.gs`).
   - Set `SUBMIT_PASSWORD` to `WHS11`.
5. Deploy the Apps Script as a Web App and copy the Web App URL.
6. Paste that URL into `app.js` as `APPS_SCRIPT_WEBAPP_URL`.
7. Enable GitHub Pages for the repo.

## Important security note
GitHub Pages is public. The password must be validated by Apps Script (server-side). The frontend prompt is only a UI gate and can be bypassed if the backend doesn’t check.
