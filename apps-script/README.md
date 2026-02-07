# Apps Script Backend

This folder contains the Google Apps Script code that receives attendance submissions from the GitHub Pages site and writes them into a Google Sheet.

## Sheet setup
Create a Google Sheet with these tabs:
- `Attendance`
- `Summary`

The script will create the tabs if they don't exist, but starting with them is simplest.

## Install
1. In Google Drive: open the sheet.
2. Extensions → Apps Script.
3. Replace the default code with `apps-script/Code.gs`.

## Configure password
The backend validates the submit password using a script property.

1. In Apps Script: Project Settings → Script Properties.
2. Add:
   - Key: `SUBMIT_PASSWORD`
   - Value: `WHS11`

## Deploy as Web App
1. Deploy → New deployment.
2. Select type: Web app.
3. Execute as: **Me**
4. Who has access: **Anyone** (or "Anyone with the link")
5. Deploy, then copy the Web app URL.

## Connect frontend
Edit `app.js` and set:
- `APPS_SCRIPT_WEBAPP_URL` to the Web app URL you copied.

## Attendance sheet format
`Attendance` is formatted like this:
- Row 1: Athlete IDs (columns grouped by grade 9–12)
- Row 2: Athlete names
- Row 3: Athlete grades
- Rows 4+: one row per date (YYYY-MM-DD) with `Yes/No` values across athlete columns
- Bottom: `Totals (auto)` section with per-athlete Present/Absent totals (always below the daily entries)
