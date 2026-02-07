const CONFIG = {
  attendanceSheetName: "Attendance",
  summarySheetName: "Summary",
  idHeaderRow: 1,
  nameHeaderRow: 2,
  gradeHeaderRow: 3,
  firstDataRow: 4,
  dateColumn: 1,
  firstAthleteColumn: 2,
  submitPasswordPropertyKey: "SUBMIT_PASSWORD"
};

function doGet() {
  return jsonResponse_({ ok: true, message: "Attendance endpoint is running." });
}

function doPost(e) {
  try {
    const payload = parseJsonPayload_(e);
    validatePayload_(payload);

    const expectedPassword = PropertiesService.getScriptProperties().getProperty(
      CONFIG.submitPasswordPropertyKey
    );
    if (!expectedPassword) {
      return jsonResponse_({
        ok: false,
        error:
          "Server not configured. Set script property SUBMIT_PASSWORD before using this endpoint."
      });
    }

    if (payload.password !== expectedPassword) {
      return jsonResponse_({ ok: false, error: "Invalid password." });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const attendanceSheet = getOrCreateSheet_(ss, CONFIG.attendanceSheetName);
    const summarySheet = getOrCreateSheet_(ss, CONFIG.summarySheetName);

    ensureAttendanceSheetHeaders_(attendanceSheet, payload.athletes);
    reorderAthleteColumnsByGrade_(attendanceSheet, payload.athletes);
    ensureAbsentConditionalFormatting_(attendanceSheet);

    const upsertResult = upsertAttendanceRow_(attendanceSheet, payload.date, payload.athletes);
    const totals = recomputeSummary_(attendanceSheet, summarySheet, payload.athletes);
    writeTotalsSection_(attendanceSheet, totals);

    return jsonResponse_({
      ok: true,
      message: upsertResult.updated ? "Updated existing date." : "Added new date.",
      date: payload.date
    });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function parseJsonPayload_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== "string") {
    throw new Error("Missing request body.");
  }

  let obj = null;
  try {
    obj = JSON.parse(e.postData.contents);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
  return obj;
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid payload.");
  if (!payload.date || typeof payload.date !== "string") throw new Error("Missing date.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error("Date must be YYYY-MM-DD.");
  if (typeof payload.password !== "string" || !payload.password) throw new Error("Missing password.");
  if (!Array.isArray(payload.athletes) || payload.athletes.length === 0)
    throw new Error("Missing athletes array.");

  const seen = {};
  for (const a of payload.athletes) {
    if (!a || typeof a !== "object") throw new Error("Invalid athlete entry.");
    if (!a.id || typeof a.id !== "string") throw new Error("Athlete missing id.");
    if (!a.name || typeof a.name !== "string") throw new Error("Athlete missing name.");
    if (a.grade != null && typeof a.grade !== "number") throw new Error(`Athlete ${a.id} invalid grade.`);
    if (typeof a.present !== "boolean") throw new Error(`Athlete ${a.id} missing present boolean.`);
    if (seen[a.id]) throw new Error(`Duplicate athlete id in payload: ${a.id}`);
    seen[a.id] = true;
  }
}

function getOrCreateSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  return ss.insertSheet(name);
}

function ensureAttendanceSheetHeaders_(sheet, athletes) {
  const idRow = CONFIG.idHeaderRow;
  const nameRow = CONFIG.nameHeaderRow;
  const gradeRow = CONFIG.gradeHeaderRow;

  sheet.getRange(idRow, CONFIG.dateColumn).setValue("Date");
  sheet.getRange(nameRow, CONFIG.dateColumn).setValue("");
  sheet.getRange(gradeRow, CONFIG.dateColumn).setValue("");

  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.firstAthleteColumn);
  const existingIds = sheet.getRange(idRow, CONFIG.firstAthleteColumn, 1, lastCol - 1).getValues()[0];

  const idToCol = {};
  for (let i = 0; i < existingIds.length; i++) {
    const id = String(existingIds[i] || "").trim();
    if (!id) continue;
    idToCol[id] = CONFIG.firstAthleteColumn + i;
  }

  let colCursor = lastCol + 1;
  for (const a of athletes) {
    if (idToCol[a.id]) continue;
    sheet.getRange(idRow, colCursor).setValue(a.id);
    sheet.getRange(nameRow, colCursor).setValue(a.name);
    sheet.getRange(gradeRow, colCursor).setValue(a.grade == null ? "" : a.grade);
    idToCol[a.id] = colCursor;
    colCursor += 1;
  }

  // Keep names in sync for known IDs
  for (const a of athletes) {
    const col = idToCol[a.id];
    if (!col) continue;
    sheet.getRange(nameRow, col).setValue(a.name);
    sheet.getRange(gradeRow, col).setValue(a.grade == null ? "" : a.grade);
  }

  sheet.setFrozenRows(CONFIG.gradeHeaderRow);
  sheet.setFrozenColumns(1);
}

function reorderAthleteColumnsByGrade_(sheet, athletes) {
  const idRow = CONFIG.idHeaderRow;

  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.firstAthleteColumn);
  const existingIds = sheet
    .getRange(idRow, CONFIG.firstAthleteColumn, 1, lastCol - 1)
    .getValues()[0]
    .map((v) => String(v || "").trim());

  const athleteById = {};
  for (const a of athletes) athleteById[a.id] = a;

  const desiredIds = existingIds
    .filter((id) => id)
    .slice()
    .sort((a, b) => {
      const aa = athleteById[a] || null;
      const bb = athleteById[b] || null;
      const ga = aa && typeof aa.grade === "number" ? aa.grade : 999;
      const gb = bb && typeof bb.grade === "number" ? bb.grade : 999;
      if (ga !== gb) return ga - gb;
      const na = (aa && aa.name ? aa.name : "").toString();
      const nb = (bb && bb.name ? bb.name : "").toString();
      const c = na.localeCompare(nb);
      if (c !== 0) return c;
      return a.localeCompare(b);
    });

  for (let i = 0; i < desiredIds.length; i++) {
    const targetCol = CONFIG.firstAthleteColumn + i;
    const currentIds = sheet
      .getRange(idRow, CONFIG.firstAthleteColumn, 1, Math.max(sheet.getLastColumn(), CONFIG.firstAthleteColumn) - 1)
      .getValues()[0]
      .map((v) => String(v || "").trim());
    const currentIndex = currentIds.findIndex((x) => x === desiredIds[i]);
    if (currentIndex < 0) continue;
    const currentCol = CONFIG.firstAthleteColumn + currentIndex;
    if (currentCol === targetCol) continue;

    const colRange = sheet.getRange(1, currentCol, sheet.getMaxRows(), 1);
    sheet.moveColumns(colRange, targetCol);
  }

  applyGradeSectionBorders_(sheet, desiredIds, athleteById);
}

