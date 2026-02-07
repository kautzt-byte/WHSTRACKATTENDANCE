// === Configuration ===
// 1) Deploy your Google Apps Script as a Web App, then paste the "Web app URL" below.
// 2) The UI will ask for a password at submit-time; Apps Script must validate it server-side.
const APPS_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyoKZ44aez0gaOijsZfrQDP1zsxIOdcFvmdi5iHCX3oyuQfRgNBdp6iAdiI7_MaGhE/exec";

const ROSTER_URL = "./roster.json";

const statusBanner = document.getElementById("statusBanner");
const dateInput = document.getElementById("dateInput");
const searchInput = document.getElementById("searchInput");
const groupFilter = document.getElementById("groupFilter");
const rosterBody = document.getElementById("rosterBody");
const yesCount = document.getElementById("yesCount");
const noCount = document.getElementById("noCount");

const markAllYesBtn = document.getElementById("markAllYesBtn");
const markAllNoBtn = document.getElementById("markAllNoBtn");
const submitBtn = document.getElementById("submitBtn");

const passwordDialog = document.getElementById("passwordDialog");
const passwordInput = document.getElementById("passwordInput");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");

let roster = [];
let filteredRoster = [];
let attendanceById = new Map(); // id -> boolean (present)

function gradeSortKey(grade) {
  if (grade === 9 || grade === 10 || grade === 11 || grade === 12) return grade;
  return 999;
}

function compareAthletes(a, b) {
  const ga = gradeSortKey(a.grade);
  const gb = gradeSortKey(b.grade);
  if (ga !== gb) return ga - gb;
  const na = (a.name ?? "").toString();
  const nb = (b.name ?? "").toString();
  const c = na.localeCompare(nb);
  if (c !== 0) return c;
  return (a.id ?? "").toString().localeCompare((b.id ?? "").toString());
}

function todayYYYYMMDD() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setBanner(message, kind) {
  statusBanner.textContent = message;
  statusBanner.classList.remove("hidden", "banner--ok", "banner--err");
  statusBanner.classList.add(kind === "ok" ? "banner--ok" : "banner--err");
}

function clearBanner() {
  statusBanner.textContent = "";
  statusBanner.classList.add("hidden");
  statusBanner.classList.remove("banner--ok", "banner--err");
}

