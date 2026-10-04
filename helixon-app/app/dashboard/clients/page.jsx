"use client";

// /dashboard/clients - the companies the agency recruits for
// (app/api/clients): open jobs, contacts, placements and fees billed for
// each. Clients are also created automatically when a job names one.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getClients, createClient } from "@/lib/dashboard-api";
import { downloadCsv } from "@/lib/csv";
import {
  Page,
  PageHeader,
  Button,
  Field,
  TextInput,
  Dialog,
  EmptyState,
  ErrorState,
  ErrorText,
  LoadingCard,
  Pill,
  formatMoney,
  INK,
  INK_MUTED,
  INK_FAINT,
  CARD,
} from "@/components/dashboard/ui";

const STATUS_STYLE = {
  active: { label: "Active", color: "var(--forest)", background: "var(--mint)" },
  prospect: { label: "Prospect", color: "#8a5a12", background: "#fdf6e9" },
  inactive: { label: "Inactive", color: INK_FAINT, background: "var(--mist)" },
};

function NewClientDialog({ onClose, onCreated }) {
  const [f, setF] = useState({ name: "", industry: "", website: "", feePercent: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      onCreated(await createClient(f));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Dialog title="New client" onClose={onClose} busy={saving}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Company name">
          <TextInput required maxLength={200} value={f.name} onChange={set("name")} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Industry">
            <TextInput maxLength={120} value={f.industry} onChange={set("industry")} />
          </Field>
          <Field label="Website">
            <TextInput maxLength={300} value={f.website} onChange={set("website")} placeholder="acme.com" />
          </Field>
          <Field label="Standard fee (%)" hint="Of first-year salary - used to work out placement fees.">
            <TextInput type="number" min={0} max={100} step="0.5" value={f.feePercent} onChange={set("feePercent")} />
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={set("status")} className="w-full text-[14px] px-3 py-2 rounded-[8px] bg-white" style={{ border: "1px solid var(--border)", color: INK }}>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={saving || !f.name.trim()}>
            {saving ? "Creating…" : "Create client"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("current");
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    let cancelled = false;
    getClients()
      .then((c) => {
        if (cancelled) return;
        setClients(c);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);
  const closeNew = useCallback(() => setCreating(false), []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (clients ?? []).filter(
      (c) =>
        (filter === "all" || (filter === "current" ? c.status !== "inactive" : c.status === filter)) &&
        (!q || [c.name, c.industry, c.ownerName].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
    const by = {
      name: (a, b) => a.name.localeCompare(b.name),
      openJobs: (a, b) => b.openJobs - a.openJobs || a.name.localeCompare(b.name),
      fees: (a, b) => b.fees - a.fees || a.name.localeCompare(b.name),
      recent: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    }[sortBy];
    return [...list].sort(by);
  }, [clients, search, filter, sortBy]);

  const totals = useMemo(() => {
    const list = clients ?? [];
    return { open: list.reduce((s, c) => s + c.openJobs, 0), fees: list.reduce((s, c) => s + c.fees, 0) };
  }, [clients]);

  return (
    <Page>
      <PageHeader
        eyebrow="Client relationships"
        title="Clients"
        subtitle={
          status === "ready"
            ? `${clients.length} clients · ${totals.open} open jobs${clients.some((c) => c.fees === null) ? "" : ` · ${formatMoney(totals.fees)} billed`}`
            : null
        }
        actions={
          <>
            {status === "ready" && clients.length > 0 && (
              <Button
                onClick={() =>
                  downloadCsv(
                    `clients-${new Date().toISOString().slice(0, 10)}.csv`,
                    visible.map((c) => ({
                      Name: c.name,
                      Status: c.status,
                      Industry: c.industry || "",
                      Website: c.website || "",
                      Owner: c.ownerName || "",
                      "Open jobs": c.openJobs,
                      Contacts: c.contacts,
                      Placements: c.placements,
                      Fees: c.fees ?? "",
                      "Fee %": c.feePercent ?? "",
                      "Next follow-up": c.nextAction?.label || "",
                      "Follow-up due": c.nextAction?.dueAt ? c.nextAction.dueAt.slice(0, 10) : "",
                    }))
                  )
                }
              >
                Export CSV
              </Button>
            )}
            <Button variant="primary" onClick={() => setCreating(true)}>
              New client
            </Button>
          </>
        }
      />

      {status === "loading" && <LoadingCard rows={5} />}
      {status === "error" && <ErrorState title="Unable to load clients" onRetry={retry} />}
      {status === "ready" && clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          body="Add the companies you recruit for - or they'll appear here as soon as a job names its client."
          action={<Button variant="primary" onClick={() => setCreating(true)}>Add a client</Button>}
        />
      )}
      {status === "ready" && clients.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients, industries or owners…"
              aria-label="Search clients"
              className="text-[14px] px-4 py-2 rounded-full bg-white w-full sm:w-72"
              style={{ border: "1px solid var(--border)", color: INK }}
            />
            {[
              ["current", "Current"],
              ["active", "Active"],
              ["prospect", "Prospects"],
              ["inactive", "Inactive"],
              ["all", "All"],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                aria-pressed={filter === v}
                className="text-[13px] font-semibold px-3 py-1.5 rounded-full"
                style={{ background: filter === v ? "var(--forest)" : "white", color: filter === v ? "white" : INK_MUTED, border: `1px solid ${filter === v ? "var(--forest)" : "var(--border)"}` }}
              >
                {l}
              </button>
            ))}
            <select
              aria-label="Sort clients"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sm:ml-auto text-[13px] font-semibold px-3 py-1.5 rounded-full bg-white"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              <option value="name">Name A–Z</option>
              <option value="openJobs">Most open jobs</option>
              <option value="fees">Most fees billed</option>
              <option value="recent">Recently added</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-[14px] p-8 text-center text-[14px]" style={{ ...CARD, color: INK_MUTED }}>
              No clients match.
            </div>
          ) : (
            <div className="rounded-[14px] overflow-x-auto" style={CARD}>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] uppercase tracking-widest" style={{ color: INK_FAINT }}>
                    <th className="px-5 py-3 font-semibold">Client</th>
                    <th className="px-3 py-3 font-semibold hidden md:table-cell">Owner</th>
                    <th className="px-3 py-3 font-semibold text-right">Open jobs</th>
                    <th className="px-3 py-3 font-semibold text-right hidden sm:table-cell">Contacts</th>
                    <th className="px-3 py-3 font-semibold text-right hidden sm:table-cell">Placements</th>
                    <th className="px-5 py-3 font-semibold text-right">Fees</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => {
                    const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.active;
                    return (
                      <tr key={c.id} className="hover:bg-[var(--mist)] cursor-pointer" style={{ borderTop: "1px solid var(--border)" }} onClick={() => router.push(`/dashboard/clients/${c.id}`)}>
                        <td className="px-5 py-3">
                          <Link href={`/dashboard/clients/${c.id}`} className="font-semibold hover:underline" style={{ color: INK }} onClick={(e) => e.stopPropagation()}>
                            {c.name}
                          </Link>{" "}
                          {c.status !== "active" && <Pill color={st.color} background={st.background}>{st.label}</Pill>}
                          {c.industry && <p className="text-[13px]" style={{ color: INK_MUTED }}>{c.industry}</p>}
                          {c.nextAction && (
                            <p className="text-[12.5px]" style={{ color: c.nextAction.dueAt && new Date(c.nextAction.dueAt) < new Date() ? "var(--score-low)" : INK_MUTED }}>
                              Follow-up: {c.nextAction.label}
                              {c.nextAction.dueAt ? ` · ${new Date(c.nextAction.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell" style={{ color: INK_MUTED }}>{c.ownerName ?? "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: INK }}>{c.openJobs}</td>
                        <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell" style={{ color: INK_MUTED }}>{c.contacts}</td>
                        <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell" style={{ color: INK_MUTED }}>{c.placements}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: INK }}>{c.fees == null ? "Hidden" : c.fees ? formatMoney(c.fees) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {creating && <NewClientDialog onClose={closeNew} onCreated={(c) => router.push(`/dashboard/clients/${c.id}`)} />}
    </Page>
  );
}
