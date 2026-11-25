import { useState } from "react";
import { Pencil, Plus, Trash2, History } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { departmentsApi, getErrorMessage, getFieldErrors, studentsApi } from "../services/api";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import Badge from "../components/Badge";
import { validateForm } from "../utils/validation";
import { fmtDate } from "../utils/format";

const blank = () => ({
  email: "", password: "", roll_number: "", first_name: "", last_name: "", date_of_birth: "", gender: "Male",
  phone: "", address: "", department_id: "", current_semester: 1, admission_year: new Date().getFullYear(),
  status: "active",
});

export default function StudentManagement() {
  const toast = useToast();
  const students = useFetch(() => studentsApi.list(), []);
  const departments = useFetch(() => departmentsApi.list(), []);
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | student row
  const [form, setForm] = useState(blank());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const isNew = editing === "new";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openNew = () => { setForm(blank()); setErrors({}); setEditing("new"); };
  const openEdit = (row) => {
    setForm({ ...blank(), ...row, password: "", phone: row.phone || "", address: row.address || "",
      date_of_birth: String(row.date_of_birth).slice(0, 10) });
    setErrors({});
    setEditing(row);
  };

  const save = async (e) => {
    e.preventDefault();
    const found = validateForm(form, {
      email: { label: "Email", required: true, email: true },
      password: { label: "Password", required: isNew && false, password: true },
      roll_number: { label: "Roll number", required: true },
      first_name: { label: "First name", required: true },
      last_name: { label: "Last name", required: true },
      date_of_birth: { label: "Date of birth", required: true },
      department_id: { label: "Department", required: true },
      phone: { label: "Phone", phone: true },
      current_semester: { label: "Semester", required: true, min: 1, max: 8 },
      admission_year: { label: "Admission year", required: true, min: 1990, max: 2100 },
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = { ...form };
    if (!payload.password) delete payload.password; // blank = default (new) / unchanged (edit)
    setBusy(true);
    try {
      if (isNew) {
        await studentsApi.create(payload);
        toast.success("Student added");
      } else {
        await studentsApi.update(editing.student_id, payload);
        toast.success("Student updated");
      }
      setEditing(null);
      students.reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.full_name}? Their enrollments, attendance, marks and grades will be deleted too.`)) return;
    try {
      await studentsApi.remove(row.student_id);
      toast.success("Student deleted");
      students.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const rows = (students.data || []).filter(
    (s) => (!deptFilter || String(s.department_id) === deptFilter) && (!statusFilter || s.status === statusFilter)
  );

  const columns = [
    { key: "roll_number", label: "Roll no." },
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "dept_name", label: "Department" },
    { key: "current_semester", label: "Sem", align: "center" },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "active" ? "good" : r.status === "suspended" ? "bad" : "muted"}>{r.status}</Badge> },
    {
      key: "actions", label: "", align: "right",
      render: (r) => (
        <div className="row-actions">
          <button className="icon-btn" title="Edit" onClick={() => openEdit(r)}><Pencil size={17} /></button>
          <button className="icon-btn" title="Delete" onClick={() => remove(r)}><Trash2 size={17} color="#c62f3e" /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Student Management" subtitle="Add, update and remove student records."
        actions={<button className="btn" onClick={openNew}><Plus size={18} /> Add student</button>} />
      <DataTable columns={columns} rows={rows} rowKey="student_id" loading={students.loading} error={students.error}
        searchPlaceholder="Search by name, roll number or email..."
        toolbar={
          <>
            <select className="inline-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department">
              <option value="">All departments</option>
              {(departments.data || []).map((d) => <option key={d.department_id} value={d.department_id}>{d.dept_code}</option>)}
            </select>
            <select className="inline-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="suspended">Suspended</option>
            </select>
          </>
        } />

      {editing && (
        <Modal title={isNew ? "Add student" : `Edit ${editing.full_name}`} onClose={() => setEditing(null)} wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" form="student-form" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
            </>
          }>
          <form id="student-form" onSubmit={save} noValidate>
            <div className="form-grid">
              <Field label="First name" error={errors.first_name} required><input value={form.first_name} onChange={set("first_name")} /></Field>
              <Field label="Last name" error={errors.last_name} required><input value={form.last_name} onChange={set("last_name")} /></Field>
              <Field label="Email (login)" error={errors.email} required><input type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label={isNew ? "Password" : "New password"} error={errors.password}
                hint={isNew ? "Leave blank to use the default (Student@123)" : "Leave blank to keep the current password"}>
                <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
              </Field>
              <Field label="Roll number" error={errors.roll_number} required><input value={form.roll_number} onChange={set("roll_number")} /></Field>
              <Field label="Date of birth" error={errors.date_of_birth} required><input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} /></Field>
              <Field label="Gender" required>
                <select value={form.gender} onChange={set("gender")}><option>Male</option><option>Female</option><option>Other</option></select>
              </Field>
              <Field label="Phone" error={errors.phone}><input value={form.phone} onChange={set("phone")} /></Field>
              <Field label="Department" error={errors.department_id} required>
                <select value={form.department_id} onChange={set("department_id")}>
                  <option value="">Select...</option>
                  {(departments.data || []).map((d) => <option key={d.department_id} value={d.department_id}>{d.dept_name}</option>)}
                </select>
              </Field>
              <Field label="Current semester" error={errors.current_semester} required>
                <input type="number" min="1" max="8" value={form.current_semester} onChange={set("current_semester")} />
              </Field>
              <Field label="Admission year" error={errors.admission_year} required>
                <input type="number" value={form.admission_year} onChange={set("admission_year")} />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={set("status")}>
                  <option value="active">Active</option><option value="graduated">Graduated</option><option value="suspended">Suspended</option>
                </select>
              </Field>
              <Field label="Address" error={errors.address} className="span-2"><input value={form.address} onChange={set("address")} /></Field>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
