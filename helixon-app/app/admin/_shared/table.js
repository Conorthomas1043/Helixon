"use client";

export function RequestTable({ rows, blockedSet, onBlock }) {
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
                No request logs for this range - try a wider window.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="mono">
                  {row.ts ? new Date(row.ts).toLocaleString() : "-"}
                </td>

                <td>
                  <span className="mono">{row.ip || "-"}</span>
                  <div className="muted mono-wrap">{row.user_agent || ""}</div>
                </td>

                <td>
                  <b>{row.method || "GET"}</b>{" "}
                  <span className="mono">{row.path || "/"}</span>
                  <div className="muted">{row.referer || ""}</div>
                </td>

                <td>
                  {[row.city, row.country].filter(Boolean).join(", ") || "-"}
                </td>

                <td>
                  {row.blocked ? (
                    <span className="pill bad">Denied</span>
                  ) : (
                    <span className="pill good">Allowed</span>
                  )}
                </td>

                <td>
                  {row.ip && !row.blocked && !blockedSet.has(row.ip) ? (
                    <button
                      className="btn small danger"
                      onClick={() => onBlock(row.ip)}
                    >
                      Block
                    </button>
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
