"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader, KpiCard, Avatar, Drawer, EmptyState } from "../_shared/ui";
import { Icon } from "../_shared/icons";
import { DataTable } from "../_shared/datatable";
import { formatDateTime, timeAgo } from "../_shared/data";
import { csrfHeaders } from "../_shared/csrf";
import { confirmAction, promptText } from "../_shared/modal";
import { toast } from "../_shared/toast";
import { SecretReveal } from "../employees/access";

// Admin › Customers › Test accounts: free Helixon logins for prospects
// (lib/admin/test-accounts.js), with what each one has done.

const LENGTHS = [
  ["7", "7 days"],
  ["14", "14 days"],
  ["30", "30 days"],
  ["", "No end date"],
];
const STATUS_PILL = {
  active: ["good", "Active"],
  expired: ["warn", "Expired"],
  ended: ["bad", "Ended"],
  converted: ["info", "Bought a plan"],
};
const KIND = {
  account: ["user", "info"],
  workspace: ["settings", ""],
  candidate: ["users", ""],
  screening: ["sparkle", "good"],
  job: ["briefcase", ""],
  admin: ["shield", "warn"],
};

async function call(method, url, body, fallback) {
  const response = await fetch(url, {
    method,
    headers: csrfHeaders({ "content-type": "application/json" }),
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("Your admin session has ended. Sign in again to continue.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || fallback);
  return data;
}

function StatusPill({ status }) {
  const [tone, label] = STATUS_PILL[status] || ["", status];
  return <span className={`pill ${tone}`}>{label}</span>;
}

function credentialsText(created) {
  return `Sign in at ${created.signInUrl}\nEmail: ${created.email}\nPassword: ${created.password}`;
}

function CreateDrawer({ open, onClose, onCreated }) {
  const empty = { name: "", email: "", agencyName: "", days: "14", screeningCap: "50" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function close() {
    setForm(empty);
    setCreated(null);
    onClose();
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await call(
        "POST",
        "/api/admin/test-accounts",
        { name: form.name.trim(), email: form.email.trim(), agencyName: form.agencyName.trim(), days: form.days ? Number(form.days) : null, screeningCap: Number(form.screeningCap) },
        "Couldn't create the test account.",
      );
      setCreated({ email: data.account.email, password: data.password, signInUrl: data.signInUrl });
      toast.success(`Created a test account for ${data.account.email}`);
      onCreated();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(credentialsText(created));
      toast.success("Sign-in details copied");
    } catch {
      toast.warn("Couldn't copy - select the details and copy them by hand.");
    }
  }

  return (
    <Drawer open={open} onClose={close} title="New test account" subtitle="A working Helixon login with no payment. It ends on its own at the end date.">
      {created ? (
        <div className="stack">
          <dl className="kv">
            <dt>Sign in at</dt>
            <dd className="mono">{created.signInUrl}</dd>
            <dt>Email</dt>
            <dd>{created.email}</dd>
          </dl>
          <SecretReveal title="Password" secret={created.password} />
          <div className="actions">
            <button type="button" className="btn" onClick={copyAll}>
              <Icon name="copy" size={13} /> Copy all sign-in details
            </button>
            <button type="button" className="btn primary" onClick={close}>Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ta-name">Their name</label>
              <input id="ta-name" value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={120} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="ta-email">Their email</label>
              <input id="ta-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required maxLength={254} />
            </div>
            <div className="field ta-wide">
              <label htmlFor="ta-agency">Agency name</label>
              <input id="ta-agency" value={form.agencyName} onChange={(e) => set({ agencyName: e.target.value })} maxLength={100} placeholder="Their agency, or leave blank" />
            </div>
            <div className="field">
              <label htmlFor="ta-days">Access for</label>
              <select id="ta-days" className="select-input" value={form.days} onChange={(e) => set({ days: e.target.value })}>
                {LENGTHS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ta-cap">Screenings a month</label>
              <input id="ta-cap" type="number" min={1} max={10000} value={form.screeningCap} onChange={(e) => set({ screeningCap: e.target.value })} required />
            </div>
          </div>
          <p className="perm-desc ta-note">
            They get the full Agency plan. Texting, API keys and webhooks are off, and email to people outside the workspace is limited to 20 a day.
          </p>
          <div className="actions">
            <button type="submit" className="btn primary" disabled={busy}>Create test account</button>
            <button type="button" className="btn ghost" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

function AccountDrawer({ accountId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(null);

  const load = useCallback(async () => {
    try {
      setDetail(await call("GET", `/api/admin/test-accounts/${accountId}`, null, "Couldn't load the account."));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the drawer opens; the state it sets is the point
    load();
  }, [load]);

  async function act(action, extra = {}, done = "Done") {
    setBusy(true);
    try {
      const data = await call("PATCH", "/api/admin/test-accounts", { id: accountId, action, ...extra }, "That didn't work.");
      if (data.password) setPassword(data.password);
      toast.success(done);
      await load();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function extend() {
    const days = await promptText("Give access for how many days from today? (1-365; 0 for no end date)", { defaultValue: "14" });
    if (days === null || days === undefined) return;
    const n = Number(days);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a number of days.");
    act("extend", { days: n }, n >= 1 ? `Access runs for ${Math.min(n, 365)} more days` : "Access has no end date now");
  }

  async function setCap() {
    const cap = await promptText("Screenings allowed a month", { defaultValue: String(detail?.account?.screeningCap ?? 50) });
    if (cap === null || cap === undefined) return;
    act("set_cap", { cap: Number(cap) }, "Screening limit changed");
  }

  async function end() {
    if (await confirmAction("End this test account's access now? They'll be asked to choose a plan the next time they sign in.", { title: "End access", danger: true })) act("end", {}, "Access ended");
  }

  async function resetPassword() {
    if (await confirmAction("Make a new password? The old one stops working straight away.", { title: "Reset password" })) act("reset_password", {}, "New password made");
  }

  async function remove() {
    const message = live
      ? "Delete this test account's login? Their workspace and what they added stay, under Agencies."
      : "Take this account off the list? They bought a plan, so their login and billing stay as they are.";
    if (!(await confirmAction(message, { title: live ? "Delete test account" : "Remove from list", danger: live }))) return;
    setBusy(true);
    try {
      await call("DELETE", "/api/admin/test-accounts", { id: accountId }, "Couldn't delete the account.");
      toast.success(live ? "Test account deleted" : "Removed from the list");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const a = detail?.account;
  const live = a && a.status !== "converted";
  return (
    <Drawer open onClose={onClose} title={a ? a.name : "Test account"} subtitle={a ? `${a.email} · ${a.agencyName || "No agency name"}` : ""}>
      {error && <div className="notice error">{error}</div>}
      {!a && !error && <p className="faint">Loading…</p>}
      {a && (
        <>
          <section className="drawer-section">
            <h3>Account</h3>
            <dl className="kv">
              <dt>Status</dt>
              <dd><StatusPill status={a.status} /></dd>
              <dt>Access until</dt>
              <dd>{a.endsAt ? `${formatDateTime(a.endsAt)}${a.daysLeft != null ? ` (${a.daysLeft} days left)` : ""}` : "No end date"}</dd>
              <dt>Created</dt>
              <dd>{formatDateTime(a.createdAt)}{a.createdBy ? ` by ${a.createdBy}` : ""}</dd>
              <dt>First sign-in</dt>
              <dd>{a.firstSeenAt ? formatDateTime(a.firstSeenAt) : "Not yet"}</dd>
              <dt>Last seen</dt>
              <dd>{a.lastSeenAt ? timeAgo(a.lastSeenAt) : "Never"}</dd>
              <dt>Screenings</dt>
              <dd>{a.usage.screenings}{a.screeningCap ? ` (limit ${a.screeningCap} a month)` : ""}</dd>
              <dt>Candidates</dt>
              <dd>{a.usage.candidates}</dd>
              <dt>Jobs</dt>
              <dd>{a.usage.jobs}</dd>
              <dt>Emails out</dt>
              <dd>{a.usage.emails} (limit {a.emailDailyCap} a day)</dd>
            </dl>
          </section>

          {password && <SecretReveal title="New password" secret={password} onDone={() => setPassword(null)} />}

          <section className="drawer-section">
            <h3>Actions</h3>
            <div className="actions">
              {live && <button type="button" className="btn small" disabled={busy} onClick={extend}><Icon name="calendar" size={13} /> {a.status === "active" ? "Change end date" : "Give access again"}</button>}
              <button type="button" className="btn small" disabled={busy} onClick={setCap}><Icon name="sparkle" size={13} /> Screening limit</button>
              {live && <button type="button" className="btn small" disabled={busy} onClick={resetPassword}><Icon name="key" size={13} /> Reset password</button>}
              {live && a.status === "active" && <button type="button" className="btn small danger" disabled={busy} onClick={end}><Icon name="ban" size={13} /> End access now</button>}
              <button type="button" className="btn small ghost danger" disabled={busy} onClick={remove}><Icon name="trash" size={13} /> {live ? "Delete" : "Remove from list"}</button>
            </div>
          </section>

          <section className="drawer-section">
            <h3>Activity</h3>
            {detail.timeline.length === 0 ? (
              <p className="faint">Nothing yet.</p>
            ) : (
              <div className="timeline">
                {detail.timeline.map((entry, i) => {
                  const [icon, tone] = KIND[entry.kind] || ["activity", ""];
                  return (
                    <div className="tl-row" key={`${entry.at}-${i}`}>
                      <span className={`tl-dot ${tone}`}><Icon name={icon} /></span>
                      <div className="ta-cell">
                        <div className="tl-title ta-name">{entry.text}</div>
                        <div className="tl-meta" title={formatDateTime(entry.at)}>
                          {timeAgo(entry.at)}{entry.actor ? ` · ${entry.actor}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </Drawer>
  );
}

export default function TestAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    try {
      const data = await call("GET", "/api/admin/test-accounts", null, "Failed to load test accounts.");
      setAccounts(data.accounts || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens; the loading state it sets is the point
    load();
  }, [load]);

  const rows = useMemo(() => (status === "all" ? accounts : accounts.filter((a) => a.status === status)), [accounts, status]);
  const active = accounts.filter((a) => a.status === "active").length;
  const signedIn = accounts.filter((a) => a.firstSeenAt).length;
  const converted = accounts.filter((a) => a.status === "converted").length;

  const columns = [
    {
      key: "name", sortable: true, label: "Person",
      sortValue: (a) => a.name.toLowerCase(),
      render: (a) => (
        <div className="person-cell">
          <Avatar name={a.name} />
          <div className="ta-cell">
            <div className="truncate ta-name">{a.name}</div>
            <div className="faint truncate ta-sub">{a.email}{a.agencyName ? ` · ${a.agencyName}` : ""}</div>
          </div>
        </div>
      ),
    },
    { key: "status", sortable: true, label: "Status", sortValue: (a) => a.status, render: (a) => <StatusPill status={a.status} /> },
    { key: "daysLeft", sortable: true, label: "Days left", align: "right", sortValue: (a) => a.daysLeft, render: (a) => (a.status !== "active" ? "–" : a.daysLeft ?? "No end") },
    { key: "lastSeenAt", sortable: true, label: "Last seen", sortValue: (a) => (a.lastSeenAt ? Date.parse(a.lastSeenAt) : null), render: (a) => (a.lastSeenAt ? timeAgo(a.lastSeenAt) : <span className="faint">Never</span>) },
    { key: "screenings", sortable: true, label: "Screenings", align: "right", sortValue: (a) => a.usage.screenings, render: (a) => a.usage.screenings },
    { key: "candidates", sortable: true, label: "Candidates", align: "right", sortValue: (a) => a.usage.candidates, render: (a) => a.usage.candidates },
    { key: "jobs", sortable: true, label: "Jobs", align: "right", sortValue: (a) => a.usage.jobs, render: (a) => a.usage.jobs },
    { key: "emails", sortable: true, label: "Emails", align: "right", sortValue: (a) => a.usage.emails, render: (a) => a.usage.emails },
  ];

  return (
    <>
      <PageHeader title="Test accounts" description="Free Helixon logins for prospects, and everything they do with them.">
        <button type="button" className="btn small primary" onClick={() => setCreating(true)}>
          <Icon name="userPlus" size={13} /> New test account
        </button>
      </PageHeader>

      <div className="kpi-grid">
        <KpiCard label="Active" icon="users" value={active} foot={`${accounts.length} in total`} />
        <KpiCard label="Have signed in" icon="activity" value={signedIn} />
        <KpiCard label="Bought a plan" icon="card" value={converted} tone={converted ? "var(--ok)" : undefined} />
      </div>

      {error && <div className="notice error section">{error}</div>}

      <section className="section">
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Status">
            {[["all", "All"], ["active", "Active"], ["expired", "Expired"], ["ended", "Ended"], ["converted", "Bought a plan"]].map(([key, label]) => (
              <button type="button" key={key} className={status === key ? "active" : ""} aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</button>
            ))}
          </div>
          <span className="faint ta-count">{rows.length} of {accounts.length}</span>
        </div>

        {!loading && accounts.length === 0 ? (
          <EmptyState icon="userPlus" title="No test accounts yet">
            Make one to give a prospect a login without payment.
          </EmptyState>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            onRowClick={(a) => setSelectedId(a.id)}
            empty={{ icon: "search", title: "None match", body: "Try another status." }}
            defaultSort={{ key: "lastSeenAt", dir: "desc" }}
            pageSize={25}
          />
        )}
      </section>

      {selectedId && <AccountDrawer accountId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      <CreateDrawer open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </>
  );
}
