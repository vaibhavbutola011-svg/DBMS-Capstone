import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { departmentsApi, getErrorMessage, getFieldErrors, semestersApi } from "../services/api";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import Badge from "../components/Badge";
import { validateForm } from "../utils/validation";
import { fmtDate } from "../utils/format";

/** Admin: manage departments and semesters. */
export default function AcademicSetup() {
  const [tab, setTab] = useState("departments");
  return (
    <>
      <PageHeader title="Departments and Semesters" subtitle="The academic structure the rest of the system is built on." />
      <div className="tabs">
        <button className={`tab ${tab === "departments" ? "active" : ""}`} onClick={() => setTab("departments")}>Departments</button>
        <button className={`tab ${tab === "semesters" ? "active" : ""}`} onClick={() => setTab("semesters")}>Semesters</button>
      </div>
      {tab === "departments" ? <Departments /> : <Semesters />}
    </>
  );
}

function useCrud({ api, blank, rules, idKey, label, reload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const isNew = editing === "new";

  const openNew = () => { setForm(blank); setErrors({}); setEditing("new"); };
  const openEdit = (row) => { setForm({ ...blank, ...row }); setErrors({}); setEditing(row); };
  const save = async (e) => {
    e.preventDefault();
    const found = validateForm(form, rules);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (isNew) await api.create(form); else await api.update(editing[idKey], form);
      toast.success(`${label} ${isNew ? "created" : "updated"}`);
      setEditing(null);
      reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row, question) => {
    if (!window.confirm(question)) return;
    try {
      await api.remove(row[idKey]);
      toast.success(`${label} deleted`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  return { editing, setEditing, form, setForm, errors, busy, isNew, openNew, openEdit, save, remove };
}

function Departments() {
  const list = useFetch(() => departmentsApi.list(), []);
  const c = useCrud({
    api: departmentsApi, blank: { dept_code: "", dept_name: "" }, idKey: "department_id", label: "Department",
    reload: () => list.reload(),
    rules: { dept_code: { label: "Code", required: true }, dept_name: { label: "Name", required: true } },
  });

  const columns = [
    { key: "dept_code", label: "Code" },
    { key: "dept_name", label: "Department" },
    { key: "student_count", label: "Students", align: "center" },
    { key: "faculty_count", label: "Faculty", align: "center" },
    { key: "course_count", label: "Courses", align: "center" },
    {
      key: "actions", label: "", align: "right",
      render: (r) => (
        <div className="row-actions">
          <button className="icon-btn" title="Edit" onClick={() => c.openEdit(r)}><Pencil size={17} /></button>
          <button className="icon-btn" title="Delete" onClick={() => c.remove(r, `Delete department ${r.dept_name}? This only works if it has no students, faculty or courses.`)}><Trash2 size={17} color="#c62f3e" /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-actions" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={c.openNew}><Plus size={18} /> Add department</button>
      </div>
      <DataTable columns={columns} rows={list.data || []} rowKey="department_id" loading={list.loading} error={list.error} searchPlaceholder="Search departments..." />
      {c.editing && (
        <Modal title={c.isNew ? "Add department" : "Edit department"} onClose={() => c.setEditing(null)}
          footer={<><button className="btn btn-ghost" onClick={() => c.setEditing(null)}>Cancel</button>
            <button className="btn" form="dept-form" disabled={c.busy}>{c.busy ? "Saving..." : "Save"}</button></>}>
          <form id="dept-form" onSubmit={c.save} noValidate className="stack" style={{ gap: 14 }}>
            <Field label="Code" error={c.errors.dept_code} required><input value={c.form.dept_code} onChange={(e) => c.setForm({ ...c.form, dept_code: e.target.value })} placeholder="e.g. CSE" /></Field>
            <Field label="Name" error={c.errors.dept_name} required><input value={c.form.dept_name} onChange={(e) => c.setForm({ ...c.form, dept_name: e.target.value })} /></Field>
          </form>
        </Modal>
      )}
    </>
  );
}

function Semesters() {
  const list = useFetch(() => semestersApi.list(), []);
  const blank = { semester_number: 1, academic_year: "", start_date: "", end_date: "", is_current: false };
  const c = useCrud({
    api: semestersApi, blank, idKey: "semester_id", label: "Semester", reload: () => list.reload(),
    rules: {
      semester_number: { label: "Semester", required: true, min: 1, max: 8 },
      academic_year: { label: "Academic year", required: true },
      start_date: { label: "Start date", required: true },
      end_date: { label: "End date", required: true },
    },
  });
  const openEdit = (r) => c.openEdit({ ...r, start_date: String(r.start_date).slice(0, 10), end_date: String(r.end_date).slice(0, 10), is_current: !!r.is_current });

  const columns = [
    { key: "semester_number", label: "Semester", render: (r) => <>Sem {r.semester_number} {r.is_current ? <Badge tone="good">current</Badge> : null}</> },
    { key: "academic_year", label: "Academic year" },
    { key: "start_date", label: "Starts", render: (r) => fmtDate(r.start_date) },
    { key: "end_date", label: "Ends", render: (r) => fmtDate(r.end_date) },
    { key: "course_count", label: "Courses", align: "center" },
    {
      key: "actions", label: "", align: "right",
      render: (r) => (
        <div className="row-actions">
          <button className="icon-btn" title="Edit" onClick={() => openEdit(r)}><Pencil size={17} /></button>
          <button className="icon-btn" title="Delete" onClick={() => c.remove(r, `Delete Sem ${r.semester_number} (${r.academic_year})? This only works if it has no courses.`)}><Trash2 size={17} color="#c62f3e" /></button>
        </div>
      ),
    },
  ];

  const set = (k) => (e) => c.setForm({ ...c.form, [k]: e.target.value });
  return (
    <>
      <div className="page-actions" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={c.openNew}><Plus size={18} /> Add semester</button>
      </div>
      <DataTable columns={columns} rows={list.data || []} rowKey="semester_id" loading={list.loading} error={list.error} searchPlaceholder="Search semesters..." />
      {c.editing && (
        <Modal title={c.isNew ? "Add semester" : "Edit semester"} onClose={() => c.setEditing(null)}
          footer={<><button className="btn btn-ghost" onClick={() => c.setEditing(null)}>Cancel</button>
            <button className="btn" form="sem-form" disabled={c.busy}>{c.busy ? "Saving..." : "Save"}</button></>}>
          <form id="sem-form" onSubmit={c.save} noValidate>
            <div className="form-grid">
              <Field label="Semester number" error={c.errors.semester_number} required><input type="number" min="1" max="8" value={c.form.semester_number} onChange={set("semester_number")} /></Field>
              <Field label="Academic year" error={c.errors.academic_year} required hint="Format: 2026-2027"><input value={c.form.academic_year} onChange={set("academic_year")} placeholder="2026-2027" /></Field>
              <Field label="Start date" error={c.errors.start_date} required><input type="date" value={c.form.start_date} onChange={set("start_date")} /></Field>
              <Field label="End date" error={c.errors.end_date} required><input type="date" value={c.form.end_date} onChange={set("end_date")} /></Field>
              <label className="span-2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={c.form.is_current} onChange={(e) => c.setForm({ ...c.form, is_current: e.target.checked })} />
                Mark as the current semester (students can only enroll in current-semester courses)
              </label>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
