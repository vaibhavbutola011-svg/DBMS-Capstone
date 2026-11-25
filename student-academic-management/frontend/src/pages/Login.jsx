import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi, departmentsApi, getErrorMessage, getFieldErrors } from "../services/api";
import useFetch from "../hooks/useFetch";
import Field from "../components/Field";
import logo from "../assets/logo.svg";
import { validateForm } from "../utils/validation";

const DEMO = [
  { label: "Admin", email: "admin@college.edu", password: "Admin@123" },
  { label: "Faculty", email: "rajesh.kumar@college.edu", password: "Faculty@123" },
  { label: "Student", email: "aarav.sharma@college.edu", password: "Student@123" },
];

const EMPTY_REG = {
  email: "", password: "", roll_number: "", first_name: "", last_name: "", date_of_birth: "",
  gender: "Male", phone: "", department_id: "", current_semester: 1,
};

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [reg, setReg] = useState(EMPTY_REG);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const departments = useFetch(() => departmentsApi.list(), [], mode === "register");

  const switchMode = (m) => {
    setMode(m);
    setErrors({});
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    const found = validateForm(form, {
      email: { label: "Email", required: true, email: true },
      password: { label: "Password", required: true },
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate("/dashboard");
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    const found = validateForm(reg, {
      email: { label: "Email", required: true, email: true },
      password: { label: "Password", required: true, password: true },
      roll_number: { label: "Roll number", required: true },
      first_name: { label: "First name", required: true },
      last_name: { label: "Last name", required: true },
      date_of_birth: { label: "Date of birth", required: true },
      department_id: { label: "Department", required: true },
      phone: { label: "Phone", phone: true },
      current_semester: { label: "Semester", required: true, min: 1, max: 8 },
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await authApi.register(reg);
      toast.success("Registration successful. Please log in.");
      setForm({ email: reg.email, password: "" });
      setReg(EMPTY_REG);
      switchMode("login");
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setLogin = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setReg_ = (k) => (e) => setReg({ ...reg, [k]: e.target.value });

  return (
    <div className="login-page">
      <section className="login-hero">
        <img src={logo} alt="" width="56" height="56" />
        <h1>Student Course and Academic Management System</h1>
        <p>One platform for students, faculty and administrators to manage courses, attendance, marks and results.</p>
        <ul>
          <li>Role-based dashboards for Admin, Faculty and Students</li>
          <li>Live attendance, marks, grades and CGPA</li>
          <li>Secure login with hashed passwords</li>
        </ul>
      </section>

      <section className="login-panel">
        <div className="login-box card">
          <div className="tabs">
            <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>Sign in</button>
            <button className={`tab ${mode === "register" ? "active" : ""}`} onClick={() => switchMode("register")}>Student registration</button>
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin} noValidate className="stack" style={{ gap: 14 }}>
              <div>
                <h2>Welcome back</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>Sign in to continue to your dashboard.</p>
              </div>
              <Field label="Email" error={errors.email} required>
                <input type="email" value={form.email} onChange={setLogin("email")} placeholder="you@college.edu" autoComplete="username" />
              </Field>
              <Field label="Password" error={errors.password} required>
                <input type="password" value={form.password} onChange={setLogin("password")} autoComplete="current-password" />
              </Field>
              <button className="btn" disabled={busy}><LogIn size={18} /> {busy ? "Signing in..." : "Sign in"}</button>

              <div className="demo-box">
                <strong>Demo accounts</strong> (click to fill)
                <div className="demo-buttons">
                  {DEMO.map((d) => (
                    <button type="button" key={d.label} className="btn btn-ghost btn-sm"
                      onClick={() => { setForm({ email: d.email, password: d.password }); setErrors({}); }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={submitRegister} noValidate className="stack" style={{ gap: 14 }}>
              <div>
                <h2>Create student account</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>Faculty accounts are created by the administrator.</p>
              </div>
              <div className="form-grid">
                <Field label="First name" error={errors.first_name} required>
                  <input value={reg.first_name} onChange={setReg_("first_name")} />
                </Field>
                <Field label="Last name" error={errors.last_name} required>
                  <input value={reg.last_name} onChange={setReg_("last_name")} />
                </Field>
                <Field label="Email" error={errors.email} required className="span-2">
                  <input type="email" value={reg.email} onChange={setReg_("email")} />
                </Field>
                <Field label="Password" error={errors.password} required hint="8+ characters, letters and digits" className="span-2">
                  <input type="password" value={reg.password} onChange={setReg_("password")} autoComplete="new-password" />
                </Field>
                <Field label="Roll number" error={errors.roll_number} required>
                  <input value={reg.roll_number} onChange={setReg_("roll_number")} />
                </Field>
                <Field label="Date of birth" error={errors.date_of_birth} required>
                  <input type="date" value={reg.date_of_birth} onChange={setReg_("date_of_birth")} />
                </Field>
                <Field label="Gender" required>
                  <select value={reg.gender} onChange={setReg_("gender")}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <input value={reg.phone} onChange={setReg_("phone")} />
                </Field>
                <Field label="Department" error={errors.department_id} required>
                  <select value={reg.department_id} onChange={setReg_("department_id")}>
                    <option value="">Select...</option>
                    {(departments.data || []).map((d) => (
                      <option key={d.department_id} value={d.department_id}>{d.dept_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Current semester" error={errors.current_semester} required>
                  <input type="number" min="1" max="8" value={reg.current_semester} onChange={setReg_("current_semester")} />
                </Field>
              </div>
              <button className="btn" disabled={busy}><UserPlus size={18} /> {busy ? "Creating..." : "Create account"}</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
