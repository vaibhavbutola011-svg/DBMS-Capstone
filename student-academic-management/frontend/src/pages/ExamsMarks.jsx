import { useEffect, useState } from "react";
import { Pencil, Plus, Save, Trash2, ClipboardList } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { coursesApi, examsApi, getErrorMessage, getFieldErrors, reportsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Loader from "../components/Loader";
import StatCard from "../components/StatCard";
import { Award } from "lucide-react";
import { fmtDate, fmtNum, fmtPct, gradeTone } from "../utils/format";
import { validateForm } from "../utils/validation";

export default function ExamsMarks() {
  const { role } = useAuth();
  return role === "student" ? <StudentResults /> : <StaffExams isAdmin={role === "admin"} />;
}

/* ----------------------------------------------------------- admin + faculty */
const blankExam = (courseId) => ({ course_id: courseId || "", exam_name: "", exam_type: "internal", exam_date: "", max_marks: 50 });

function StaffExams({ isAdmin }) {
  const toast = useToast();
  const courses = useFetch(() => coursesApi.list(), []);
  const [courseId, setCourseId] = useState("");
  const exams = useFetch(() => examsApi.list({ course_id: courseId || undefined }), [courseId]);
  const results = useFetch(() => reportsApi.performance({ course_id: courseId }), [courseId], !!courseId);

  const [examForm, setExamForm] = useState(null);   // null | blank/edit exam object
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [marksFor, setMarksFor] = useState(null);

  const set = (k) => (e) => setExamForm({ ...examForm, [k]: e.target.value });
  const isNew = examForm && !examForm.exam_id;

  const saveExam = async (e) => {
    e.preventDefault();
    const found = validateForm(examForm, {
      course_id: { label: "Course", required: true },
      exam_name: { label: "Exam name", required: true },
      exam_date: { label: "Exam date", required: true },
      max_marks: { label: "Max marks", required: true, min: 1 },
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (isNew) await examsApi.create(examForm);
      else await examsApi.update(examForm.exam_id, examForm);
      toast.success(isNew ? "Exam created" : "Exam updated");
      setExamForm(null);
      exams.reload();
      results.reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeExam = async (row) => {
    if (!window.confirm(`Delete "${row.exam_name}" and all marks entered for it?`)) return;
    try {
      await examsApi.remove(row.exam_id);
      toast.success("Exam deleted");
      exams.reload();
      results.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const examColumns = [
    { key: "course_code", label: "Course" },
    { key: "exam_name", label: "Exam" },
    { key: "exam_type", label: "Type", render: (r) => <Badge tone="blue">{r.exam_type}</Badge> },
    { key: "exam_date", label: "Date", render: (r) => fmtDate(r.exam_date) },
    { key: "max_marks", label: "Max marks", align: "right", render: (r) => fmtNum(r.max_marks) },
    { key: "marks_entered", label: "Marks entered", align: "center" },
    {
      key: "actions", label: "", align: "right",
      render: (r) => (
        <div className="row-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setMarksFor(r)}><ClipboardList size={15} /> Marks</button>
          <button className="icon-btn" title="Edit exam" onClick={() => { setErrors({}); setExamForm({ ...r, exam_date: String(r.exam_date).slice(0, 10) }); }}><Pencil size={17} /></button>
          <button className="icon-btn" title="Delete exam" onClick={() => removeExam(r)}><Trash2 size={17} color="#c62f3e" /></button>
        </div>
      ),
    },
  ];

  const resultColumns = [
    { key: "roll_number", label: "Roll no." },
    { key: "student_name", label: "Student" },
    { key: "total_percentage", label: "Total %", align: "right", render: (r) => fmtPct(r.total_percentage), sortValue: (r) => r.total_percentage ?? -1 },
    { key: "letter_grade", label: "Grade", render: (r) => r.letter_grade ? <Badge tone={gradeTone(r.letter_grade)}>{r.letter_grade}</Badge> : <span className="muted">pending</span> },
    { key: "grade_points", label: "Grade points", align: "right", render: (r) => fmtNum(r.grade_points, 1) },
  ];

  return (
    <>
      <PageHeader title="Examinations and Marks" subtitle={isAdmin ? "View exams, marks and results across courses." : "Create exams for your courses and enter marks. Grades update automatically."}
        actions={<button className="btn" onClick={() => { setErrors({}); setExamForm(blankExam(courseId)); }}><Plus size={18} /> New exam</button>} />

      <div className="card" style={{ marginBottom: 16 }}>
        <Field label="Course" className="">
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ maxWidth: 420 }}>
            <option value="">All courses</option>
            {(courses.data || []).map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code} - {c.course_name}</option>)}
          </select>
        </Field>
      </div>

      <DataTable columns={examColumns} rows={exams.data || []} rowKey="exam_id" loading={exams.loading} error={exams.error}
        searchPlaceholder="Search exams..." empty="No exams yet. Create one with the 'New exam' button." />

      {courseId && (
        <>
          <h3 style={{ margin: "26px 0 12px" }}>Results and grades for this course</h3>
          <DataTable columns={resultColumns} rows={results.data || []} loading={results.loading} error={results.error}
            searchPlaceholder="Search students..." empty="No results yet. Enter marks for an exam first." />
        </>
      )}

      {examForm && (
        <Modal title={isNew ? "New exam" : `Edit ${examForm.exam_name}`} onClose={() => setExamForm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setExamForm(null)}>Cancel</button>
              <button className="btn" form="exam-form" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
            </>
          }>
          <form id="exam-form" onSubmit={saveExam} noValidate>
            <div className="form-grid">
              <Field label="Course" error={errors.course_id} required className="span-2">
                <select value={examForm.course_id} onChange={set("course_id")} disabled={!isNew}>
                  <option value="">Select...</option>
                  {(courses.data || []).map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code} - {c.course_name}</option>)}
                </select>
              </Field>
              <Field label="Exam name" error={errors.exam_name} required><input value={examForm.exam_name} onChange={set("exam_name")} placeholder="e.g. Midterm" /></Field>
              <Field label="Type" error={errors.exam_type}>
                <select value={examForm.exam_type} onChange={set("exam_type")}>
                  <option value="internal">Internal</option><option value="midterm">Midterm</option>
                  <option value="final">Final</option><option value="assignment">Assignment</option>
                </select>
              </Field>
              <Field label="Date" error={errors.exam_date} required><input type="date" value={examForm.exam_date} onChange={set("exam_date")} /></Field>
              <Field label="Max marks" error={errors.max_marks} required><input type="number" min="1" step="0.5" value={examForm.max_marks} onChange={set("max_marks")} /></Field>
            </div>
          </form>
        </Modal>
      )}

      {marksFor && <MarksEntry exam={marksFor} onClose={() => setMarksFor(null)}
        onSaved={() => { exams.reload(); results.reload(); }} />}
    </>
  );
}

