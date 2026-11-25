export default function Badge({ tone = "muted", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Progress bar coloured by attendance thresholds. */
export function PercentBar({ value }) {
  if (value === null || value === undefined) return <span className="muted">No classes yet</span>;
  const tone = value >= 85 ? "good" : value >= 75 ? "warn" : "bad";
  return (
    <div className="pbar">
      <div className="pbar-track">
        <div className={`pbar-fill pbar-${tone}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span>{Number(value).toFixed(1).replace(/\.0$/, "")}%</span>
    </div>
  );
}
