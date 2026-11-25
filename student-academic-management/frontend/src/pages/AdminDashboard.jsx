import { AlertTriangle, BookOpen, Building2, CalendarCheck, ClipboardList, GraduationCap, Users, Award } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { dashboardApi } from "../services/api";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Loader from "../components/Loader";
import { BarCard, PieCard } from "../components/ChartCard";
import { fmtNum, fmtPct } from "../utils/format";

export default function AdminDashboard() {
  const { data, loading, error } = useFetch(() => dashboardApi.stats(), []);

  if (loading) return <Loader />;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Live overview of the institution, straight from the database." />
      <div className="stat-grid">
        <StatCard icon={Users} label="Total students" value={data.students} />
        <StatCard icon={GraduationCap} label="Faculty members" value={data.faculty} tone="navy" />
        <StatCard icon={BookOpen} label="Courses" value={data.courses} tone="green" />
        <StatCard icon={Building2} label="Departments" value={data.departments} tone="navy" />
        <StatCard icon={ClipboardList} label="Active enrollments" value={data.enrollments} />
        <StatCard icon={CalendarCheck} label="Average attendance" value={fmtPct(data.avg_attendance)} tone="green" />
        <StatCard icon={Award} label="Average CGPA" value={fmtNum(data.avg_cgpa)} tone="amber" />
        <StatCard icon={AlertTriangle} label="Students below 75% attendance" value={data.low_attendance_students} tone="red" />
      </div>
      <div className="chart-grid">
        <PieCard title="Students by department" data={data.students_by_department} />
        <BarCard title="Enrollments per course" data={data.enrollments_by_course} series={[{ key: "total", name: "Students" }]} />
        <BarCard title="Grade distribution" data={data.grade_distribution} series={[{ key: "total", name: "Students", color: "#0b2447" }]} />
      </div>
    </>
  );
}
