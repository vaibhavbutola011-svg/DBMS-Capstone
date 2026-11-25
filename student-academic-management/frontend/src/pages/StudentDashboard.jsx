import { Award, BookOpen, CalendarCheck, GraduationCap } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { dashboardApi } from "../services/api";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Loader from "../components/Loader";
import { BarCard, LineCard } from "../components/ChartCard";
import { useAuth } from "../context/AuthContext";
import { fmtNum, fmtPct } from "../utils/format";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch(() => dashboardApi.stats(), []);

  if (loading) return <Loader />;
  if (error) return <div className="alert alert-error">{error}</div>;

  const attendance = data.attendance_by_course.map((a) => ({
    label: a.course_code, percentage: a.attendance_percentage ?? 0,
  }));
  const low = data.overall_attendance !== null && data.overall_attendance < 75;

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Your academic summary." />
      {low && (
        <div className="alert alert-error">
          Your overall attendance is below 75%. Please attend classes regularly to stay eligible for exams.
        </div>
      )}
      <div className="stat-grid">
        <StatCard icon={Award} label="CGPA" value={fmtNum(data.cgpa)} hint="Out of 10" tone="amber" />
        <StatCard icon={GraduationCap} label="Credits earned (graded)" value={data.credits_graded} tone="navy" />
        <StatCard icon={BookOpen} label="Courses this semester" value={data.enrolled_courses} />
        <StatCard icon={CalendarCheck} label="Overall attendance" value={fmtPct(data.overall_attendance)}
          tone={low ? "red" : "green"} />
      </div>
      <div className="chart-grid">
        <BarCard title="Attendance by course (%)" data={attendance} domain={[0, 100]}
          series={[{ key: "percentage", name: "Attendance %" }]} />
        <LineCard title="Semester GPA trend" data={data.sgpa_trend} />
      </div>
    </>
  );
}
