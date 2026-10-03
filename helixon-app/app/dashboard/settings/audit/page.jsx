"use client";

// /dashboard/settings/audit - who deleted, exported or changed what in the
// workspace (app/api/audit-log). Owner and admins only.

import { useCallback, useEffect, useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { Button, Card, EmptyState, ErrorState, LoadingCard, Page, PageHeader, Select, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

export default function AuditLogPage() {
  const [entries, setEntries] = useState([]);
  const [actions, setActions] = useState({});
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [action, setAction] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (before, filter) => {
    const q = new URLSearchParams();
    if (before) q.set("before", before);
    if (filter) q.set("action", filter);
    const res = await fetch(`/api/audit-log?${q}`, { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Couldn't load the audit log.");
    return d;
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(null, action)
      .then((d) => {
        if (cancelled) return;
        setEntries(d.entries);
        setActions(d.actions || {});
        setMore(d.more);
        setStatus(d.unavailable ? "unavailable" : "ready");
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load, action]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const d = await load(entries[entries.length - 1]?.at, action);
      setEntries((e) => [...e, ...d.entries]);
      setMore(d.more);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Page width={1000}>
      <PageHeader
        back={{ href: "/dashboard/settings", label: "Settings" }}
        eyebrow="Workspace"
        title="Audit log"
        subtitle="Deletions and exports of candidate data, team and permission changes, settings, API keys, webhooks and invoice changes - who did it and when."
        actions={
          entries.length > 0 && (
            <Button
              onClick={() =>
                downloadCsv(
                  `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
                  entries.map((e) => ({ When: e.at, Who: e.actor, What: e.label, Detail: e.summary || "", IP: e.ip || "" }))
                )
              }
            >
              Export CSV
            </Button>
          )
        }
      />
      <div className="flex">
        <Select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          options={[{ value: "", label: "Everything" }, ...Object.entries(actions).map(([value, label]) => ({ value, label }))]}
          style={{ maxWidth: 320 }}
        />
      </div>
      {status === "loading" && <LoadingCard rows={6} />}
      {status === "error" && <ErrorState title={error} />}
      {status === "unavailable" && <EmptyState title="Not switched on yet" body="The audit log needs a database update (migration 20261003020000)." />}
      {status === "ready" && entries.length === 0 && <EmptyState title="Nothing logged yet" body="Actions are recorded from now on." />}
      {status === "ready" && entries.length > 0 && (
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {entries.map((e) => (
              <li key={e.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 text-[13px]">
                <span className="tabular-nums shrink-0 sm:w-40" style={{ color: INK_FAINT }}>
                  {new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold" style={{ color: INK }}>{e.actor}</span>
                  <span style={{ color: INK_MUTED }}> · {e.label}</span>
                  {e.summary && <span className="block" style={{ color: INK_MUTED }}>{e.summary}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {more && (
        <Button onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Older entries"}
        </Button>
      )}
    </Page>
  );
}
