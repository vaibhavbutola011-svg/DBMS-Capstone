import { useState } from "react";
import { KeyRound, Pencil } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { authApi, facultyApi, getErrorMessage, getFieldErrors, studentsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import Field from "../components/Field";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import Badge from "../components/Badge";
import { validateForm } from "../utils/validation";
import { fmtDate } from "../utils/format";

/** Profile of the logged-in user (student profile, faculty profile, or admin account) + change password. */
export default function StudentProfile() {
  const { role, user } = useAuth();
  const toast = useToast();
  const profile = useFetch(
    () => (role === "student" ? studentsApi.me() : role === "faculty" ? facultyApi.me() : Promise.resolve(null)),
    [role]
  );
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState({ phone: "", address: "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  if (profile.loading) return <Loader />;
  if (profile.error) return <div className="alert alert-error">{profile.error}</div>;
  const p = profile.data;

  const saveContact = async (e) => {
    e.preventDefault();
    const found = validateForm(contact, { phone: { label: "Phone", phone: true } });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await studentsApi.updateMe(contact);
      toast.success("Profile updated");
      setEditing(false);
      profile.reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const found = validateForm(pw, {
      current_password: { label: "Current password", required: true },
      new_password: { label: "New password", required: true, password: true },
      confirm: { label: "Confirmation", required: true },
    });
    if (!found.confirm && pw.confirm !== pw.new_password) found.confirm = "Passwords do not match";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await authApi.changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      toast.success("Password changed");
      setPwOpen(false);
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your personal and academic details."
        actions={
          <>
            {role === "student" && (
              <button className="btn btn-ghost" onClick={() => { setContact({ phone: p.phone || "", address: p.address || "" }); setErrors({}); setEditing(true); }}>
                <Pencil size={16} /> Edit contact details
              </button>
            )}
            <button className="btn" onClick={() => { setErrors({}); setPwOpen(true); }}><KeyRound size={16} /> Change password</button>
          </>
        } />

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Personal details</h3>
          {role === "student" && (
            <dl className="kv">
              <dt>Name</dt><dd>{p.full_name}</dd>
              <dt>Roll number</dt><dd>{p.roll_number}</dd>
              <dt>Email</dt><dd>{p.email}</dd>
              <dt>Date of birth</dt><dd>{fmtDate(p.date_of_birth)}</dd>
              <dt>Gender</dt><dd>{p.gender}</dd>
              <dt>Phone</dt><dd>{p.phone || "-"}</dd>
              <dt>Address</dt><dd>{p.address || "-"}</dd>
            </dl>
          )}
          {role === "faculty" && (
            <dl className="kv">
              <dt>Name</dt><dd>{p.full_name}</dd>
              <dt>Employee code</dt><dd>{p.employee_code}</dd>
              <dt>Email</dt><dd>{p.email}</dd>
              <dt>Phone</dt><dd>{p.phone || "-"}</dd>
            </dl>
          )}
          {role === "admin" && (
            <dl className="kv">
              <dt>Name</dt><dd>{user.name}</dd>
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Role</dt><dd>Administrator</dd>
            </dl>
          )}
        </div>

        {role === "student" && (
          <div className="card">
            <h3 style={{ marginBottom: 14 }}>Academic details</h3>
            <dl className="kv">
              <dt>Department</dt><dd>{p.dept_name}</dd>
              <dt>Current semester</dt><dd>{p.current_semester}</dd>
              <dt>Admission year</dt><dd>{p.admission_year}</dd>
              <dt>Status</dt><dd><Badge tone={p.status === "active" ? "good" : "muted"}>{p.status}</Badge></dd>
            </dl>
          </div>
        )}
        {role === "faculty" && (
          <div className="card">
            <h3 style={{ marginBottom: 14 }}>Work details</h3>
            <dl className="kv">
              <dt>Department</dt><dd>{p.dept_name}</dd>
              <dt>Designation</dt><dd>{p.designation}</dd>
              <dt>Joined</dt><dd>{fmtDate(p.joining_date)}</dd>
              <dt>Courses</dt><dd>{p.course_count}</dd>
            </dl>
          </div>
        )}
      </div>

      {editing && (
        <Modal title="Edit contact details" onClose={() => setEditing(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn" form="contact-form" disabled={busy}>{busy ? "Saving..." : "Save"}</button></>}>
          <form id="contact-form" onSubmit={saveContact} noValidate className="stack" style={{ gap: 14 }}>
            <Field label="Phone" error={errors.phone}><input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></Field>
            <Field label="Address" error={errors.address}><input value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></Field>
          </form>
        </Modal>
      )}

      {pwOpen && (
        <Modal title="Change password" onClose={() => setPwOpen(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setPwOpen(false)}>Cancel</button>
            <button className="btn" form="pw-form" disabled={busy}>{busy ? "Saving..." : "Update password"}</button></>}>
          <form id="pw-form" onSubmit={savePassword} noValidate className="stack" style={{ gap: 14 }}>
            <Field label="Current password" error={errors.current_password} required>
              <input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} autoComplete="current-password" />
            </Field>
            <Field label="New password" error={errors.new_password} required hint="8+ characters, letters and digits">
              <input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" error={errors.confirm} required>
              <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