function applyGradeSectionBorders_(sheet, desiredIds, athleteById) {
  if (!desiredIds || desiredIds.length === 0) return;

  const lastRow = Math.max(sheet.getLastRow(), CONFIG.firstDataRow);
  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.firstAthleteColumn);

  // Clear borders across the main grid first (headers + daily data only).
  sheet
    .getRange(CONFIG.idHeaderRow, CONFIG.firstAthleteColumn, lastRow - CONFIG.idHeaderRow + 1, lastCol - 1)
    .setBorder(null, null, null, null, null, null);

  let prevGrade = null;
  for (let i = 0; i < desiredIds.length; i++) {
    const id = desiredIds[i];
    const grade = athleteById[id] && typeof athleteById[id].grade === "number" ? athleteById[id].grade : null;
    if (i === 0) {
      prevGrade = grade;
      continue;
    }
    if (grade === prevGrade) continue;
    prevGrade = grade;

    // Put a thick left border at the start of each new grade block (except the first block).
    const col = CONFIG.firstAthleteColumn + i;
    sheet
      .getRange(CONFIG.idHeaderRow, col, lastRow - CONFIG.idHeaderRow + 1, 1)
      .setBorder(null, true, null, null, null, null, "#9bb2ff", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }
}

function upsertAttendanceRow_(sheet, date, athletes) {
  const idRow = CONFIG.idHeaderRow;

  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.firstAthleteColumn);
  const headerIds = sheet
    .getRange(idRow, CONFIG.firstAthleteColumn, 1, lastCol - 1)
    .getValues()[0]
    .map((v) => String(v || "").trim());

  const idToIndex = {};
  for (let i = 0; i < headerIds.length; i++) {
    if (!headerIds[i]) continue;
    idToIndex[headerIds[i]] = i;
  }

  const lastDateRow = getLastDateRow_(sheet);
  const dataRowCount = Math.max(0, lastDateRow - CONFIG.firstDataRow + 1);

  let targetRow = null;
  if (dataRowCount > 0) {
    const dates = sheet
      .getRange(CONFIG.firstDataRow, CONFIG.dateColumn, dataRowCount, 1)
      .getValues()
      .map((r) => String(r[0] || "").trim());
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] === date) {
        targetRow = CONFIG.firstDataRow + i;
        break;
      }
    }
  }

  let updated = true;
  if (!targetRow) {
    updated = false;
    targetRow = Math.max(lastDateRow + 1, CONFIG.firstDataRow);
    sheet.getRange(targetRow, CONFIG.dateColumn).setValue(date);
  }

  const rowValues = new Array(headerIds.length).fill("");
  for (const a of athletes) {
    const idx = idToIndex[a.id];
    if (idx == null) continue; // should not happen if headers were ensured
    rowValues[idx] = a.present ? "Yes" : "No";
  }

  sheet
    .getRange(targetRow, CONFIG.firstAthleteColumn, 1, headerIds.length)
    .setValues([rowValues]);

  return { updated, row: targetRow };
}

