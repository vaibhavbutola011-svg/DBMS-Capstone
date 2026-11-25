import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import Loader from "./Loader";

/**
 * Interactive table: live search, click-to-sort headers, pagination.
 * columns: [{ key, label, render?(row), sortValue?(row), sortable?, align? }]
 * toolbar: extra controls (filters, buttons) shown next to the search box.
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  error = "",
  searchPlaceholder = "Search...",
  pageSize = 10,
  toolbar = null,
  empty = "No records found",
  searchable = true,
  rowKey,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const list = rows || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) =>
      Object.values(row).some((v) => v !== null && typeof v !== "object" && String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const val = (row) => (col?.sortValue ? col.sortValue(row) : row[sort.key]);
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return (
    <div className="card table-card">
      {(searchable || toolbar) && (
        <div className="table-toolbar">
          {searchable && (
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                aria-label="Search table"
              />
            </div>
          )}
          {toolbar && <div className="toolbar-extra">{toolbar}</div>}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false && c.key !== "actions";
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    style={{ textAlign: c.align || "left" }}
                    className={sortable ? "sortable" : ""}
                    onClick={sortable ? () => toggleSort(c.key) : undefined}
                  >
                    <span className="th-inner">
                      {c.label}
                      {active && (sort.dir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length}>
                  <Loader />
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-cell">
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr key={rowKey ? row[rowKey] : i}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align || "left" }}>
                      {c.render ? c.render(row) : (row[c.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div className="pagination">
          <span>
            Showing {(current - 1) * pageSize + 1}-{Math.min(current * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div>
            <button className="btn btn-ghost btn-sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous
            </button>
            <span className="page-num">
              {current} / {pages}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={current === pages} onClick={() => setPage(current + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
