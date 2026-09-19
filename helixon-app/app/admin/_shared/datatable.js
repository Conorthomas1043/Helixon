"use client";

import { useMemo, useState } from "react";
import { Icon } from "./icons";
import { Skeleton, EmptyState } from "./ui";

// Sortable, paginated table used by the newer console pages.
//
//   <DataTable
//     columns={[{ key: "name", label: "Agency", render: (row) => ..., sortValue: (row) => ..., align: "right" }]}
//     rows={rows}
//     loading={loading}
//     onRowClick={(row) => ...}
//     empty={{ icon: "building", title: "No agencies yet", body: "..." }}
//     defaultSort={{ key: "createdAt", dir: "desc" }}
//   />
//
// Sorting and paging happen in the browser over the rows it is given, which is
// right for the few-hundred-row lists the console loads.

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1; // empty values sink to the bottom
  if (b === null || b === undefined || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function DataTable({
  columns,
  rows,
  rowKey = "id",
  loading = false,
  empty,
  onRowClick,
  pageSize = 15,
  defaultSort = null,
}) {
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const valueOf = column.sortValue || ((row) => row[column.key]);
    const direction = sort.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      // Keep empties last whichever way we're sorting.
      const aEmpty = av === null || av === undefined || av === "";
      const bEmpty = bv === null || bv === undefined || bv === "";
      if (aEmpty || bEmpty) return compare(av, bv);
      return compare(av, bv) * direction;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages); // clamp instead of resetting in an effect
  const start = (current - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  function toggleSort(column) {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== column.key) return { key: column.key, dir: column.defaultDir || "asc" };
      return { key: column.key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  const showSkeleton = loading && rows.length === 0;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  className={`${column.sortable ? "sortable" : ""} ${column.align === "right" ? "num" : ""}`}
                  style={column.width ? { width: column.width } : undefined}
                  onClick={column.sortable ? () => toggleSort(column) : undefined}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {column.label}
                  {active && (
                    <span className="sort-arrow">
                      <Icon name={sort.dir === "asc" ? "arrowUp" : "arrowDown"} size={11} strokeWidth={2.6} />
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {showSkeleton &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((column) => (
                  <td key={column.key}>
                    <Skeleton width={column.align === "right" ? 40 : `${55 + ((i * 13 + column.key.length * 7) % 40)}%`} />
                  </td>
                ))}
              </tr>
            ))}

          {!showSkeleton && visible.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 0 }}>
                <EmptyState icon={empty?.icon} title={empty?.title || "Nothing here yet"}>
                  {empty?.body}
                </EmptyState>
              </td>
            </tr>
          )}

          {visible.map((row) => (
            <tr
              key={row[rowKey]}
              className={onRowClick ? "clickable" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <td key={column.key} className={column.align === "right" ? "num" : undefined}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {sorted.length > pageSize && (
        <div className="table-foot">
          <span>
            Showing {start + 1}-{Math.min(start + pageSize, sorted.length)} of {sorted.length}
          </span>
          <span className="actions">
            <button className="btn small" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              <Icon name="chevronLeft" /> Previous
            </button>
            <button className="btn small" disabled={current >= pages} onClick={() => setPage(current + 1)}>
              Next <Icon name="chevronRight" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
