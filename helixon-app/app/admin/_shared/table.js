"use client";

import Link from "next/link";
import { OutcomePill, ThreatPill, formatStamp, readableQuery } from "./traffic-ui";

// Request log table. Each IP links to its dossier on Investigate; "Block"
// is offered for any IP that isn't already blocked. With `onOpen`, a row
// opens the request inspector (click, or Enter when focused).
export function RequestTable({ rows, blockedSet, onBlock, onOpen, emptyLabel }) {
  const stop = (e) => e.stopPropagation();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Source</th>
            <th>Request</th>
            <th>Location</th>
            <th>Outcome</th>
            <th>Threat</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="7" className="empty">
                {emptyLabel || "No request logs for this range - try a wider window."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={onOpen ? "clickable" : undefined}
                tabIndex={onOpen ? 0 : undefined}
                onClick={onOpen ? () => onOpen(row) : undefined}
                onKeyDown={onOpen ? (e) => e.key === "Enter" && e.target === e.currentTarget && onOpen(row) : undefined}
                title={onOpen ? "Inspect this request" : undefined}
              >
                <td className="mono" style={{ whiteSpace: "nowrap" }}>
                  {formatStamp(row.ts)}
                </td>

                <td style={{ maxWidth: 260 }}>
                  {row.ip ? (
                    <Link className="mono panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(row.ip)}`} title="Open this IP's dossier" onClick={stop}>
                      {row.ip}
                    </Link>
                  ) : (
                    <span className="mono">-</span>
                  )}
                  <div className="muted truncate" title={row.user_agent || ""}>{row.user_agent || ""}</div>
                </td>

                <td style={{ maxWidth: 340 }}>
                  <div className="truncate" title={`${row.path || "/"}${row.query ? `?${readableQuery(row.query)}` : ""}`}>
                    <b>{row.method || "GET"}</b> <span className="mono">{row.path || "/"}</span>
                    {row.query && <span className="mono faint">?{readableQuery(row.query)}</span>}
                  </div>
                  {row.referer && <div className="muted truncate" title={row.referer}>{row.referer}</div>}
                </td>

                <td>{[row.city, row.country].filter(Boolean).join(", ") || "-"}</td>

                <td>
                  <OutcomePill row={row} />
                </td>

                <td>
                  <ThreatPill score={row.threat_score} signals={row.signals} />
                </td>

                <td>
                  {row.ip && !row.blocked && !blockedSet.has(row.ip) ? (
                    <button
                      className="btn small danger"
                      onClick={(e) => {
                        stop(e);
                        onBlock(row.ip);
                      }}
                    >
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
