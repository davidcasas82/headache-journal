import {
  unlock,
  getToken,
  clearSession,
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
} from "./api.js";

const SYMPTOMS = [
  { id: "light", label: "Light sensitivity" },
  { id: "sound", label: "Sound sensitivity" },
  { id: "nausea", label: "Nausea" },
  { id: "aura", label: "Visual / aura" },
  { id: "dizziness", label: "Dizziness" },
  { id: "other", label: "Other" },
];

const TRI = [
  { value: 2, label: "Yes" },
  { value: 1, label: "No" },
  { value: 0, label: "Unsure" },
];

const TITLES = { log: "Log a Migraine", history: "Your log", patterns: "Patterns" };

const FILTER_TRI = [
  { value: null, label: "Any" },
  { value: 2, label: "Yes" },
  { value: 1, label: "No" },
  { value: 0, label: "Unsure" },
];

const state = {
  entries: [],
  view: "log",
  intensity: 5,
  waterUnit: "cups",
  tri: { caffeine: 0, foodColoring: 0, medication: 0 },
  filterTri: { caffeine: null, foodColoring: null, medication: null },
  editingId: null,
};

const $ = (id) => document.getElementById(id);

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function triLabel(n) {
  return n === 2 ? "Yes" : n === 1 ? "No" : "Unsure";
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

function buildControls() {
  const chips = $("intensityChips");
  chips.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip${i >= 8 ? " hot" : ""}`;
    btn.textContent = String(i);
    btn.dataset.n = String(i);
    btn.addEventListener("click", () => setIntensity(i));
    chips.appendChild(btn);
  }

  const checks = $("symptomChecks");
  checks.innerHTML = "";
  for (const item of SYMPTOMS) {
    const label = document.createElement("label");
    label.className = "check-pill";
    label.innerHTML = `<input type="checkbox" value="${item.id}"> ${item.label}`;
    checks.appendChild(label);
  }

  for (const row of document.querySelectorAll("[data-tri]")) {
    const key = row.dataset.tri;
    row.innerHTML = "";
    for (const opt of TRI) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tri-btn";
      btn.textContent = opt.label;
      btn.dataset.value = String(opt.value);
      btn.addEventListener("click", () => setTri(key, opt.value));
      row.appendChild(btn);
    }
  }

  document.querySelectorAll("[data-unit]").forEach((btn) => {
    btn.addEventListener("click", () => setWaterUnit(btn.dataset.unit));
  });

  const filterSymptoms = $("filterSymptoms");
  filterSymptoms.innerHTML = "";
  for (const item of SYMPTOMS) {
    const label = document.createElement("label");
    label.className = "check-pill";
    label.innerHTML = `<input type="checkbox" value="${item.id}"> ${item.label}`;
    filterSymptoms.appendChild(label);
  }

  for (const row of document.querySelectorAll("[data-filter-tri]")) {
    const key = row.dataset.filterTri;
    row.innerHTML = "";
    for (const opt of FILTER_TRI) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tri-btn";
      btn.textContent = opt.label;
      btn.dataset.value = opt.value == null ? "" : String(opt.value);
      btn.addEventListener("click", () => {
        setFilterTri(key, opt.value);
        renderPatterns();
      });
      row.appendChild(btn);
    }
    setFilterTri(key, null);
  }
}

function setIntensity(n) {
  state.intensity = n;
  document.querySelectorAll("#intensityChips .chip").forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.n) === n);
  });
}

function setWaterUnit(unit) {
  state.waterUnit = unit;
  document.querySelectorAll("[data-unit]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.unit === unit);
  });
}

function setTri(key, value) {
  state.tri[key] = value;
  document.querySelectorAll(`[data-tri="${key}"] .tri-btn`).forEach((btn) => {
    btn.classList.toggle("on", Number(btn.dataset.value) === value);
  });
}

function setFilterTri(key, value) {
  state.filterTri[key] = value;
  document.querySelectorAll(`[data-filter-tri="${key}"] .tri-btn`).forEach((btn) => {
    const raw = btn.dataset.value;
    const parsed = raw === "" ? null : Number(raw);
    btn.classList.toggle("on", parsed === value);
  });
}

function resetForm() {
  state.editingId = null;
  $("entryId").value = "";
  $("occurredOn").value = todayISO();
  $("occurredAt").value = nowHM();
  $("durationHours").value = "";
  $("sleepHours").value = "";
  $("symptomNotes").value = "";
  $("cycleDay").value = "";
  $("food").value = "";
  $("waterAmount").value = "";
  $("caffeineNotes").value = "";
  $("foodColoringNotes").value = "";
  $("medicationNotes").value = "";
  document.querySelectorAll("#symptomChecks input").forEach((el) => { el.checked = false; });
  setIntensity(5);
  setWaterUnit("cups");
  setTri("caffeine", 0);
  setTri("foodColoring", 0);
  setTri("medication", 0);
  $("saveBtn").textContent = "Save";
  $("cancelEditBtn").hidden = true;
  $("pageTitle").textContent = state.view === "log" ? TITLES.log : TITLES[state.view];
  showError($("formError"), "");
}

function fillForm(entry) {
  state.editingId = entry.id;
  $("entryId").value = entry.id;
  $("occurredOn").value = entry.occurredOn || "";
  $("occurredAt").value = entry.occurredAt || "";
  const mins = Number(entry.durationMinutes) || 0;
  $("durationHours").value = mins ? hoursFromMinutes(mins) : "";
  $("sleepHours").value = entry.sleepHours == null ? "" : String(entry.sleepHours);
  $("symptomNotes").value = entry.symptomNotes || "";
  $("cycleDay").value = entry.cycleDay ?? "";
  $("food").value = entry.food || "";
  $("waterAmount").value = entry.waterAmount ?? "";
  $("caffeineNotes").value = entry.caffeineNotes || "";
  $("foodColoringNotes").value = entry.foodColoringNotes || "";
  $("medicationNotes").value = entry.medicationNotes || "";
  document.querySelectorAll("#symptomChecks input").forEach((el) => {
    el.checked = (entry.symptoms || []).includes(el.value);
  });
  setIntensity(entry.intensity || 5);
  setWaterUnit(entry.waterUnit || "cups");
  setTri("caffeine", entry.caffeine ?? 0);
  setTri("foodColoring", entry.foodColoring ?? 0);
  setTri("medication", entry.medication ?? 0);
  $("saveBtn").textContent = "Save changes";
  $("cancelEditBtn").hidden = false;
  showView("log");
  $("pageTitle").textContent = "Edit migraine";
}

function formPayload() {
  const hoursRaw = $("durationHours").value;
  const hours = hoursRaw === "" ? null : Number(hoursRaw);
  const durationMinutes = hours == null || !Number.isFinite(hours) || hours <= 0
    ? null
    : Math.round(hours * 60);
  const waterRaw = $("waterAmount").value;
  return {
    occurredOn: $("occurredOn").value,
    occurredAt: $("occurredAt").value || null,
    intensity: state.intensity,
    symptoms: [...document.querySelectorAll("#symptomChecks input:checked")].map((el) => el.value),
    symptomNotes: $("symptomNotes").value,
    durationMinutes,
    sleepHours: $("sleepHours").value === "" ? null : Number($("sleepHours").value),
    cycleDay: $("cycleDay").value === "" ? null : Number($("cycleDay").value),
    food: $("food").value,
    waterAmount: waterRaw === "" ? null : Number(waterRaw),
    waterUnit: state.waterUnit,
    caffeine: state.tri.caffeine,
    caffeineNotes: $("caffeineNotes").value,
    foodColoring: state.tri.foodColoring,
    foodColoringNotes: $("foodColoringNotes").value,
    medication: state.tri.medication,
    medicationNotes: $("medicationNotes").value,
  };
}

function showView(name) {
  state.view = name;
  for (const view of ["log", "history", "patterns"]) {
    $(`view-${view}`).hidden = view !== name;
  }
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("on", tab.dataset.view === name);
  });
  $("pageTitle").textContent = state.editingId && name === "log" ? "Edit migraine" : TITLES[name];
  if (name === "history") renderHistory();
  if (name === "patterns") renderPatterns();
}

function renderHistory() {
  const empty = $("historyEmpty");
  const list = $("historyList");
  list.innerHTML = "";
  empty.hidden = state.entries.length > 0;
  for (const entry of state.entries) {
    const li = document.createElement("li");
    const when = `${fmtDate(entry.occurredOn)}${entry.occurredAt ? ` · ${entry.occurredAt}` : ""}`;
    const bits = [];
    if (entry.durationMinutes) bits.push(durationLabel(entry.durationMinutes));
    if (entry.sleepHours != null) bits.push(`${sleepLabel(entry.sleepHours)} sleep`);
    if (entry.symptoms?.length) bits.push(entry.symptoms.map(symptomLabel).join(", "));
    li.innerHTML = `
      <div class="history-item">
        <div class="history-top"><span>${when}</span><span>${entry.intensity}/10</span></div>
        ${bits.length ? `<p class="history-meta">${bits.join(" · ")}</p>` : ""}
        <div class="history-actions">
          <button type="button" data-edit="${entry.id}">Edit</button>
          <button type="button" class="danger" data-del="${entry.id}">Delete</button>
        </div>
      </div>`;
    list.appendChild(li);
  }
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

function symptomLabel(id) {
  return SYMPTOMS.find((s) => s.id === id)?.label || id;
}

function optionalFilterNumber(id) {
  const raw = $(id).value;
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function filteredEntries() {
  const minPain = optionalFilterNumber("filterIntensityMin");
  const minHours = optionalFilterNumber("filterHoursMin");
  const cycleFrom = optionalFilterNumber("filterCycleFrom");
  const cycleTo = optionalFilterNumber("filterCycleTo");
  const minWater = optionalFilterNumber("filterWaterMin");
  const maxSleep = optionalFilterNumber("filterSleepMax");
  const minSleep = optionalFilterNumber("filterSleepMin");
  const foodQuery = $("filterFood").value.trim().toLowerCase();
  const symptoms = [...document.querySelectorAll("#filterSymptoms input:checked")].map((el) => el.value);

  return state.entries.filter((entry) => {
    if (minPain != null && entry.intensity < minPain) return false;
    if (minHours != null && (entry.durationMinutes || 0) < minHours * 60) return false;
    if (symptoms.some((id) => !(entry.symptoms || []).includes(id))) return false;
    if (cycleFrom != null && (entry.cycleDay == null || entry.cycleDay < cycleFrom)) return false;
    if (cycleTo != null && (entry.cycleDay == null || entry.cycleDay > cycleTo)) return false;
    if (foodQuery && !(entry.food || "").toLowerCase().includes(foodQuery)) return false;
    if (minWater != null && (entry.waterAmount == null || entry.waterAmount < minWater)) return false;
    if (maxSleep != null && (entry.sleepHours == null || entry.sleepHours > maxSleep)) return false;
    if (minSleep != null && (entry.sleepHours == null || entry.sleepHours < minSleep)) return false;
    for (const key of ["caffeine", "foodColoring", "medication"]) {
      const want = state.filterTri[key];
      if (want != null && entry[key] !== want) return false;
    }
    return true;
  });
}

function clearFilters() {
  $("filterIntensityMin").value = "";
  $("filterHoursMin").value = "";
  $("filterSleepMax").value = "";
  $("filterSleepMin").value = "";
  $("filterCycleFrom").value = "";
  $("filterCycleTo").value = "";
  $("filterFood").value = "";
  $("filterWaterMin").value = "";
  document.querySelectorAll("#filterSymptoms input").forEach((el) => { el.checked = false; });
  setFilterTri("caffeine", null);
  setFilterTri("foodColoring", null);
  setFilterTri("medication", null);
  renderPatterns();
}

function renderPatterns() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = filteredEntries();
  const monthEntries = rows.filter((e) => e.occurredOn.startsWith(monthKey));
  const avg = rows.length
    ? (rows.reduce((sum, e) => sum + e.intensity, 0) / rows.length).toFixed(1)
    : "—";
  const sleepRows = rows.filter((e) => e.sleepHours != null);
  const avgSleep = sleepRows.length
    ? (sleepRows.reduce((sum, e) => sum + Number(e.sleepHours), 0) / sleepRows.length).toFixed(1)
    : "—";
  const withSymptoms = rows.filter((e) => e.symptoms?.length).length;
  $("monthStats").innerHTML = `
    <div><div class="stat-n">${rows.length}</div><div class="stat-l">Matching</div></div>
    <div><div class="stat-n">${avg}</div><div class="stat-l">Average pain</div></div>
    <div><div class="stat-n">${avgSleep}</div><div class="stat-l">Average sleep</div></div>
    <div><div class="stat-n">${withSymptoms}</div><div class="stat-l">With symptoms</div></div>`;
  $("filterCount").textContent = monthEntries.length === rows.length
    ? `${rows.length} in your log`
    : `${rows.length} match · ${monthEntries.length} this month`;

  const bars = $("patternBars");
  bars.innerHTML = "";
  $("patternEmpty").hidden = rows.length > 0;
  for (const entry of rows.slice(0, 40)) {
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

async function refreshEntries() {
  const data = await listEntries();
  state.entries = data.entries || [];
  if (state.view === "history") renderHistory();
  if (state.view === "patterns") renderPatterns();
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
    showError($("formError"), "Allow pop-ups so you can print this for your doctor.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function lockApp() {
  clearSession();
  $("appShell").hidden = true;
  $("lockScreen").hidden = false;
  $("pinInput").value = "";
  $("pinInput").focus();
}

async function openApp() {
  $("lockScreen").hidden = true;
  $("appShell").hidden = false;
  resetForm();
  showView("log");
  try {
    await refreshEntries();
  } catch (err) {
    if (err.status === 401) lockApp();
    else showError($("formError"), err.message);
  }
}

function bindEvents() {
  $("lockForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showError($("lockError"), "");
    $("unlockBtn").disabled = true;
    try {
      await unlock($("pinInput").value, $("keepUnlocked").checked);
      await openApp();
    } catch (err) {
      showError($("lockError"), err.message);
    } finally {
      $("unlockBtn").disabled = false;
    }
  });

  const menuBtn = $("menuBtn");
  const menu = $("moreMenu");

  function closeMenu() {
    menu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu();
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== menuBtn) {
      closeMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  $("lockBtn").addEventListener("click", () => { closeMenu(); lockApp(); });
  $("csvBtn").addEventListener("click", () => { closeMenu(); exportCsv(); });
  $("printBtn").addEventListener("click", () => { closeMenu(); printSummary(); });
  $("cancelEditBtn").addEventListener("click", resetForm);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view));
  });

  $("entryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showError($("formError"), "");
    $("saveBtn").disabled = true;
    try {
      const payload = formPayload();
      if (state.editingId) await updateEntry(state.editingId, payload);
      else await createEntry(payload);
      await refreshEntries();
      resetForm();
      showView("history");
    } catch (err) {
      if (err.status === 401) lockApp();
      else showError($("formError"), err.message);
    } finally {
      $("saveBtn").disabled = false;
    }
  });

  $("historyList").addEventListener("click", async (event) => {
    const editId = event.target.dataset.edit;
    const delId = event.target.dataset.del;
    if (editId) {
      const entry = state.entries.find((e) => e.id === editId);
      if (entry) fillForm(entry);
      return;
    }
    if (delId && window.confirm("Delete this headache from your log?")) {
      try {
        await deleteEntry(delId);
        if (state.editingId === delId) resetForm();
        await refreshEntries();
      } catch (err) {
        if (err.status === 401) lockApp();
        else window.alert(err.message);
      }
    }
  });

  [
    "filterIntensityMin",
    "filterHoursMin",
    "filterSleepMax",
    "filterSleepMin",
    "filterCycleFrom",
    "filterCycleTo",
    "filterFood",
    "filterWaterMin",
  ].forEach((id) => {
    $(id).addEventListener("input", renderPatterns);
  });
  $("filterSymptoms").addEventListener("change", renderPatterns);
  $("clearFilters").addEventListener("click", clearFilters);
}

buildControls();
bindEvents();
if (getToken()) openApp();
else $("pinInput").focus();
