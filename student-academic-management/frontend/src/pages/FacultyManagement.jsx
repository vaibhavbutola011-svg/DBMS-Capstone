import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { departmentsApi, facultyApi, getErrorMessage, getFieldErrors } from "../services/api";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import { validateForm } from "../utils/validation";
import { fmtDate } from "../utils/format";

const blank = () => ({
  email: "", password: "", employee_code: "", first_name: "", last_name: "", phone: "",
  designation: "Assistant Professor", department_id: "", joining_date: "",
});

export default function FacultyManagement() {
  const toast = useToast();
  const faculty = useFetch(() => facultyApi.list(), []);
  const departments = useFetch(() => departmentsApi.list(), []);
  const [deptFilter, setDeptFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const isNew = editing === "new";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openNew = () => { setForm(blank()); setErrors({}); setEditing("new"); };
  const openEdit = (row) => {
    setForm({ ...blank(), ...row, password: "", phone: row.phone || "", joining_date: String(row.joining_date).slice(0, 10) });
    setErrors({});
    setEditing(row);
  };

  const save = async (e) => {
    e.preventDefault();
    const found = validateForm(form, {
      email: { label: "Email", required: true, email: true },
      password: { label: "Password", password: true },
      employee_code: { label: "Employee code", required: true },
      first_name: { label: "First name", required: true },
      last_name: { label: "Last name", required: true },
      department_id: { label: "Department", required: true },
      joining_date: { label: "Joining date", required: true },
      phone: { label: "Phone", phone: true },
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    setBusy(true);
    try {
      if (isNew) {
        await facultyApi.create(payload);
        toast.success("Faculty member added");
      } else {
        await facultyApi.update(editing.faculty_id, payload);
        toast.success("Faculty member updated");
      }
      setEditing(null);
      faculty.reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.full_name}? Their courses will become unassigned.`)) return;
    try {
      await facultyApi.remove(row.faculty_id);
      toast.success("Faculty member deleted");
      faculty.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const rows = (faculty.data || []).filter((f) => !deptFilter || String(f.department_id) === deptFilter);

  const columns = [
    { key: "employee_code", label: "Code" },
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "designation", label: "Designation" },
    { key: "dept_name", label: "Department" },
    { key: "course_count", label: "Courses", align: "center" },
    { key: "joining_date", label: "Joined", render: (r) => fmtDate(r.joining_date) },
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
      <PageHeader title="Faculty Management" subtitle="Add, update and remove faculty members."
        actions={<button className="btn" onClick={openNew}><Plus size={18} /> Add faculty</button>} />
      <DataTable columns={columns} rows={rows} rowKey="faculty_id" loading={faculty.loading} error={faculty.error}
        searchPlaceholder="Search by name, code or email..."
        toolbar={
          <select className="inline-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department">
            <option value="">All departments</option>
            {(departments.data || []).map((d) => <option key={d.department_id} value={d.department_id}>{d.dept_code}</option>)}
          </select>
        } />

      {editing && (
        <Modal title={isNew ? "Add faculty member" : `Edit ${editing.full_name}`} onClose={() => setEditing(null)} wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" form="faculty-form" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
            </>
          }>
          <form id="faculty-form" onSubmit={save} noValidate>
            <div className="form-grid">
              <Field label="First name" error={errors.first_name} required><input value={form.first_name} onChange={set("first_name")} /></Field>
              <Field label="Last name" error={errors.last_name} required><input value={form.last_name} onChange={set("last_name")} /></Field>
              <Field label="Email (login)" error={errors.email} required><input type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label={isNew ? "Password" : "New password"} error={errors.password}
                hint={isNew ? "Leave blank to use the default (Faculty@123)" : "Leave blank to keep the current password"}>
                <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
              </Field>
              <Field label="Employee code" error={errors.employee_code} required><input value={form.employee_code} onChange={set("employee_code")} /></Field>
              <Field label="Designation" error={errors.designation}>
                <select value={form.designation} onChange={set("designation")}>
                  <option>Professor</option><option>Associate Professor</option><option>Assistant Professor</option><option>Lecturer</option>
                </select>
              </Field>
              <Field label="Department" error={errors.department_id} required>
                <select value={form.department_id} onChange={set("department_id")}>
                  <option value="">Select...</option>
                  {(departments.data || []).map((d) => <option key={d.department_id} value={d.department_id}>{d.dept_name}</option>)}
                </select>
              </Field>
              <Field label="Joining date" error={errors.joining_date} required><input type="date" value={form.joining_date} onChange={set("joining_date")} /></Field>
              <Field label="Phone" error={errors.phone}><input value={form.phone} onChange={set("phone")} /></Field>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