function getTotalsStartRow_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.firstDataRow) return null;

  const colA = sheet.getRange(CONFIG.firstDataRow, 1, lastRow - CONFIG.firstDataRow + 1, 1).getValues();
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0] || "").trim() === "Totals (auto)") return CONFIG.firstDataRow + i;
  }
  return null;
}

function getLastDateRow_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), CONFIG.gradeHeaderRow);
  if (lastRow < CONFIG.firstDataRow) return CONFIG.gradeHeaderRow;

  const totalsStart = getTotalsStartRow_(sheet);
  const scanEnd = totalsStart ? totalsStart - 1 : lastRow;
  if (scanEnd < CONFIG.firstDataRow) return CONFIG.gradeHeaderRow;

  const colA = sheet.getRange(CONFIG.firstDataRow, 1, scanEnd - CONFIG.firstDataRow + 1, 1).getValues();
  let lastDateRow = CONFIG.gradeHeaderRow;
  for (let i = 0; i < colA.length; i++) {
    const v = String(colA[i][0] || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) lastDateRow = CONFIG.firstDataRow + i;
  }
  return lastDateRow;
}

function ensureAbsentConditionalFormatting_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), CONFIG.firstAthleteColumn);
  const maxRows = Math.max(sheet.getMaxRows(), CONFIG.firstDataRow);
  const range = sheet.getRange(
    CONFIG.firstDataRow,
    CONFIG.firstAthleteColumn,
    maxRows - CONFIG.firstDataRow + 1,
    lastCol - 1
  );

  const rules = sheet.getConditionalFormatRules();
  for (const r of rules) {
    const bc = r.getBooleanCondition();
    if (!bc) continue;
    if (bc.getCriteriaType() !== SpreadsheetApp.BooleanCriteria.TEXT_EQUAL_TO) continue;
    const vals = bc.getCriteriaValues();
    if (!vals || vals.length !== 1) continue;
    if (String(vals[0]) !== "No") continue;
    return; // already present
  }

  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("No")
    .setBackground("#ffd6d6")
    .setRanges([range])
    .build();

  sheet.setConditionalFormatRules([...rules, rule]);
}

