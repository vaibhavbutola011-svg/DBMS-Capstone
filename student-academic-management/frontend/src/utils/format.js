export const fmtDate = (value) => {
  if (!value) return "-";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtNum = (value, digits = 2) =>
  value === null || value === undefined || value === "" ? "-" : Number(value).toFixed(digits).replace(/\.00$/, "");

export const fmtPct = (value) =>
  value === null || value === undefined ? "-" : `${Number(value).toFixed(1).replace(/\.0$/, "")}%`;

export const today = () => new Date().toISOString().slice(0, 10);

// Attendance below 75% is flagged
export const attendanceTone = (pct) => {
  if (pct === null || pct === undefined) return "muted";
  if (pct >= 85) return "good";
  if (pct >= 75) return "warn";
  return "bad";
};

export const gradeTone = (grade) => {
  if (!grade) return "muted";
  if (grade === "F") return "bad";
  if (["O", "A+", "A"].includes(grade)) return "good";
  return "warn";
};

export const semLabel = (row) => `Sem ${row.semester_number} (${row.academic_year})`;

export function downloadCsv(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
