import { useEffect, useState } from "react";
import { CheckCheck, Eye, Save } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { attendanceApi, coursesApi, getErrorMessage } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Field from "../components/Field";
import Badge, { PercentBar } from "../components/Badge";
import Loader from "../components/Loader";
import StatCard from "../components/StatCard";
import { CalendarCheck } from "lucide-react";
import { fmtDate, fmtPct, today } from "../utils/format";

export default function AttendanceManagement() {
  const { role } = useAuth();
  if (role === "student") return <StudentAttendance />;
  if (role === "faculty") return <FacultyAttendance />;
  return (
    <>
      <PageHeader title="Attendance Reports" subtitle="Attendance percentage of every student in every course." />
      <AttendanceReport />
    </>
  );
}

/* ----------------------------------------------------------- faculty (mark + report) */
function FacultyAttendance() {
  const [tab, setTab] = useState("mark");
  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark daily attendance for your courses and review reports." />
      <div className="tabs">
        <button className={`tab ${tab === "mark" ? "active" : ""}`} onClick={() => setTab("mark")}>Mark attendance</button>
        <button className={`tab ${tab === "report" ? "active" : ""}`} onClick={() => setTab("report")}>Attendance report</button>
      </div>
      {tab === "mark" ? <MarkAttendance /> : <AttendanceReport />}
    </>
  );
}