function normalize(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function uniqueGroups(athletes) {
  const groups = new Set();
  for (const a of athletes) {
    const g = (a.group ?? "").toString().trim();
    if (g) groups.add(g);
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}

function initAttendanceDefaults() {
  attendanceById = new Map();
  for (const a of roster) attendanceById.set(a.id, false); // default No
}

function applyFilters() {
  const q = normalize(searchInput.value);
  const group = groupFilter.value;

  filteredRoster = roster.filter((a) => {
    if (group && (a.group ?? "") !== group) return false;
    if (!q) return true;
    const hay = `${a.name ?? ""} ${a.id ?? ""} ${a.grade ?? ""} ${a.group ?? ""}`;
    return normalize(hay).includes(q);
  });

  filteredRoster.sort(compareAthletes);
  renderRoster();
}

function updateCounts() {
  let yes = 0;
  let no = 0;
  for (const a of roster) {
    const present = attendanceById.get(a.id) ?? false;
    if (present) yes += 1;
    else no += 1;
  }
  yesCount.textContent = String(yes);
  noCount.textContent = String(no);
}

function makeStatusButton(id) {
  const present = attendanceById.get(id) ?? false;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `statusBtn ${present ? "statusBtn--yes" : "statusBtn--no"}`;
  btn.textContent = present ? "Yes" : "No";
  btn.addEventListener("click", () => {
    attendanceById.set(id, !(attendanceById.get(id) ?? false));
    applyFilters();
    updateCounts();
  });
  return btn;
}

function renderRoster() {
  rosterBody.innerHTML = "";

  if (filteredRoster.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "muted";
    td.textContent = "No athletes match the current filters.";
    tr.appendChild(td);
    rosterBody.appendChild(tr);
    return;
  }

  let currentGradeKey = null;
  for (const a of filteredRoster) {
    const gk = gradeSortKey(a.grade);
    if (gk !== currentGradeKey) {
      currentGradeKey = gk;
      const label =
        gk === 9 || gk === 10 || gk === 11 || gk === 12 ? `Grade ${gk}` : "Other / Unknown Grade";

      const trDiv = document.createElement("tr");
      trDiv.className = "gradeDivider";
      const tdDiv = document.createElement("td");
      tdDiv.colSpan = 4;
      tdDiv.textContent = label;
      trDiv.appendChild(tdDiv);
      rosterBody.appendChild(trDiv);
    }

    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "cellAthlete";
    tdName.setAttribute("data-label", "Athlete");
    tdName.innerHTML = `<div>${escapeHtml(a.name ?? "")}</div><div class="muted" style="font-size:12px;">ID: ${escapeHtml(
      a.id
    )}</div>`;

    const tdGrade = document.createElement("td");
    tdGrade.setAttribute("data-label", "Grade");
    tdGrade.textContent = a.grade == null ? "" : String(a.grade);

    const tdGroup = document.createElement("td");
    tdGroup.setAttribute("data-label", "Group");
    tdGroup.textContent = a.group ?? "";

    const tdStatus = document.createElement("td");
    tdStatus.setAttribute("data-label", "Status");
    tdStatus.appendChild(makeStatusButton(a.id));

    tr.appendChild(tdName);
    tr.appendChild(tdGrade);
    tr.appendChild(tdGroup);
    tr.appendChild(tdStatus);
    rosterBody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPayload(password) {
  const date = dateInput.value || todayYYYYMMDD();
  const athletes = roster.map((a) => ({
    id: a.id,
    name: a.name ?? "",
    grade: a.grade ?? null,
    group: a.group ?? "",
    present: attendanceById.get(a.id) ?? false
  }));

  return {
    date,
    password,
    rosterVersion: 1,
    submittedAtIso: new Date().toISOString(),
    athletes
  };
}

async function submitAttendance(password) {
  if (!APPS_SCRIPT_WEBAPP_URL || APPS_SCRIPT_WEBAPP_URL.includes("PASTE_")) {
    setBanner("Missing Apps Script URL. Edit app.js and set APPS_SCRIPT_WEBAPP_URL.", "err");
    return;
  }

  clearBanner();
  submitBtn.disabled = true;
  confirmSubmitBtn.disabled = true;

  try {
    const payload = buildPayload(password);
    const body = JSON.stringify(payload);

    // Use a "simple request" Content-Type to avoid CORS preflight with Apps Script.
    // If the browser still blocks reading the response, fall back to `no-cors`.
    try {
      const res = await fetch(APPS_SCRIPT_WEBAPP_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body
      });

      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned a non-JSON response.");
      }

      if (!data?.ok) {
        setBanner(data?.error || "Submit failed.", "err");
        return;
      }

      setBanner(data?.message || "Saved.", "ok");
    } catch (err) {
      await fetch(APPS_SCRIPT_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body
      });

      setBanner("Submitted (unable to verify in browser). Check the sheet to confirm.", "ok");
    }
  } catch (e) {
    setBanner(`Submit failed: ${e?.message ?? e}`, "err");
  } finally {
    submitBtn.disabled = false;
    confirmSubmitBtn.disabled = false;
  }
}

async function loadRoster() {
  const res = await fetch(ROSTER_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load roster.json (${res.status})`);
  const data = await res.json();
  if (!data || !Array.isArray(data.athletes)) throw new Error("Invalid roster.json (missing athletes array)");

  roster = data.athletes
    .map((a) => ({
      id: (a.id ?? "").toString().trim(),
      name: (a.name ?? "").toString().trim(),
      grade: a.grade ?? null,
      group: a.group ?? ""
    }))
    .filter((a) => a.id && a.name);

  roster.sort(compareAthletes);

  const seen = new Set();
  for (const a of roster) {
    if (seen.has(a.id)) throw new Error(`Duplicate athlete id in roster.json: ${a.id}`);
    seen.add(a.id);
  }

  const groups = uniqueGroups(roster);
  groupFilter.innerHTML = `<option value="">All</option>${groups
    .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`)
    .join("")}`;
}

function wireEvents() {
  searchInput.addEventListener("input", applyFilters);
  groupFilter.addEventListener("change", applyFilters);

  markAllYesBtn.addEventListener("click", () => {
    for (const a of roster) attendanceById.set(a.id, true);
    applyFilters();
    updateCounts();
  });

  markAllNoBtn.addEventListener("click", () => {
    for (const a of roster) attendanceById.set(a.id, false);
    applyFilters();
    updateCounts();
  });

  submitBtn.addEventListener("click", () => {
    passwordInput.value = "";
    if (typeof passwordDialog.showModal === "function") passwordDialog.showModal();
    else {
      const pw = window.prompt("Submit password:");
      if (pw) submitAttendance(pw);
    }
  });

  passwordDialog.addEventListener("close", () => {
    if (passwordDialog.returnValue !== "submit") return;
    const pw = passwordInput.value || "";
    if (!pw) {
      setBanner("Password required to submit.", "err");
      return;
    }
    submitAttendance(pw);
  });
}

async function main() {
  dateInput.value = todayYYYYMMDD();
  wireEvents();

  try {
    await loadRoster();
    initAttendanceDefaults();
    filteredRoster = roster.slice();
    renderRoster();
    updateCounts();
    clearBanner();
  } catch (e) {
    rosterBody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "muted";
    td.textContent = e?.message ?? String(e);
    tr.appendChild(td);
    rosterBody.appendChild(tr);
    setBanner("Failed to load roster. Check roster.json.", "err");
  }
}

main();
