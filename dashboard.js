/* =========================================================
dashboard.js — logic for dashboard.html
---------------------------------------------------------
Each user has their OWN list of records saved in
localStorage under "mt_records_<email>".
A record looks like:
{ id, title, category, amount, date, done }
========================================================= */
const currentUser = getCurrentUser(); // from auth.js
// Safety net: if nobody is logged in, requireLogin() is already redirecting,
// so stop running the rest of this file.
if (!currentUser) throw new Error("Not logged in - redirecting to login page.");
const RECORDS_KEY = "mt_records_" + currentUser.email;
let records = loadRecords();
let chart = null; // the Chart.js object (created once, then updated)
// ---------- Storage helpers ----------
function loadRecords() {
try {
const saved = JSON.parse(localStorage.getItem(RECORDS_KEY));
if (Array.isArray(saved)) return saved;
} catch (e) { /* ignore broken data */ }
// First visit of the demo account: give it sample data to look at.
if (currentUser.email === "demo@mytracker.com") {
const sample = [
{ id: 1, title: "Lunch at canteen", category: "Food",
amount: 85, date: "2026-10-01", done: true },
{ id: 2, title: "Jeepney fare", category: "Transport",
amount: 26, date: "2026-10-02", done: true },
{ id: 3, title: "Printing project", category: "School",
amount: 150, date: "2026-10-03", done: false },
];
localStorage.setItem(RECORDS_KEY, JSON.stringify(sample));
return sample;
}
return [];
}
function saveRecords() {
localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}
// ---------- Formatting helpers ----------
function peso(value) {
return "₱" + Number(value).toLocaleString("en-PH", {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
});
}
/** Prevent HTML injection (XSS): never put raw user text into innerHTML. */
function escapeHTML(text) {
const div = document.createElement("div");
div.textContent = text;
return div.innerHTML;
}
// ---------- Rendering ----------
function renderStats() {
const total = records.length;
const amount = records.reduce((sum, r) => sum + Number(r.amount), 0);
const categories = new Set(records.map((r) => r.category)).size;
const done = records.filter((r) => r.done).length;
document.getElementById("statTotal").textContent = total;
document.getElementById("statAmount").textContent = peso(amount);
document.getElementById("statCategories").textContent = categories;
document.getElementById("statDone").textContent = done + " / " + total;
}
function renderTable() {
const query = document.getElementById("searchBox").value.trim().toLowerCase();
const rows = records.filter(r => r.title.toLowerCase().includes(query) || r.category.toLowerCase().includes(query)).sort((a, b) => b.date.localeCompare(a.date)); // newest first
const tbody = document.getElementById("recordsBody");
tbody.innerHTML = rows
.map(
(r) => `
<tr data-id="${r.id}">
<td class="fw-semibold">${escapeHTML(r.title)}</td>
<td><span class="badge text-bg-secondary">${escapeHTML(r.category)}</span></td>
<td class="text-end">${peso(r.amount)}</td>
<td>${escapeHTML(r.date)}</td>
<td>
<span class="badge ${r.done ? "text-bg-success" : "text-bg-warning"}">
${r.done ? "Done" : "Pending"}
</span>
</td>
<td class="text-end text-nowrap">
<button class="btn btn-sm btn-outline-success toggle-btn" title="Toggle status">
<i class="bi bi-check2"></i>
</button>
<button class="btn btn-sm btn-outline-danger delete-btn" title="Delete">
<i class="bi bi-trash"></i>
</button>
</td>
</tr>`
)
.join("");
document.getElementById("tableEmpty").classList.toggle("d-none", rows.length > 0);
}
function renderChart() {
// Add up the amount per category
const totals = {};
records.forEach((r) => {
totals[r.category] = (totals[r.category] || 0) + Number(r.amount);
});
const labels = Object.keys(totals);
const values = Object.values(totals);
const canvas = document.getElementById("categoryChart");
const emptyText = document.getElementById("chartEmpty");
const hasData = labels.length > 0;
canvas.classList.toggle("d-none", !hasData);
emptyText.classList.toggle("d-none", hasData);
if (typeof Chart === "undefined") return; // Chart.js failed to load (offline)
if (!chart) {
chart = new Chart(canvas, {
type: "doughnut",
data: {
labels: labels,
datasets: [{
data: values,
backgroundColor: ["#4f46e5", "#16a34a", "#f59e0b", "#0ea5e9", "#ef4444", "#8b5cf6"],
}],
},
options: {
responsive: true,
maintainAspectRatio: false,
plugins: { legend: { position: "bottom" } },
},
});
} else {
chart.data.labels = labels;
chart.data.datasets[0].data = values;
chart.update();
}
}
function renderAll() {
renderStats();
renderTable();
renderChart();
}
// ---------- Page setup ----------
document.getElementById("navUserName").textContent = currentUser.name;
document.getElementById("welcomeName").textContent = currentUser.name.split(" ")[0];
document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-PH", {
weekday: "long", year: "numeric", month: "long", day: "numeric",
});
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("searchBox").addEventListener("input", renderTable);
// Default the date field to today whenever the modal opens
document.getElementById("addModal").addEventListener("show.bs.modal", () => {
document.getElementById("addForm").reset();
document.getElementById("formError").classList.add("d-none");
document.getElementById("recDate").value = new Date().toISOString().slice(0, 10);
});
// ---------- Add a record ----------
document.getElementById("addForm").addEventListener("submit", (event) => {
event.preventDefault();
const title = document.getElementById("recTitle").value.trim();
const category = document.getElementById("recCategory").value;
const amount = parseFloat(document.getElementById("recAmount").value);
const date = document.getElementById("recDate").value;
const errorBox = document.getElementById("formError");
if (!title || !category || !date || isNaN(amount) || amount < 0) {
errorBox.textContent = "Please complete all fields with valid values.";
errorBox.classList.remove("d-none");
return;
}
records.push({ id: Date.now(), title, category, amount, date, done: false });
saveRecords();
renderAll();
bootstrap.Modal.getOrCreateInstance(document.getElementById("addModal")).hide();
});
// ---------- Toggle / Delete (one listener for the whole table) ----------
document.getElementById("recordsBody").addEventListener("click", (event) => {
const row = event.target.closest("tr");
if (!row) return;
const id = Number(row.dataset.id);
if (event.target.closest(".toggle-btn")) {
const rec = records.find((r) => r.id === id);
rec.done = !rec.done;
saveRecords();
renderAll();
} else if (event.target.closest(".delete-btn")) {
if (confirm("Delete this record?")) {
records = records.filter((r) => r.id !== id);
saveRecords();
renderAll();
}
}
});
renderAll();