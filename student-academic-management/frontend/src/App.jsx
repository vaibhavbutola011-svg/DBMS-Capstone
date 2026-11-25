import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import FacultyDashboard from "./pages/FacultyDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentManagement from "./pages/StudentManagement";
import FacultyManagement from "./pages/FacultyManagement";
import CourseManagement from "./pages/CourseManagement";
import EnrollmentManagement from "./pages/EnrollmentManagement";
import AttendanceManagement from "./pages/AttendanceManagement";
import ExamsMarks from "./pages/ExamsMarks";
import AcademicReports from "./pages/AcademicReports";
import StudentProfile from "./pages/StudentProfile";
import AcademicSetup from "./pages/AcademicSetup";

/** /dashboard shows the dashboard that belongs to the logged-in role. */
function DashboardRouter() {
  const { role } = useAuth();
  if (role === "admin") return <AdminDashboard />;
  if (role === "faculty") return <FacultyDashboard />;
  return <StudentDashboard />;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/profile" element={<StudentProfile />} />
          <Route path="/courses" element={<CourseManagement />} />
          <Route path="/attendance" element={<AttendanceManagement />} />
          <Route path="/exams" element={<ExamsMarks />} />
          <Route path="/reports" element={<AcademicReports />} />

          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/students" element={<StudentManagement />} />
            <Route path="/faculty" element={<FacultyManagement />} />
            <Route path="/setup" element={<AcademicSetup />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin", "student"]} />}>
            <Route path="/enrollments" element={<EnrollmentManagement />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
