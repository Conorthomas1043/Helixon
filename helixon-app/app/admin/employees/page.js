"use client";

import { useMemo, useState } from "react";

import { PageHeader, KpiCard, RangeControl, Avatar, Drawer, EmptyState } from "../_shared/ui";
import { Icon } from "../_shared/icons";
import { DataTable } from "../_shared/datatable";
import { timeAgo } from "../_shared/data";
import { useAdminEmployees } from "../_shared/hooks";
import { toast } from "../_shared/toast";
import { ROLES, rolePreset } from "@/lib/employee-permissions";
import SalesMarketingPanel from "./sales-marketing-panel";
import EmployeeDrawer from "./EmployeeDrawer";
import { PermissionMatrix, RolePicker, SecretReveal, accessSummary, roleLabel } from "./access";

const EMPTY_FORM = { username: "", fullName: "", email: "", role: "employee", generatePassword: true, password: "", permissions: null };

function CreateEmployee({ open, onClose, create, busy }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [customise, setCustomise] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const permissions = form.permissions || rolePreset(form.role);

  function close() {
    setForm(EMPTY_FORM);
    setCustomise(false);
    setCreated(null);
    onClose();
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      email: form.email.trim() || undefined,
      role: form.role,
      generatePassword: form.generatePassword,
      password: form.generatePassword ? undefined : form.password,
      permissions: customise ? permissions : undefined,
    };
    const result = await create(payload);
    if (!result) return;
    toast.success(`Created @${result.employee.username}`);
    if (result.temporaryPassword) setCreated({ username: result.employee.username, password: result.temporaryPassword });
    else close();
  }

  return (
    <Drawer open={open} onClose={close} title="Add employee" subtitle="They sign in at /employee/login with the username and password you set here.">
      {created ? (
        <>
          <SecretReveal title={`Password for @${created.username}`} secret={created.password} />
          <div className="actions">
            <button type="button" className="btn primary" onClick={close}>Done</button>
            <button type="button" className="btn ghost" onClick={() => { setCreated(null); setForm(EMPTY_FORM); setCustomise(false); }}>Add another</button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="stack" style={{ gap: 18 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="new-name">Full name</label>
              <input id="new-name" value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} required maxLength={160} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="new-username">Username</label>
              <input
                id="new-username"
                value={form.username}
                onChange={(e) => set({ username: e.target.value })}
                pattern="[A-Za-z0-9._\-]{3,64}"
                title="3-64 letters, numbers, dots, underscores or hyphens"
                required
                autoComplete="off"
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="new-email">Email (optional)</label>
              <input id="new-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
          </div>

          <RolePicker id="new-role" value={form.role} onChange={(role) => set({ role, permissions: null })} />

          <div className="field">
            <span className="field-label">Password</span>
            <div className="segmented" role="radiogroup" aria-label="Password">
              <button type="button" role="radio" aria-checked={form.generatePassword} className={form.generatePassword ? "active" : ""} onClick={() => set({ generatePassword: true })}>
                Generate a strong one
              </button>
              <button type="button" role="radio" aria-checked={!form.generatePassword} className={!form.generatePassword ? "active" : ""} onClick={() => set({ generatePassword: false })}>
                Set it myself
              </button>
            </div>
            {!form.generatePassword && (
              <input
                type="password"
                aria-label="Password"
                value={form.password}
                onChange={(e) => set({ password: e.target.value })}
                minLength={12}
                required
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
            )}
          </div>

          <div className="drawer-section">
            <div className="section-head" style={{ marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>Portal permissions</h3>
              <button type="button" className="btn small ghost" onClick={() => setCustomise((v) => !v)} aria-expanded={customise}>
                {customise ? "Use role defaults" : "Customise"}
              </button>
            </div>
            {customise ? (
              <PermissionMatrix role={form.role} value={permissions} onChange={(next) => set({ permissions: next })} />
            ) : (
              <p className="perm-desc" style={{ margin: 0 }}>{ROLES.find((r) => r.key === form.role)?.description} You can fine-tune any section later.</p>
            )}
          </div>

          <div className="actions">
            <button className="btn primary" disabled={busy}>Create account</button>
            <button type="button" className="btn ghost" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

function AccessCell({ employee }) {
  const { changed, hidden } = accessSummary(employee.role, employee.effective_permissions);
  if (!changed) return <span className="faint">Role defaults</span>;
  return (
    <span className="pill info bare" title="Sections set differently from the role's defaults">
      {changed} custom{hidden ? ` · ${hidden} hidden` : ""}
    </span>
  );
}

export default function EmployeesPage() {
  const { employees, error, busy, loading, patch, create, openPortal } = useAdminEmployees();
  const [view, setView] = useState("staff");
  const [range, setRange] = useState("30d");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);

  const active = employees.filter((e) => e.is_active).length;
  const signedIn = employees.filter((e) => e.active_sessions > 0).length;
  const customised = employees.filter((e) => accessSummary(e.role, e.effective_permissions).changed > 0).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (roleFilter && e.role !== roleFilter) return false;
      if (status === "active" && !e.is_active) return false;
      if (status === "disabled" && e.is_active) return false;
      if (status === "online" && !e.active_sessions) return false;
      if (!q) return true;
      return [e.username, e.full_name, e.display_name, e.email].some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [employees, search, roleFilter, status]);

  const selected = employees.find((e) => e.id === selectedId) || null;

  const columns = [
    {
      key: "name",
      label: "Person",
      sortValue: (e) => (e.full_name || e.display_name || e.username || "").toLowerCase(),
      render: (e) => (
        <div className="person-cell">
          <Avatar name={e.full_name || e.display_name || e.username} />
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 500 }}>
              {e.full_name || e.display_name || e.username}
              {e.admin_username && <span className="pill warn bare" style={{ marginLeft: 6 }}>Admin</span>}
            </div>
            <div className="faint truncate" style={{ fontSize: 12 }}>@{e.username}{e.email ? ` · ${e.email}` : ""}</div>
          </div>
        </div>
      ),
    },
    { key: "role", label: "Role", sortValue: (e) => roleLabel(e.role), render: (e) => roleLabel(e.role) },
    { key: "access", label: "Access", sortValue: (e) => accessSummary(e.role, e.effective_permissions).changed, render: (e) => <AccessCell employee={e} /> },
    {
      key: "status",
      label: "Status",
      sortValue: (e) => (e.is_active ? (e.active_sessions ? 0 : 1) : 2),
      render: (e) =>
        !e.is_active ? (
          <span className="pill bad">Deactivated</span>
        ) : e.active_sessions ? (
          <span className="pill good">Signed in</span>
        ) : (
          <span className="pill bare">Active</span>
        ),
    },
    {
      key: "last_login",
      label: "Last sign-in",
      sortValue: (e) => (e.last_login ? new Date(e.last_login).getTime() : null),
      render: (e) => <span title={e.last_login ? new Date(e.last_login).toLocaleString() : ""}>{timeAgo(e.last_login)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        description={view === "staff" ? "Staff accounts, what each person can do in the portal, and where they're signed in." : "SEO, marketing, and sales-facing numbers - kept simple for the sales team."}
      >
        <div className="segmented" role="group" aria-label="View">
          <button className={view === "staff" ? "active" : ""} aria-pressed={view === "staff"} onClick={() => setView("staff")}>Staff</button>
          <button className={view === "sales" ? "active" : ""} aria-pressed={view === "sales"} onClick={() => setView("sales")}>Sales &amp; marketing</button>
        </div>
        {view === "sales" ? (
          <RangeControl range={range} setRange={setRange} options={["7d", "30d", "90d"]} />
        ) : (
          <>
            <button className="btn small" onClick={() => openPortal()} disabled={busy} title="Sign in to the staff portal with your own admin-linked account">
              <Icon name="external" size={13} /> Open employee portal
            </button>
            <button className="btn small primary" onClick={() => setCreating(true)}>
              <Icon name="userPlus" size={13} /> Add employee
            </button>
          </>
        )}
      </PageHeader>

      {view === "sales" ? (
        <SalesMarketingPanel range={range} />
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard label="Staff" icon="users" value={employees.length} foot={`${active} active`} />
            <KpiCard label="Signed in now" icon="activity" value={signedIn} tone="var(--ok)" />
            <KpiCard label="Custom permissions" icon="lock" value={customised} foot="Differ from their role" />
            <KpiCard label="Deactivated" icon="ban" value={employees.length - active} tone={employees.length - active ? "var(--critical)" : undefined} />
          </div>

          {error && <div className="notice error section">{error}</div>}

          <section className="section">
            <div className="toolbar">
              <input className="search-input no-icon" placeholder="Search name, username or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search employees" />
              <select className="select-input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
                <option value="">All roles</option>
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              <div className="segmented" role="group" aria-label="Status">
                {[
                  ["all", "All"],
                  ["active", "Active"],
                  ["online", "Signed in"],
                  ["disabled", "Deactivated"],
                ].map(([key, label]) => (
                  <button key={key} className={status === key ? "active" : ""} aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</button>
                ))}
              </div>
              <span className="faint" style={{ marginLeft: "auto", fontSize: 12.5 }}>{rows.length} of {employees.length}</span>
            </div>

            {!loading && employees.length === 0 ? (
              <EmptyState icon="briefcase" title="No staff accounts yet">
                Add your first employee to give them access to the staff portal.
              </EmptyState>
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                loading={loading}
                onRowClick={(e) => setSelectedId(e.id)}
                empty={{ icon: "search", title: "No one matches", body: "Try a different search or filter." }}
                defaultSort={{ key: "name", dir: "asc" }}
                pageSize={25}
              />
            )}
          </section>
        </>
      )}

      {selected && (
        <EmployeeDrawer employee={selected} onClose={() => setSelectedId(null)} patch={patch} openPortal={openPortal} busy={busy} />
      )}
      <CreateEmployee open={creating} onClose={() => setCreating(false)} create={create} busy={busy} />
    </>
  );
}
