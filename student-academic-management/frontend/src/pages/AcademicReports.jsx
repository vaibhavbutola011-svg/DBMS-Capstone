import { useState } from "react";
import { Download } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { coursesApi, reportsApi, studentsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Badge, { PercentBar } from "../components/Badge";
import Loader from "../components/Loader";
import StatCard from "../components/StatCard";
import Field from "../components/Field";
import { Award } from "lucide-react";
import { downloadCsv, fmtNum, fmtPct, gradeTone } from "../utils/format";

export default function AcademicReports() {
  const { role } = useAuth();
  if (role === "student") return <StudentHistory />;
  return <StaffReports isAdmin={role === "admin"} />;
}

/* ----------------------------------------------------------- student: semester-wise history */
function SemesterBlocks({ history }) {
  if (!history.semesters.length) return <div className="alert alert-info">No academic history yet.</div>;
  return (
    <div className="stack">
      {history.semesters.map((s) => (
        <div className="card table-card sem-block" key={s.semester_id}>
          <div className="sem-head">
            <h3>Semester {s.semester_number} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>({s.academic_year})</span></h3>
            <div><Badge tone="blue">SGPA {fmtNum(s.sgpa)}</Badge> <span className="muted">{s.credits} credits graded</span></div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Course</th><th style={{ textAlign: "center" }}>Credits</th><th style={{ textAlign: "right" }}>Total %</th><th>Grade</th><th style={{ textAlign: "right" }}>Points</th></tr></thead>
              <tbody>
                {s.courses.map((c) => (
                  <tr key={c.course_id}>
                    <td>{c.course_code}</td><td>{c.course_name}</td>
                    <td style={{ textAlign: "center" }}>{c.credits}</td>
                    <td style={{ textAlign: "right" }}>{fmtPct(c.total_percentage)}</td>
                    <td>{c.letter_grade ? <Badge tone={gradeTone(c.letter_grade)}>{c.letter_grade}</Badge> : <span className="muted">pending</span>}</td>
                    <td style={{ textAlign: "right" }}>{fmtNum(c.grade_points, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function StudentHistory() {
  const history = useFetch(() => reportsApi.myHistory(), []);
  if (history.loading) return <Loader />;
  if (history.error) return <div className="alert alert-error">{history.error}</div>;
  return (
    <>
      <PageHeader title="Academic History" subtitle="Semester-wise results and CGPA." />
      <div className="stat-grid">
        <StatCard icon={Award} label="CGPA" value={fmtNum(history.data.cgpa)} hint="Out of 10" tone="amber" />
        <StatCard icon={Award} label="Credits graded" value={history.data.credits_graded} tone="navy" />
      </div>
      <SemesterBlocks history={history.data} />
    </>
  );
}

/* ----------------------------------------------------------- admin / faculty reports */
function StaffReports({ isAdmin }) {
  const [tab, setTab] = useState("course");
  return (
    <>
      <PageHeader title={isAdmin ? "Academic Reports" : "Course Reports"}
        subtitle="Marks, attendance and grades. Download any report as CSV." />
      <div className="tabs">
        <button className={`tab ${tab === "course" ? "active" : ""}`} onClick={() => setTab("course")}>Course report</button>
        {isAdmin && <button className={`tab ${tab === "performance" ? "active" : ""}`} onClick={() => setTab("performance")}>Academic performance</button>}
        {isAdmin && <button className={`tab ${tab === "cgpa" ? "active" : ""}`} onClick={() => setTab("cgpa")}>CGPA ranking</button>}
        {isAdmin && <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Student history</button>}
      </div>
      {tab === "course" && <CourseReport />}
      {tab === "performance" && <PerformanceReport />}
      {tab === "cgpa" && <CgpaRanking />}
      {tab === "history" && <StudentHistoryLookup />}
    </>
  );
}

function CourseReport() {
  const courses = useFetch(() => coursesApi.list(), []);
  const [courseId, setCourseId] = useState("");
  const report = useFetch(() => reportsApi.course(courseId), [courseId], !!courseId);
  const data = report.data;

  const exportCsv = () => {
    const headers = ["Roll no.", "Student", ...data.exams.map((e) => `${e.exam_name} (/${e.max_marks})`), "Attendance %", "Total %", "Grade"];
    const rows = data.students.map((s) => [s.roll_number, s.student_name, ...data.exams.map((e) => s.marks[e.exam_id] ?? ""),
      s.attendance_percentage ?? "", s.total_percentage ?? "", s.letter_grade ?? ""]);
    downloadCsv(`${data.course.course_code}_report.csv`, headers, rows);
  };

  const columns = data ? [
    { key: "roll_number", label: "Roll no." },
    { key: "student_name", label: "Student" },
    ...data.exams.map((e) => ({
      key: `exam_${e.exam_id}`, label: `${e.exam_name} (/${fmtNum(e.max_marks)})`, align: "right",
      render: (s) => s.marks[e.exam_id] === undefined ? <span className="muted">-</span> : fmtNum(s.marks[e.exam_id]),
      sortValue: (s) => s.marks[e.exam_id] ?? -1,
    })),
    { key: "attendance_percentage", label: "Attendance", render: (s) => <PercentBar value={s.attendance_percentage} />, sortValue: (s) => s.attendance_percentage ?? -1 },
    { key: "total_percentage", label: "Total %", align: "right", render: (s) => fmtPct(s.total_percentage), sortValue: (s) => s.total_percentage ?? -1 },
    { key: "letter_grade", label: "Grade", render: (s) => s.letter_grade ? <Badge tone={gradeTone(s.letter_grade)}>{s.letter_grade}</Badge> : <span className="muted">pending</span> },
  ] : [];

  return (
    <div className="stack">
      <div className="card">
        <Field label="Course">
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ maxWidth: 440 }}>
            <option value="">Select a course...</option>
            {(courses.data || []).map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code} - {c.course_name} (Sem {c.semester_number})</option>)}
          </select>
        </Field>
      </div>
      {!courseId ? <div className="alert alert-info">Select a course to see its marks and attendance report.</div>
        : report.loading ? <Loader /> : report.error ? <div className="alert alert-error">{report.error}</div> : (
          <DataTable columns={columns} rows={data.students} rowKey="student_id" pageSize={15} searchPlaceholder="Search students..."
            empty="No students are enrolled in this course"
            toolbar={<button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> Download CSV</button>} />
        )}
    </div>
  );
}

function PerformanceReport() {
  const courses = useFetch(() => coursesApi.list(), []);
  const [courseId, setCourseId] = useState("");
  const rows = useFetch(() => reportsApi.performance({ course_id: courseId || undefined }), [courseId]);

  const exportCsv = () => downloadCsv("academic_performance.csv",
    ["Roll no.", "Student", "Department", "Semester", "Course", "Credits", "Total %", "Grade", "Points"],
    (rows.data || []).map((r) => [r.roll_number, r.student_name, r.dept_name, r.semester_number, r.course_code, r.credits,
      r.total_percentage ?? "", r.letter_grade ?? "", r.grade_points ?? ""]));

  const columns = [
    { key: "roll_number", label: "Roll no." },
    { key: "student_name", label: "Student" },
    { key: "dept_name", label: "Department" },
    { key: "semester_number", label: "Sem", align: "center" },
    { key: "course_code", label: "Course" },
    { key: "total_percentage", label: "Total %", align: "right", render: (r) => fmtPct(r.total_percentage), sortValue: (r) => r.total_percentage ?? -1 },
    { key: "letter_grade", label: "Grade", render: (r) => r.letter_grade ? <Badge tone={gradeTone(r.letter_grade)}>{r.letter_grade}</Badge> : <span className="muted">pending</span> },
  ];

  return (
    <DataTable columns={columns} rows={rows.data || []} loading={rows.loading} error={rows.error} pageSize={12}
      searchPlaceholder="Search by student, roll number or course..." empty="No results found"
      toolbar={
        <>
          <select className="inline-select" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Filter by course">
            <option value="">All courses</option>
            {(courses.data || []).map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv}><Download size={16} /> CSV</button>
        </>
      } />
  );
}

function CgpaRanking() {
  const rows = useFetch(() => reportsApi.cgpa(), []);
  const columns = [
    { key: "rank_no", label: "Rank", align: "center" },
    { key: "roll_number", label: "Roll no." },
    { key: "student_name", label: "Student" },
    { key: "credits_graded", label: "Credits", align: "center" },
    { key: "cgpa", label: "CGPA", align: "right", render: (r) => <strong>{fmtNum(r.cgpa)}</strong> },
  ];
  return <DataTable columns={columns} rows={rows.data || []} rowKey="student_id" loading={rows.loading} error={rows.error}
    searchPlaceholder="Search students..." empty="No graded results yet" />;
}

function StudentHistoryLookup() {
  const students = useFetch(() => studentsApi.list(), []);
  const [studentId, setStudentId] = useState("");
  const history = useFetch(() => reportsApi.studentHistory(studentId), [studentId], !!studentId);
  return (
    <div className="stack">
      <div className="card">
        <Field label="Student">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ maxWidth: 440 }}>
            <option value="">Select a student...</option>
            {(students.data || []).map((s) => <option key={s.student_id} value={s.student_id}>{s.roll_number} - {s.full_name}</option>)}
          </select>
        </Field>
      </div>
      {!studentId ? <div className="alert alert-info">Select a student to see their semester-wise history.</div>
        : history.loading ? <Loader /> : history.error ? <div className="alert alert-error">{history.error}</div> : (
          <>
            <div className="stat-grid">
              <StatCard icon={Award} label={`CGPA - ${history.data.student_name}`} value={fmtNum(history.data.cgpa)} tone="amber" />
            </div>
            <SemesterBlocks history={history.data} />
          </>
        )}
    </div>
  );
}