function MarkAttendance() {
  const toast = useToast();
  const courses = useFetch(() => coursesApi.list(), []);
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(today());
  const roster = useFetch(() => attendanceApi.roster(courseId, date), [courseId, date], !!courseId);
  const dates = useFetch(() => attendanceApi.dates(courseId), [courseId], !!courseId);
  const [statuses, setStatuses] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!roster.data) return setStatuses({});
    const next = {};
    roster.data.students.forEach((s) => { next[s.enrollment_id] = s.status || "present"; });
    setStatuses(next);
  }, [roster.data]);

  const students = roster.data?.students || [];
  const alreadyTaken = students.some((s) => s.status);

  const setAll = (value) => {
    const next = {};
    students.forEach((s) => { next[s.enrollment_id] = value; });
    setStatuses(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      const records = students.map((s) => ({ enrollment_id: s.enrollment_id, status: statuses[s.enrollment_id] }));
      const res = await attendanceApi.save(courseId, date, records);
      toast.success(res.message);
      roster.reload();
      dates.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const counts = Object.values(statuses).reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});

  const columns = [
    { key: "roll_number", label: "Roll no." },
    { key: "student_name", label: "Student" },
    { key: "status", label: "Saved", render: (r) => r.status ? <Badge tone={r.status === "absent" ? "bad" : r.status === "late" ? "warn" : "good"}>{r.status}</Badge> : <span className="muted">not marked</span> },
    {
      key: "mark", label: "Mark as", sortable: false,
      render: (r) => (
        <div className="att-options">
          {["present", "late", "absent"].map((v) => (
            <button key={v} type="button" className={statuses[r.enrollment_id] === v ? `on-${v}` : ""}
              onClick={() => setStatuses({ ...statuses, [r.enrollment_id]: v })}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="stack">
      <div className="card">
        <div className="filters-row" style={{ marginBottom: 0 }}>
          <Field label="Course">
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Select a course...</option>
              {(courses.data || []).map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code} - {c.course_name}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {courseId && dates.data?.length > 0 && (
            <Field label="Edit a previous class">
              <select value="" onChange={(e) => e.target.value && setDate(e.target.value)}>
                <option value="">Choose a date...</option>
                {dates.data.map((d) => <option key={d.date} value={d.date}>{fmtDate(d.date)} ({d.present_count}/{d.marked} present)</option>)}
              </select>
            </Field>
          )}
        </div>
      </div>

      {!courseId ? (
        <div className="alert alert-info">Select one of your courses to take attendance.</div>
      ) : roster.loading ? <Loader /> : roster.error ? <div className="alert alert-error">{roster.error}</div> : (
        <>
          {alreadyTaken && <div className="alert alert-info">Attendance was already saved for {fmtDate(date)}. Saving again will update it.</div>}
          <DataTable columns={columns} rows={students} rowKey="enrollment_id" pageSize={15} searchPlaceholder="Search students..."
            empty="No students are enrolled in this course"
            toolbar={
              <>
                <span className="muted">Present {counts.present || 0} / Late {counts.late || 0} / Absent {counts.absent || 0}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setAll("present")}><CheckCheck size={15} /> All present</button>
                <button className="btn" onClick={save} disabled={busy || students.length === 0}><Save size={17} /> {busy ? "Saving..." : "Save attendance"}</button>
              </>
            } />
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- report (admin + faculty) */
function AttendanceReport() {
  const courses = useFetch(() => coursesApi.list(), []);
  const [courseId, setCourseId] = useState("");
  const [defaulters, setDefaulters] = useState(false);
  const report = useFetch(
    () => attendanceApi.report({ course_id: courseId || undefined, below: defaulters ? 75 : undefined }),
    [courseId, defaulters]
  );

  const columns = [
    { key: "roll_number", label: "Roll no." },
    { key: "student_name", label: "Student" },
    { key: "course_code", label: "Course", render: (r) => `${r.course_code} - ${r.course_name}` },
    { key: "classes_attended", label: "Attended", align: "center", render: (r) => `${r.classes_attended ?? 0} / ${r.total_classes}` },
    { key: "attendance_percentage", label: "Attendance", render: (r) => <PercentBar value={r.attendance_percentage} />, sortValue: (r) => r.attendance_percentage ?? -1 },
  ];

  return (
    <DataTable columns={columns} rows={report.data || []} loading={report.loading} error={report.error}
      searchPlaceholder="Search by student or roll number..." empty="No attendance records found"
      toolbar={
        <>
          <select className="inline-select" value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Filter by course">
            <option value="">All courses</option>
            {(courses.data || []).map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code}</option>)}
          </select>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={defaulters} onChange={(e) => setDefaulters(e.target.checked)} />
            Below 75% only
          </label>
        </>
      } />
  );
}

/* ----------------------------------------------------------- student */
function StudentAttendance() {
  const att = useFetch(() => attendanceApi.mine(), []);
  const [selected, setSelected] = useState(null);

  const columns = [
    { key: "course_code", label: "Code" },
    { key: "course_name", label: "Course" },
    { key: "classes_attended", label: "Attended", align: "center", render: (r) => `${r.classes_attended ?? 0} / ${r.total_classes}` },
    { key: "attendance_percentage", label: "Attendance", render: (r) => <PercentBar value={r.attendance_percentage} />, sortValue: (r) => r.attendance_percentage ?? -1 },
    { key: "actions", label: "", align: "right", render: (r) => <button className="btn btn-ghost btn-sm" onClick={() => setSelected(r)}><Eye size={15} /> Daily record</button> },
  ];

  return (
    <>
      <PageHeader title="My Attendance" subtitle="75% attendance is required in each course." />
      <div className="stat-grid">
        <StatCard icon={CalendarCheck} label="Overall attendance" value={fmtPct(att.data?.overall_percentage)}
          tone={att.data?.overall_percentage !== null && att.data?.overall_percentage < 75 ? "red" : "green"} />
      </div>
      <DataTable columns={columns} rows={att.data?.courses || []} rowKey="course_id" loading={att.loading} error={att.error}
        searchable={false} empty="You have no attendance records yet" />
      {selected && <DailyRecord course={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function DailyRecord({ course, onClose }) {
  const rows = useFetch(() => attendanceApi.mineForCourse(course.course_id), [course.course_id]);
  return (
    <Modal title={`${course.course_code} - daily attendance`} onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}>
      {rows.loading ? <Loader /> : rows.error ? <div className="alert alert-error">{rows.error}</div> : (
        <DataTable searchable={false} rows={rows.data || []} pageSize={8} empty="No classes recorded yet"
          columns={[
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "absent" ? "bad" : r.status === "late" ? "warn" : "good"}>{r.status}</Badge> },
          ]} />
      )}
    </Modal>
  );
}
