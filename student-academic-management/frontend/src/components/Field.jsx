/** Label + control + validation message. */
export default function Field({ label, error, required, hint, children, className = "" }) {
  return (
    <label className={`field ${error ? "field-error" : ""} ${className}`}>
      <span className="field-label">
        {label} {required && <em>*</em>}
      </span>
      {children}
      {error ? <span className="field-msg">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
