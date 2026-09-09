import { parentApi } from "./api.js";

const SYMPTOMS = [
  { id: "light", label: "Light sensitivity" },
  { id: "sound", label: "Sound sensitivity" },
  { id: "nausea", label: "Nausea" },
  { id: "aura", label: "Visual / aura" },
  { id: "dizziness", label: "Dizziness" },
  { id: "other", label: "Other" },
];

const REFRESH_MS = 60_000;

const state = {
  entries: [],
  unlocked: false,
};

const $ = (id) => document.getElementById(id);

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function triLabel(n) {
  return n === 2 ? "Yes" : n === 1 ? "No" : "Unsure";
}

function symptomLabel(id) {
  return SYMPTOMS.find((s) => s.id === id)?.label || id;
}

function hoursFromMinutes(mins) {
  const h = Number(mins) / 60;
  if (!Number.isFinite(h) || h <= 0) return "";
  return String(Math.round(h * 10) / 10);
}

function durationLabel(mins) {
  const h = hoursFromMinutes(mins);
  if (!h) return "";
  return Number(h) === 1 ? "1 hour" : `${h} hours`;
}

function sleepLabel(hours) {
  const n = Math.round(Number(hours) * 10) / 10;
  return n === 1 ? "1 hour" : `${n} hours`;
}