function MarksEntry({ exam, onClose, onSaved }) {
  const toast = useToast();
  const sheet = useFetch(() => examsApi.marks(exam.exam_id), [exam.exam_id]);
  const [values, setValues] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const max = Number(exam.max_marks);

  useEffect(() => {
    if (!sheet.data) return;
    const next = {};
    sheet.data.students.forEach((s) => { next[s.enrollment_id] = s.marks_obtained ?? ""; });
    setValues(next);
  }, [sheet.data]);

  const save = async () => {
    const errs = {};
    Object.entries(values).forEach(([id, v]) => {
      if (v === "" || v === null) return;
      const n = Number(v);
      if (Number.isNaN(n)) errs[id] = "Must be a number";
      else if (n < 0 || n > max) errs[id] = `0 to ${max}`;
    });
    setRowErrors(errs);
    if (Object.keys(errs).length) return toast.error("Please fix the highlighted marks");
    setBusy(true);
    try {
      const records = Object.entries(values).map(([id, v]) => ({ enrollment_id: Number(id), marks_obtained: v === "" ? null : v }));
      const res = await examsApi.saveMarks(exam.exam_id, records);
      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      setRowErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: "roll_number", label: "Roll no." },
    { key: "student_name", label: "Student" },
    {
      key: "marks", label: `Marks (out of ${fmtNum(max)})`, align: "right", sortable: false,
      render: (r) => (
        <div>
          <input className="marks-input" type="number" min="0" max={max} step="0.5" value={values[r.enrollment_id] ?? ""}
            onChange={(e) => setValues({ ...values, [r.enrollment_id]: e.target.value })}
            style={rowErrors[r.enrollment_id] ? { borderColor: "#c62f3e" } : undefined} aria-label={`Marks for ${r.student_name}`} />
          {rowErrors[r.enrollment_id] && <div className="field-msg">{rowErrors[r.enrollment_id]}</div>}
        </div>
      ),
    },
  ];

  return (
    <Modal title={`${exam.course_code}: ${exam.exam_name}`} onClose={onClose} wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy || !sheet.data}><Save size={17} /> {busy ? "Saving..." : "Save marks"}</button>
        </>
      }>
      {sheet.loading ? <Loader /> : sheet.error ? <div className="alert alert-error">{sheet.error}</div> : (
        <DataTable columns={columns} rows={sheet.data.students} rowKey="enrollment_id" pageSize={12}
          searchPlaceholder="Search students..." empty="No students are enrolled in this course" />
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------- student */
function StudentResults() {
  const res = useFetch(() => examsApi.myMarks(), []);

  if (res.loading) return <Loader />;
  if (res.error) return <div className="alert alert-error">{res.error}</div>;

  const { marks, grades, cgpa, credits_graded: credits } = res.data;
  const byCourse = marks.reduce((acc, m) => {
    (acc[m.course_id] = acc[m.course_id] || { ...m, exams: [] }).exams.push(m);
    return acc;
  }, {});
  const gradeOf = Object.fromEntries(grades.map((g) => [g.course_id, g]));

  return (
    <>
      <PageHeader title="Marks and Grades" subtitle="Your examination results, grades and CGPA." />
      <div className="stat-grid">
        <StatCard icon={Award} label="CGPA" value={fmtNum(cgpa)} hint="Out of 10" tone="amber" />
        <StatCard icon={Award} label="Credits graded" value={credits} tone="navy" />
      </div>

      <div className="stack">
        {Object.values(byCourse).length === 0 && <div className="alert alert-info">No examinations have been held for your courses yet.</div>}
        {Object.values(byCourse).map((c) => {
          const g = gradeOf[c.course_id];
          return (
            <div className="card table-card sem-block" key={c.course_id}>
              <div className="sem-head">
                <h3>{c.course_code} - {c.course_name} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>(Sem {c.semester_number}, {c.credits} credits)</span></h3>
                <div>
                  {g?.letter_grade ? (
                    <><Badge tone={gradeTone(g.letter_grade)}>Grade {g.letter_grade}</Badge> <span className="muted">{fmtPct(g.total_percentage)}</span></>
                  ) : <span className="muted">Grade pending</span>}
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Exam</th><th>Type</th><th>Date</th><th style={{ textAlign: "right" }}>Marks</th><th style={{ textAlign: "right" }}>Out of</th></tr></thead>
                  <tbody>
                    {c.exams.map((x) => (
                      <tr key={x.exam_id}>
                        <td>{x.exam_name}</td>
                        <td><Badge tone="blue">{x.exam_type}</Badge></td>
                        <td>{fmtDate(x.exam_date)}</td>
                        <td style={{ textAlign: "right" }}>{x.marks_obtained === null ? <span className="muted">not entered</span> : fmtNum(x.marks_obtained)}</td>
                        <td style={{ textAlign: "right" }}>{fmtNum(x.max_marks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
