"use client";

import Link from "next/link";

// Request log table. Rows link each IP to Investigate; "Block" is offered
// for any IP that isn't already blocked.
export function RequestTable({ rows, blockedSet, onBlock, emptyLabel }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Source</th>
            <th>Request</th>
            <th>Location</th>
            <th>State</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="6" className="empty">
                {emptyLabel || "No request logs for this range - try a wider window."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>
                  {row.ts ? new Date(row.ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-"}
                </td>

                <td style={{ maxWidth: 280 }}>
                  {row.ip ? (
                    <Link className="mono panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(row.ip)}`} title="Investigate this IP">
                      {row.ip}
                    </Link>
                  ) : (
                    <span className="mono">-</span>
                  )}
                  <div className="muted truncate" title={row.user_agent || ""}>{row.user_agent || ""}</div>
                </td>

                <td style={{ maxWidth: 320 }}>
                  <b>{row.method || "GET"}</b>{" "}
                  <span className="mono">{row.path || "/"}</span>
                  {row.referer && <div className="muted truncate" title={row.referer}>{row.referer}</div>}
                </td>

                <td>{[row.city, row.country].filter(Boolean).join(", ") || "-"}</td>

                <td>
                  {row.blocked ? <span className="pill bad">Denied</span> : <span className="pill good">Allowed</span>}
                </td>

                <td>
                  {row.ip && !row.blocked && !blockedSet.has(row.ip) ? (
                    <button className="btn small danger" onClick={() => onBlock(row.ip)}>
                      Block
                    </button>
                  ) : blockedSet.has(row.ip) ? (
                    <span className="pill bad bare">IP blocked</span>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
