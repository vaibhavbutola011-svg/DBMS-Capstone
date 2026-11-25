import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3, BookOpen, Building2, CalendarCheck, ClipboardList, FileText, GraduationCap,
  LayoutDashboard, LogOut, Menu, UserCircle, Users, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.svg";

const NAV = {
  admin: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/students", label: "Students", icon: Users },
    { to: "/faculty", label: "Faculty", icon: GraduationCap },
    { to: "/courses", label: "Courses", icon: BookOpen },
    { to: "/enrollments", label: "Enrollments", icon: ClipboardList },
    { to: "/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/exams", label: "Exams & Marks", icon: FileText },
    { to: "/reports", label: "Academic Reports", icon: BarChart3 },
    { to: "/setup", label: "Departments & Semesters", icon: Building2 },
  ],
  faculty: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/courses", label: "My Courses", icon: BookOpen },
    { to: "/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/exams", label: "Exams & Marks", icon: FileText },
    { to: "/reports", label: "Reports", icon: BarChart3 },
  ],
  student: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/profile", label: "My Profile", icon: UserCircle },
    { to: "/courses", label: "Courses", icon: BookOpen },
    { to: "/enrollments", label: "My Enrollments", icon: ClipboardList },
    { to: "/attendance", label: "My Attendance", icon: CalendarCheck },
    { to: "/exams", label: "Marks & Grades", icon: FileText },
    { to: "/reports", label: "Academic History", icon: BarChart3 },
  ],
};

export default function DashboardLayout() {
  const { user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.name || "U").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <img src={logo} alt="" width="34" height="34" />
          <div>
            <strong>EduManage</strong>
            <span>Academic System</span>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav>
          {NAV[role]?.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="nav-link logout" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="topbar-title">
            {role === "admin" ? "Administrator Console" : role === "faculty" ? "Faculty Portal" : "Student Portal"}
          </div>
          <NavLink to="/profile" className="user-chip">
            <span className="avatar">{initials}</span>
            <span className="user-meta">
              <strong>{user?.name}</strong>
              <small>{role}</small>
            </span>
          </NavLink>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
