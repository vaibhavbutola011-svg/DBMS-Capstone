import { useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import useFetch from "../hooks/useFetch";
import {
  coursesApi, departmentsApi, facultyApi, getErrorMessage, getFieldErrors, semestersApi,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Loader from "../components/Loader";
import { validateForm } from "../utils/validation";

const blank = () => ({
  course_code: "", course_name: "", credits: 3, department_id: "", semester_id: "", faculty_id: "", max_seats: 60,
});

/** Admin: full CRUD + faculty assignment. Faculty: their own courses. Student: course catalogue. */
export default function CourseManagement() {
  const { role } = useAuth();
  const toast = useToast();
  const isAdmin = role === "admin";

  const [deptFilter, setDeptFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");
  const courses = useFetch(() => coursesApi.list({ department_id: deptFilter || undefined, semester_id: semFilter || undefined }), [deptFilter, semFilter]);
  const departments = useFetch(() => departmentsApi.list(), []);
  const semesters = useFetch(() => semestersApi.list(), []);
  const faculty = useFetch(() => facultyApi.list(), [], isAdmin);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(null);

  const isNew = editing === "new";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openNew = () => { setForm(blank()); setErrors({}); setEditing("new"); };
  const openEdit = (row) => {
    setForm({ ...blank(), ...row, faculty_id: row.faculty_id || "" });
    setErrors({});
    setEditing(row);
  };

  const save = async (e) => {
    e.preventDefault();
    const found = validateForm(form, {
      course_code: { label: "Course code", required: true },
      course_name: { label: "Course name", required: true },
      credits: { label: "Credits", required: true, min: 1, max: 6 },
      department_id: { label: "Department", required: true },
      semester_id: { label: "Semester", required: true },
      max_seats: { label: "Max seats", required: true, min: 1 },
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    const payload = {
      course_code: form.course_code, course_name: form.course_name, credits: form.credits,
      department_id: form.department_id, semester_id: form.semester_id, max_seats: form.max_seats,
      faculty_id: form.faculty_id || null,
    };
    setBusy(true);
    try {
      if (isNew) {
        await coursesApi.create(payload);
        toast.success("Course created");
      } else {
        await coursesApi.update(editing.course_id, payload);
        await coursesApi.assignFaculty(editing.course_id, form.faculty_id);
        toast.success("Course updated");
      }
      setEditing(null);
      courses.reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete course ${row.course_code}? Enrollments, attendance and marks for it will be deleted.`)) return;
    try {
      await coursesApi.remove(row.course_id);
      toast.success("Course deleted");
      courses.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const assign = async (row, facultyId) => {
    try {
      await coursesApi.assignFaculty(row.course_id, facultyId);
      toast.success(facultyId ? "Faculty assigned" : "Faculty unassigned");
      courses.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const columns = [
    { key: "course_code", label: "Code" },
    { key: "course_name", label: "Course" },
    { key: "dept_code", label: "Dept" },
    { key: "semester_number", label: "Semester", render: (r) => <>Sem {r.semester_number} {r.is_current ? <Badge tone="blue">current</Badge> : null}</> },
    { key: "credits", label: "Credits", align: "center" },
    {
      key: "faculty_name", label: "Faculty",
      render: (r) => isAdmin ? (
        <select className="inline-select" value={r.faculty_id || ""} onChange={(e) => assign(r, e.target.value)} aria-label={`Faculty for ${r.course_code}`}>
          <option value="">Not assigned</option>
          {(faculty.data || []).map((f) => <option key={f.faculty_id} value={f.faculty_id}>{f.full_name}</option>)}
        </select>
      ) : (r.faculty_name || <span className="muted">Not assigned</span>),
    },
    { key: "enrolled_count", label: "Seats", align: "center", render: (r) => `${r.enrolled_count}/${r.max_seats}` },
    {
      key: "actions", label: "", align: "right",
      render: (r) => (
        <div className="row-actions">
          <button className="icon-btn" title="Details" onClick={() => setDetails(r)}><Eye size={17} /></button>
          {isAdmin && <button className="icon-btn" title="Edit" onClick={() => openEdit(r)}><Pencil size={17} /></button>}
          {isAdmin && <button className="icon-btn" title="Delete" onClick={() => remove(r)}><Trash2 size={17} color="#c62f3e" /></button>}
        </div>
      ),
    },
  ];

  const title = isAdmin ? "Course Management" : role === "faculty" ? "My Courses" : "Courses";
  const subtitle = isAdmin ? "Create courses and assign faculty."
    : role === "faculty" ? "Courses assigned to you." : "Browse courses and see who teaches them.";

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}
        actions={isAdmin && <button className="btn" onClick={openNew}><Plus size={18} /> Add course</button>} />
      <DataTable columns={columns} rows={courses.data || []} rowKey="course_id" loading={courses.loading} error={courses.error}
        searchPlaceholder="Search by code or name..."
        empty={role === "faculty" ? "No courses are assigned to you yet" : "No courses found"}
        toolbar={
          <>
            <select className="inline-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department">
              <option value="">All departments</option>
              {(departments.data || []).map((d) => <option key={d.department_id} value={d.department_id}>{d.dept_code}</option>)}
            </select>
            <select className="inline-select" value={semFilter} onChange={(e) => setSemFilter(e.target.value)} aria-label="Filter by semester">
              <option value="">All semesters</option>
              {(semesters.data || []).map((s) => <option key={s.semester_id} value={s.semester_id}>Sem {s.semester_number} ({s.academic_year})</option>)}
            </select>
          </>
        } />

      {editing && (
        <Modal title={isNew ? "Add course" : `Edit ${editing.course_code}`} onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" form="course-form" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
            </>
          }>
          <form id="course-form" onSubmit={save} noValidate>
            <div className="form-grid">
              <Field label="Course code" error={errors.course_code} required><input value={form.course_code} onChange={set("course_code")} /></Field>
              <Field label="Credits" error={errors.credits} required><input type="number" min="1" max="6" value={form.credits} onChange={set("credits")} /></Field>
              <Field label="Course name" error={errors.course_name} required className="span-2"><input value={form.course_name} onChange={set("course_name")} /></Field>
              <Field label="Department" error={errors.department_id} required>
                <select value={form.department_id} onChange={set("department_id")}>
                  <option value="">Select...</option>
                  {(departments.data || []).map((d) => <option key={d.department_id} value={d.department_id}>{d.dept_name}</option>)}
                </select>
              </Field>
              <Field label="Semester" error={errors.semester_id} required>
                <select value={form.semester_id} onChange={set("semester_id")}>
                  <option value="">Select...</option>
                  {(semesters.data || []).map((s) => <option key={s.semester_id} value={s.semester_id}>Sem {s.semester_number} ({s.academic_year})</option>)}
                </select>
              </Field>
              <Field label="Faculty" error={errors.faculty_id}>
                <select value={form.faculty_id} onChange={set("faculty_id")}>
                  <option value="">Not assigned</option>
                  {(faculty.data || []).map((f) => <option key={f.faculty_id} value={f.faculty_id}>{f.full_name} ({f.employee_code})</option>)}
                </select>
              </Field>
              <Field label="Max seats" error={errors.max_seats} required><input type="number" min="1" value={form.max_seats} onChange={set("max_seats")} /></Field>
            </div>
          </form>
        </Modal>
      )}

      {details && <CourseDetails course={details} canSeeStudents={role !== "student"} onClose={() => setDetails(null)} />}
    </>
  );
}

function CourseDetails({ course, canSeeStudents, onClose }) {
  const roster = useFetch(() => coursesApi.students(course.course_id), [course.course_id], canSeeStudents);
  return (
    <Modal title={`${course.course_code} - ${course.course_name}`} onClose={onClose} wide
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}>
      <div className="two-col">
        <dl className="kv">
          <dt>Department</dt><dd>{course.dept_name}</dd>
          <dt>Semester</dt><dd>Sem {course.semester_number} ({course.academic_year})</dd>
          <dt>Credits</dt><dd>{course.credits}</dd>
          <dt>Seats filled</dt><dd>{course.enrolled_count} of {course.max_seats}</dd>
        </dl>
        <dl className="kv">
          <dt>Faculty</dt><dd>{course.faculty_name || "Not assigned"}</dd>
          <dt>Designation</dt><dd>{course.faculty_designation || "-"}</dd>
          <dt>Email</dt><dd>{course.faculty_email || "-"}</dd>
        </dl>
      </div>
      {canSeeStudents && (
        <>
          <h3 style={{ margin: "20px 0 10px" }}>Enrolled students</h3>
          {roster.loading ? <Loader /> : roster.error ? <div className="alert alert-error">{roster.error}</div> : (
            <DataTable rowKey="enrollment_id" pageSize={6} searchPlaceholder="Search students..." empty="No students enrolled yet"
              rows={roster.data || []}
              columns={[
                { key: "roll_number", label: "Roll no." },
                { key: "student_name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "current_semester", label: "Sem", align: "center" },
              ]} />
          )}
        </>
      )}
    </Modal>
  );
}