function recomputeSummary_(attendanceSheet, summarySheet, athletesPayload) {
  const idRow = CONFIG.idHeaderRow;
  const nameRow = CONFIG.nameHeaderRow;
  const gradeRow = CONFIG.gradeHeaderRow;

  const lastCol = Math.max(attendanceSheet.getLastColumn(), CONFIG.firstAthleteColumn);
  const ids = attendanceSheet
    .getRange(idRow, CONFIG.firstAthleteColumn, 1, lastCol - 1)
    .getValues()[0]
    .map((v) => String(v || "").trim());
  const names = attendanceSheet
    .getRange(nameRow, CONFIG.firstAthleteColumn, 1, lastCol - 1)
    .getValues()[0]
    .map((v) => String(v || "").trim());
  const grades = attendanceSheet
    .getRange(gradeRow, CONFIG.firstAthleteColumn, 1, lastCol - 1)
    .getValues()[0]
    .map((v) => (v === "" || v == null ? "" : Number(v)));

  const lastDateRow = getLastDateRow_(attendanceSheet);
  const dataRowCount = Math.max(0, lastDateRow - CONFIG.firstDataRow + 1);
  const data =
    dataRowCount > 0
      ? attendanceSheet
          .getRange(CONFIG.firstDataRow, CONFIG.firstAthleteColumn, dataRowCount, lastCol - 1)
          .getValues()
      : [];

  const rows = [];
  for (let c = 0; c < ids.length; c++) {
    const id = ids[c];
    if (!id) continue;
    const name = names[c] || "";
    const grade = grades[c] === "" ? "" : grades[c];

    let present = 0;
    let absent = 0;
    for (let r = 0; r < data.length; r++) {
      const v = String(data[r][c] || "").trim();
      if (v === "Yes") present += 1;
      else if (v === "No") absent += 1;
    }
    const total = present + absent;
    const pct = total ? present / total : "";
    rows.push([grade, id, name, present, absent, total, pct]);
  }

  summarySheet.clear();
  summarySheet
    .getRange(1, 1, 1, 7)
    .setValues([["Grade", "Athlete ID", "Name", "Present", "Absent", "Total", "Attendance %"]]);

  if (rows.length > 0) {
    // Sort by grade, then name for readability
    rows.sort((a, b) => {
      const ga = a[0] === "" ? 999 : a[0];
      const gb = b[0] === "" ? 999 : b[0];
      if (ga !== gb) return ga - gb;
      return String(a[2] || "").localeCompare(String(b[2] || ""));
    });

    summarySheet.getRange(2, 1, rows.length, 7).setValues(rows);
    summarySheet.getRange(2, 7, rows.length, 1).setNumberFormat("0.0%");
  }

  summarySheet.setFrozenRows(1);
  summarySheet.autoResizeColumns(1, 7);

  return rows;
}

function writeTotalsSection_(attendanceSheet, rows) {
  const lastDateRow = getLastDateRow_(attendanceSheet);
  const startRow = Math.max(lastDateRow + 2, CONFIG.firstDataRow + 1);

  const lastCol = Math.max(attendanceSheet.getLastColumn(), CONFIG.firstAthleteColumn);
  const clearRows = attendanceSheet.getMaxRows() - startRow + 1;
  if (clearRows > 0) {
    attendanceSheet.getRange(startRow, 1, clearRows, lastCol).clearContent();
  }

  attendanceSheet.getRange(startRow, 1).setValue("Totals (auto)");
  attendanceSheet.getRange(startRow, 1).setFontWeight("bold");

  const headerRow = startRow + 1;
  attendanceSheet
    .getRange(headerRow, 1, 1, 7)
    .setValues([["Grade", "Athlete ID", "Name", "Present", "Absent", "Total", "Attendance %"]])
    .setFontWeight("bold")
    .setBackground("#eaf0ff");

  if (!rows || rows.length === 0) return;

  // Rows are already [grade, id, name, present, absent, total, pct]
  const out = rows.slice();
  out.sort((a, b) => {
    const ga = a[0] === "" ? 999 : a[0];
    const gb = b[0] === "" ? 999 : b[0];
    if (ga !== gb) return ga - gb;
    return String(a[2] || "").localeCompare(String(b[2] || ""));
  });

  attendanceSheet.getRange(headerRow + 1, 1, out.length, 7).setValues(out);
  attendanceSheet.getRange(headerRow + 1, 7, out.length, 1).setNumberFormat("0.0%");
  attendanceSheet.autoResizeColumns(1, 7);
}

function jsonResponse_(obj) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  // Apps Script doesn't let us set CORS headers; design the client to avoid preflight.
  return out;
}