function showError(el, message) {
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function assertParentRole(res) {
  if (!res || typeof res.role !== "string" || !res.role.trim()) return;
  if (res.role.trim().toLowerCase() !== "parent") {
    parentApi.clearSession();
    const err = new Error("That PIN is for Leah's journal. Use the parent PIN to open this view.");
    err.status = 403;
    throw err;
  }
}

function optionalFilterNumber(id) {
  const raw = $(id).value;
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function filteredEntries() {
  const from = $("filterFrom").value;
  const to = $("filterTo").value;
  const minPain = optionalFilterNumber("filterIntensityMin");
  const foodQuery = $("filterFood").value.trim().toLowerCase();
  const symptoms = [...document.querySelectorAll("#filterSymptoms input:checked")].map((el) => el.value);

  return state.entries.filter((entry) => {
    if (from && entry.occurredOn < from) return false;
    if (to && entry.occurredOn > to) return false;
    if (minPain != null && entry.intensity < minPain) return false;
    if (foodQuery && !(entry.food || "").toLowerCase().includes(foodQuery)) return false;
    if (symptoms.some((id) => !(entry.symptoms || []).includes(id))) return false;
    return true;
  });
}

function renderSummary() {
  const rows = state.entries;
  const month = monthKey();
  const monthEntries = rows.filter((e) => e.occurredOn.startsWith(month));
  const avg = rows.length
    ? (rows.reduce((sum, e) => sum + Number(e.intensity || 0), 0) / rows.length).toFixed(1)
    : "—";
  const sleepRows = rows.filter((e) => e.sleepHours != null);
  const avgSleep = sleepRows.length
    ? (sleepRows.reduce((sum, e) => sum + Number(e.sleepHours), 0) / sleepRows.length).toFixed(1)
    : "—";
  $("statCount").textContent = String(rows.length);
  $("statIntensity").textContent = avg;
  $("statSleep").textContent = avgSleep;
  $("statMonth").textContent = String(monthEntries.length);
}

function renderIntensity() {
  const bars = $("intensityBars");
  bars.innerHTML = "";
  const rows = [...state.entries].sort((a, b) => {
    const left = `${a.occurredOn}T${a.occurredAt || "00:00"}`;
    const right = `${b.occurredOn}T${b.occurredAt || "00:00"}`;
    return left.localeCompare(right);
  }).slice(-40);
  $("intensityEmpty").hidden = rows.length > 0;
  for (const entry of rows) {
    const width = `${entry.intensity * 10}%`;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-date">${entry.occurredOn.slice(5)}${entry.occurredAt ? ` ${entry.occurredAt}` : ""}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}"></div></div>
      <div class="bar-n">${entry.intensity}</div>`;
    bars.appendChild(row);
  }
}

function renderSymptoms() {
  const bars = $("symptomBars");
  bars.innerHTML = "";
  const counts = Object.fromEntries(SYMPTOMS.map((s) => [s.id, 0]));
  for (const entry of state.entries) {
    for (const id of entry.symptoms || []) {
      if (id in counts) counts[id] += 1;
    }
  }
  const max = Math.max(0, ...Object.values(counts));
  $("symptomEmpty").hidden = max > 0;
  for (const item of SYMPTOMS) {
    const n = counts[item.id];
    const width = max ? `${Math.max(6, (n / max) * 100)}%` : "0%";
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-date">${item.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${n ? width : "0%"}"></div></div>
      <div class="bar-n">${n}</div>`;
    bars.appendChild(row);
  }
}

function cellNotes(text) {
  if (!text) return "";
  return `<span class="notes">${escapeHtml(text)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTable() {
  const rows = filteredEntries();
  const body = $("entryTableBody");
  $("tableCount").textContent = rows.length === state.entries.length
    ? `${rows.length} in the log`
    : `${rows.length} match · ${state.entries.length} total`;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="12" class="empty-cell">${
      state.entries.length ? "Nothing matches these filters." : "No entries yet."
    }</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((e) => `
    <tr>
      <td>${escapeHtml(e.occurredOn)}</td>
      <td>${escapeHtml(e.occurredAt || "")}</td>
      <td class="int-cell">${escapeHtml(e.intensity)}</td>
      <td>${escapeHtml((e.symptoms || []).map(symptomLabel).join(", "))}${cellNotes(e.symptomNotes)}</td>
      <td>${e.durationMinutes ? escapeHtml(durationLabel(e.durationMinutes)) : ""}</td>
      <td>${e.sleepHours != null ? escapeHtml(sleepLabel(e.sleepHours)) : ""}</td>
      <td>${e.cycleDay ?? ""}</td>
      <td>${escapeHtml(e.food || "")}</td>
      <td>${e.waterAmount != null ? `${escapeHtml(e.waterAmount)} ${escapeHtml(e.waterUnit || "")}` : ""}</td>
      <td>${triLabel(e.caffeine)}${cellNotes(e.caffeineNotes)}</td>
      <td>${triLabel(e.foodColoring)}${cellNotes(e.foodColoringNotes)}</td>
      <td>${triLabel(e.medication)}${cellNotes(e.medicationNotes)}</td>
    </tr>`).join("");
}

function renderAll() {
  renderSummary();
  renderIntensity();
  renderSymptoms();
  renderTable();
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportCsv() {
  const headers = [
    "Date", "Time", "Intensity", "Symptoms", "Symptom notes", "Duration (hours)",
    "Sleep (hours)", "Day of cycle", "Food", "Water", "Water unit", "Caffeine", "Caffeine notes",
    "Food coloring", "Coloring notes", "Medication", "Medication notes",
  ];
  const lines = [headers.join(",")];
  for (const e of state.entries) {
    lines.push([
      e.occurredOn,
      e.occurredAt,
      e.intensity,
      (e.symptoms || []).map(symptomLabel).join("; "),
      e.symptomNotes,
      hoursFromMinutes(e.durationMinutes),
      e.sleepHours,
      e.cycleDay,
      e.food,
      e.waterAmount,
      e.waterUnit,
      triLabel(e.caffeine),
      e.caffeineNotes,
      triLabel(e.foodColoring),
      e.foodColoringNotes,
      triLabel(e.medication),
      e.medicationNotes,
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leahs-migraine-journal-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printSummary() {
  const rows = state.entries.map((e) => `
    <tr>
      <td>${e.occurredOn} ${e.occurredAt || ""}</td>
      <td>${e.intensity}</td>
      <td>${(e.symptoms || []).map(symptomLabel).join(", ")}</td>
      <td>${e.durationMinutes ? durationLabel(e.durationMinutes) : ""}</td>
      <td>${e.sleepHours != null ? sleepLabel(e.sleepHours) : ""}</td>
      <td>${e.cycleDay ?? ""}</td>
      <td>${e.food || ""}</td>
      <td>${e.waterAmount != null ? `${e.waterAmount} ${e.waterUnit || ""}` : ""}</td>
      <td>${triLabel(e.caffeine)} ${e.caffeineNotes || ""}</td>
      <td>${triLabel(e.foodColoring)} ${e.foodColoringNotes || ""}</td>
      <td>${triLabel(e.medication)} ${e.medicationNotes || ""}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><title>Leah's Migraine Journal</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 22px; }
      p { color: #444; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 16px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; text-align: left; }
      th { background: #f3f3f3; }
    </style></head><body>
    <h1>Leah's Migraine Journal</h1>
    <p>Printed ${new Date().toLocaleString()}. For Leah and her doctor — not medical advice.</p>
    <table>
      <thead><tr>
        <th>Date / time</th><th>Int.</th><th>Symptoms</th><th>Duration</th>
        <th>Sleep</th><th>Cycle</th><th>Food</th><th>Water</th><th>Caffeine</th>
        <th>Coloring</th><th>Medication</th>
      </tr></thead>
      <tbody>${rows || "<tr><td colspan='11'>No entries yet</td></tr>"}</tbody>
    </table>
    </body></html>`;
  const win = window.open("", "_blank");
  if (!win) {
    showError($("dashError"), "Allow pop-ups so you can print this for the doctor.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function markRefreshed(at = new Date()) {
  $("refreshMeta").textContent = `Updated ${at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function lockApp() {
  stopAutoRefresh();
  parentApi.clearSession();
  state.unlocked = false;
  state.entries = [];
  $("appShell").hidden = true;
  $("lockScreen").hidden = false;
  $("pinInput").value = "";
  $("pinInput").focus();
}

async function refreshEntries({ soft = false } = {}) {
  try {
    const data = await parentApi.listEntries();
    state.entries = data.entries || [];
    renderAll();
    markRefreshed();
    if (!soft) showError($("dashError"), "");
  } catch (err) {
    if (err.status === 401) {
      lockApp();
      if (!soft) showError($("lockError"), err.message);
      return;
    }
    if (!soft) showError($("dashError"), err.message);
  }
}

let refreshTimer = 0;

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = window.setInterval(() => {
    if (state.unlocked && parentApi.getToken()) refreshEntries({ soft: true });
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = 0;
  }
}

async function openApp() {
  $("lockScreen").hidden = true;
  $("appShell").hidden = false;
  state.unlocked = true;
  showError($("dashError"), "");
  startAutoRefresh();
  await refreshEntries();
}

function buildFilters() {
  const wrap = $("filterSymptoms");
  wrap.innerHTML = "";
  for (const item of SYMPTOMS) {
    const label = document.createElement("label");
    label.className = "check-pill";
    label.innerHTML = `<input type="checkbox" value="${item.id}"> ${item.label}`;
    wrap.appendChild(label);
  }
}

function clearFilters() {
  $("filterFrom").value = "";
  $("filterTo").value = "";
  $("filterIntensityMin").value = "";
  $("filterFood").value = "";
  document.querySelectorAll("#filterSymptoms input").forEach((el) => { el.checked = false; });
  renderTable();
}

function bindEvents() {
  $("lockForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showError($("lockError"), "");
    $("unlockBtn").disabled = true;
    try {
      const res = await parentApi.unlock($("pinInput").value, $("keepUnlocked").checked);
      assertParentRole(res);
      await openApp();
    } catch (err) {
      parentApi.clearSession();
      showError($("lockError"), err.message);
    } finally {
      $("unlockBtn").disabled = false;
    }
  });

  $("lockBtn").addEventListener("click", lockApp);
  $("csvBtn").addEventListener("click", exportCsv);
  $("printBtn").addEventListener("click", printSummary);
  $("clearFilters").addEventListener("click", clearFilters);
  ["filterFrom", "filterTo", "filterIntensityMin", "filterFood"].forEach((id) => {
    $(id).addEventListener("input", renderTable);
  });
  $("filterSymptoms").addEventListener("change", renderTable);

  window.addEventListener("focus", () => {
    if (state.unlocked && parentApi.getToken()) refreshEntries({ soft: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.unlocked && parentApi.getToken()) {
      refreshEntries({ soft: true });
    }
  });
}

buildFilters();
bindEvents();
if (parentApi.getToken()) openApp();
else $("pinInput").focus();
