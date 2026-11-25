import { BookOpen, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { dashboardApi } from "../services/api";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Loader from "../components/Loader";
import DataTable from "../components/DataTable";
import { PercentBar } from "../components/Badge";
import { BarCard } from "../components/ChartCard";
import { fmtPct } from "../utils/format";

export default function FacultyDashboard() {
  const { data, loading, error } = useFetch(() => dashboardApi.stats(), []);

  if (loading) return <Loader />;
  if (error) return <div className="alert alert-error">{error}</div>;

  const chart = data.courses.map((c) => ({
    label: c.course_code, attendance: c.avg_attendance ?? 0, marks: c.avg_marks ?? 0,
  }));

  const columns = [
    { key: "course_code", label: "Code" },
    { key: "course_name", label: "Course" },
    { key: "students", label: "Students", align: "right" },
    { key: "avg_attendance", label: "Avg attendance", render: (r) => <PercentBar value={r.avg_attendance} /> },
    { key: "avg_marks", label: "Avg marks", align: "right", render: (r) => fmtPct(r.avg_marks) },
  ];

  return (
    <>
      <PageHeader title="Faculty Dashboard" subtitle="Your assigned courses and how your students are doing."
        actions={<Link to="/attendance" className="btn">Mark attendance</Link>} />
      <div className="stat-grid">
        <StatCard icon={BookOpen} label="Assigned courses" value={data.courses_count} />
        <StatCard icon={Users} label="Students taught" value={data.students_count} tone="navy" />
        <StatCard icon={FileText} label="Exams created" value={data.exams_count} tone="green" />
      </div>
      <div className="chart-grid">
        <BarCard title="Average attendance and marks per course (%)" data={chart} domain={[0, 100]}
          series={[{ key: "attendance", name: "Attendance %" }, { key: "marks", name: "Marks %", color: "#0b2447" }]} />
      </div>
      <h3 style={{ margin: "6px 0 12px" }}>My courses</h3>
      <DataTable columns={columns} rows={data.courses} rowKey="course_id" searchable={false} empty="No courses are assigned to you yet" />
    </>
  );
}
