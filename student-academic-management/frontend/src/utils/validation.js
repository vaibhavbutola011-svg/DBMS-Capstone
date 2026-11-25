const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+ -]{7,15}$/;

export function validateForm(form, rules) {
  /* rules: { field: { label, required, email, phone, minLength, password, min, max } } */
  const errors = {};
  Object.entries(rules).forEach(([field, rule]) => {
    const value = form[field];
    const empty = value === undefined || value === null || String(value).trim() === "";
    if (empty) {
      if (rule.required) errors[field] = `${rule.label} is required`;
      return;
    }
    const text = String(value).trim();
    if (rule.email && !EMAIL_RE.test(text)) errors[field] = "Enter a valid email address";
    else if (rule.phone && !PHONE_RE.test(text)) errors[field] = "Phone must be 7-15 digits";
    else if (rule.password && (text.length < 8 || !/[A-Za-z]/.test(text) || !/\d/.test(text)))
      errors[field] = "Use at least 8 characters with letters and digits";
    else if (rule.min !== undefined && Number(text) < rule.min) errors[field] = `${rule.label} must be at least ${rule.min}`;
    else if (rule.max !== undefined && Number(text) > rule.max) errors[field] = `${rule.label} must be at most ${rule.max}`;
  });
  return errors;
}
