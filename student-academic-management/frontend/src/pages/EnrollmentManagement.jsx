import { useState } from "react";
import { Plus, Trash2, UserMinus } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { coursesApi, enrollmentsApi, getErrorMessage, studentsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import Badge from "../components/Badge";
import { fmtDate } from "../utils/format";

const statusTone = { enrolled: "good", completed: "blue", dropped: "muted" };

/** Admin: manage every enrollment. Student: see own enrollments, enroll in / drop current-semester courses. */
export default function EnrollmentManagement() {
  const { role } = useAuth();
  const toast = useToast();
  const isAdmin = role === "admin";

  const [statusFilter, setStatusFilter] = useState("");
  const enrollments = useFetch(() => enrollmentsApi.list({ status: statusFilter || undefined }), [statusFilter]);
  const students = useFetch(() => studentsApi.list(), [], isAdmin);
  const courses = useFetch(() => coursesApi.list(isAdmin ? {} : { current: 1 }), []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", course_id: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const openNew = () => { setForm({ student_id: "", course_id: "" }); setErrors({}); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    const found = {};
    if (isAdmin && !form.student_id) found.student_id = "Select a student";
    if (!form.course_id) found.course_id = "Select a course";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await enrollmentsApi.create(isAdmin ? form : { course_id: form.course_id });
      toast.success("Enrollment saved");
      setOpen(false);
      enrollments.reload();
      courses.reload();
    } catch (err) {
      const msg = getErrorMessage(err);
      setErrors({ course_id: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const drop = async (row) => {
    if (!window.confirm(`Drop ${row.course_code}${isAdmin ? ` for ${row.student_name}` : ""}?`)) return;
    try {
      await enrollmentsApi.drop(row.enrollment_id);
      toast.success("Course dropped");
      enrollments.reload();
      courses.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Permanently remove this enrollment and its attendance/marks?")) return;
    try {
      await enrollmentsApi.remove(row.enrollment_id);
      toast.success("Enrollment removed");
      enrollments.reload();
      courses.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const changeStatus = async (row, status) => {
    try {
      await enrollmentsApi.update(row.enrollment_id, { status });
      toast.success("Status updated");
      enrollments.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const columns = [
    ...(isAdmin ? [{ key: "roll_number", label: "Roll no." }, { key: "student_name", label: "Student" }] : []),
    { key: "course_code", label: "Code" },
    { key: "course_name", label: "Course" },
    { key: "semester_number", label: "Semester", render: (r) => `Sem ${r.semester_number} (${r.academic_year})` },
    { key: "credits", label: "Credits", align: "center" },
    { key: "faculty_name", label: "Faculty", render: (r) => r.faculty_name || "-" },
    { key: "enrolled_on", label: "Enrolled", render: (r) => fmtDate(r.enrolled_on) },
    {
      key: "status", label: "Status",
      render: (r) => isAdmin ? (
        <select className="inline-select" value={r.status} onChange={(e) => changeStatus(r, e.target.value)} aria-label="Change status">
          <option value="enrolled">enrolled</option><option value="completed">completed</option><option value="dropped">dropped</option>
        </select>
      ) : <Badge tone={statusTone[r.status]}>{r.status}</Badge>,
    },
    {
      key: "actions", label: "", align: "right",
      render: (r) => (
        <div className="row-actions">
          {r.status === "enrolled" && (
            <button className="btn btn-ghost btn-sm" onClick={() => drop(r)}><UserMinus size={15} /> Drop</button>
          )}
          {isAdmin && <button className="icon-btn" title="Remove" onClick={() => remove(r)}><Trash2 size={17} color="#c62f3e" /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={isAdmin ? "Enrollment Management" : "My Enrollments"}
        subtitle={isAdmin ? "Enroll students in courses and manage their status." : "Courses you are enrolled in. You can enroll in current-semester courses."}
        actions={<button className="btn" onClick={openNew}><Plus size={18} /> {isAdmin ? "New enrollment" : "Enroll in a course"}</button>} />
      <DataTable columns={columns} rows={enrollments.data || []} rowKey="enrollment_id" loading={enrollments.loading}
        error={enrollments.error} searchPlaceholder="Search enrollments..."
        toolbar={
          <select className="inline-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="enrolled">Enrolled</option><option value="completed">Completed</option><option value="dropped">Dropped</option>
          </select>
        } />

      {open && (
        <Modal title={isAdmin ? "New enrollment" : "Enroll in a course"} onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn" form="enroll-form" disabled={busy}>{busy ? "Saving..." : "Enroll"}</button>
            </>
          }>
          <form id="enroll-form" onSubmit={save} noValidate className="stack" style={{ gap: 14 }}>
            {isAdmin && (
              <Field label="Student" error={errors.student_id} required>
                <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                  <option value="">Select a student...</option>
                  {(students.data || []).map((s) => <option key={s.student_id} value={s.student_id}>{s.roll_number} - {s.full_name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Course" error={errors.course_id} required>
              <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
                <option value="">Select a course...</option>
                {(courses.data || []).map((c) => (
                  <option key={c.course_id} value={c.course_id} disabled={c.enrolled_count >= c.max_seats}>
                    {c.course_code} - {c.course_name} (Sem {c.semester_number}, {c.enrolled_count}/{c.max_seats} seats)
                  </option>
                ))}
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
