import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const COLORS = ["#2f6fed", "#0b2447", "#5b9bd5", "#8fb4ff", "#1f4e9c", "#a7b7d1", "#3d5a80", "#6c8ebf"];

function Shell({ title, children, empty }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      {empty ? <div className="empty-chart">No data yet</div> : <div className="chart-box">{children}</div>}
    </div>
  );
}

/** series: [{ key, name, color? }] - one bar per series for every row's `label` */
export function BarCard({ title, data, series = [{ key: "total", name: "Total" }], domain, unit = "" }) {
  return (
    <Shell title={title} empty={!data || data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f1" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={domain} unit={unit} allowDecimals={false} />
          <Tooltip />
          {series.length > 1 && <Legend />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color || COLORS[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Shell>
  );
}

export function PieCard({ title, data }) {
  const rows = (data || []).filter((d) => d.total > 0);
  return (
    <Shell title={title} empty={rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="total" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {rows.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Shell>
  );
}

export function LineCard({ title, data, dataKey = "sgpa", domain = [0, 10] }) {
  return (
    <Shell title={title} empty={!data || data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e8f1" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={domain} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke="#2f6fed" strokeWidth={3} dot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </Shell>
  );
}
