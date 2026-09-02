"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const roles = [
  "super_admin",
  "admin",
  "sales",
  "support",
  "operations",
  "viewer",
  "employee",
];

const NAV_TABS = [
  ["overview", "Dashboard"],
  ["users", "Users"],
  ["employees", "Employees"],
  ["traffic", "Traffic"],
  ["subscriptions", "Subscriptions"],
];

// ── Shared tokens (mirrors lib/account.js's COLORS — kept local so this
// page has no cross-feature import into components/account) ───────────────
const INK = "#13201b";
const INK_SOFT = "#5a7a6a";
const INK_FAINT = "#8aaa9a";
const DANGER = "#dc2626";
const DANGER_BG = "#fef2f2";
const DANGER_BORDER = "#fecaca";

const CARD = {
  background: "white",
  border: "1px solid var(--border)",
  borderRadius: 14,
  boxShadow: "var(--shadow-card)",
};

// ── Small presentational primitives (styling only, no logic) ──────────────
function Th({ children }) {
  return (
    <th
      className="text-left text-[11px] font-semibold uppercase tracking-wide px-3 py-2.5 whitespace-nowrap"
      style={{ color: INK_FAINT, borderBottom: "1px solid var(--border)" }}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={`px-3 py-3.5 align-top text-sm ${className}`}
      style={{ borderBottom: "1px solid var(--border-soft)", color: INK }}
    >
      {children}
    </td>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="block text-xs font-semibold mb-1.5" style={{ color: INK }}>
      {children}
    </label>
  );
}

function Input({ className = "", style, ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--mint)] focus:border-[var(--forest)] mb-3.5 ${className}`}
      style={{ borderColor: "var(--border)", color: INK, background: "white", ...style }}
    />
  );
}

function Select({ children, className = "", style, ...props }) {
  return (
    <select
      {...props}
      className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm outline-none bg-white ${className}`}
      style={{ borderColor: "var(--border)", color: INK, ...style }}
    >
      {children}
    </select>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-colors bg-[var(--forest)] text-white hover:bg-[var(--forest-deep)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)] focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, danger = false, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-[9px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        danger ? "hover:bg-red-50 focus-visible:ring-[#dc2626]" : "hover:bg-[var(--mint)] focus-visible:ring-[var(--forest)]"
      } ${className}`}
      style={{ borderColor: danger ? DANGER_BORDER : "var(--border)", color: danger ? DANGER : INK }}
    >
      {children}
    </button>
  );
}

function Pill({ tone = "default", children }) {
  const styles = {
    active: { background: "var(--mint)", color: "var(--forest)" },
    danger: { background: DANGER_BG, color: DANGER },
    pending: { background: "var(--signal-soft)", color: "var(--gold)" },
    default: { background: "var(--mist)", color: INK_FAINT, border: "1px solid var(--border)" },
  };
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={styles[tone] || styles.default}
    >
      {children}
    </span>
  );
}

function SectionHeading({ title, description }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
        {title}
      </h1>
      {description && (
        <p className="text-sm mt-1" style={{ color: INK_FAINT }}>
          {description}
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState("overview");

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    agencyId: "",
    isTestUser: true,
    testLabel: "",
    autoConfirm: true,
  });

  const [employeeForm, setEmployeeForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "employee",
  });

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [statsRes, usersRes, employeesRes] = await Promise.all([
        fetch("/api/admin/stats?range=7d", { cache: "no-store" }),
        fetch("/api/admin/users?perPage=1000", { cache: "no-store" }),
        fetch("/api/admin/employees", { cache: "no-store" }),
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const employeesData = await employeesRes.json();

      if (!statsRes.ok) {
        throw new Error(statsData.error || "Failed to load stats.");
      }

      if (!usersRes.ok) {
        throw new Error(usersData.error || "Failed to load users.");
      }

      if (!employeesRes.ok) {
        throw new Error(employeesData.error || "Failed to load employees.");
      }

      setStats(statsData);
      setUsers(usersData.users || []);
      setEmployees(employeesData.employees || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function createTestUser(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not create user.");
      }

      setMessage(`Created ${data.user.email}${data.user.isTestUser ? " as a test user." : "."}`);

      setUserForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        agencyId: "",
        isTestUser: true,
        testLabel: "",
        autoConfirm: true,
      });

      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEmployee(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not create employee.");
      }

      setMessage(`Employee ${data.employee.username} created.`);

      setEmployeeForm({
        username: "",
        password: "",
        fullName: "",
        role: "employee",
      });

      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function userAction(userId, action) {
    setMessage("");
    setError("");

    let password = "";

    if (action === "reset_password") {
      password = window.prompt("Enter the new password:");
      if (!password) return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Action failed.");
      }

      setMessage(`User action "${action}" completed.`);

      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(user) {
    const confirmed = window.confirm(
      `Permanently delete ${user.email}? This removes the Supabase Auth account.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Delete failed.");
      }

      setMessage(`Deleted ${user.email}.`);

      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function employeeAction(employeeId, action, extra = {}) {
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, action, ...extra }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Action failed.");
      }

      setMessage(`Employee action "${action}" completed.`);

      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      return [user.email, user.username, user.firstName, user.lastName, user.id, user.testLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [users, search]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
        <p className="text-sm" style={{ color: INK_SOFT, fontFamily: "var(--font-display)" }}>
          Loading admin console…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      {/* ── Nav — same shell as the landing page / DashboardNav ────────── */}
      <nav
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b"
        style={{ borderColor: "var(--border)" }}
        aria-label="Admin"
      >
        <div className="max-w-[1200px] mx-auto px-6 h-[56px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden"
              style={{ background: "var(--forest)" }}
            >
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span
                className="text-sm font-semibold tracking-tight"
                style={{ color: INK, fontFamily: "var(--font-display)" }}
              >
                Helixon
              </span>
              <span
                className="text-[9px] font-semibold uppercase tracking-widest mt-0.5"
                style={{ color: "var(--forest)" }}
              >
                Platform admin
              </span>
            </span>
          </div>

          <div
            className="hidden md:flex items-center gap-1 text-xs font-medium overflow-x-auto"
            style={{ color: INK_SOFT }}
          >
            {NAV_TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className="px-3 py-1.5 rounded-[8px] transition-colors whitespace-nowrap"
                style={tab === value ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : {}}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <OutlineButton type="button" onClick={loadAll}>
              Refresh
            </OutlineButton>
            <Link
              href="/dashboard"
              className="text-xs font-medium px-2 py-2 rounded-[8px] transition-colors hover:bg-[var(--mist)]"
              style={{ color: INK_SOFT }}
            >
              ← Back to app
            </Link>
          </div>
        </div>

        {/* Mobile tab row */}
        <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2 text-xs font-medium" style={{ color: INK_SOFT }}>
          {NAV_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className="px-3 py-1.5 rounded-[8px] whitespace-nowrap"
              style={tab === value ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : {}}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto px-6 py-8 lg:py-10">
        {message && (
          <div
            className="mb-5 px-4 py-3 rounded-[10px] text-sm"
            style={{ background: "var(--mint)", border: "1px solid var(--border)", color: "var(--forest-deep)" }}
            role="status"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="mb-5 px-4 py-3 rounded-[10px] text-sm"
            style={{ background: DANGER_BG, border: `1px solid ${DANGER_BORDER}`, color: DANGER }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* ── Dashboard ────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            <SectionHeading title="Dashboard" description="Platform-wide totals for the last 7 days." />

            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
              {Object.entries(stats?.totals || {}).map(([name, value]) => (
                <div key={name} className="p-5" style={CARD}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
                    {name.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                  <div
                    className="text-[26px] font-semibold mt-1.5 tabular-nums"
                    style={{ fontFamily: "var(--font-mono)", color: INK }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Users ────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <>
            <SectionHeading title="Users" description="Supabase Auth accounts, profiles, and subscriptions." />

            <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(300px,380px) 1fr", alignItems: "start" }}>
              <form onSubmit={createTestUser} className="p-6" style={CARD}>
                <h2 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-display)", color: INK }}>
                  Create test user
                </h2>

                <FieldLabel>Email</FieldLabel>
                <Input
                  value={userForm.email}
                  onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                  placeholder="test@helixon.co.uk"
                />

                <FieldLabel>Password</FieldLabel>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                />

                <FieldLabel>First name</FieldLabel>
                <Input
                  value={userForm.firstName}
                  onChange={(event) => setUserForm({ ...userForm, firstName: event.target.value })}
                />

                <FieldLabel>Last name</FieldLabel>
                <Input
                  value={userForm.lastName}
                  onChange={(event) => setUserForm({ ...userForm, lastName: event.target.value })}
                />

                <FieldLabel>Test label</FieldLabel>
                <Input
                  value={userForm.testLabel}
                  onChange={(event) => setUserForm({ ...userForm, testLabel: event.target.value })}
                  placeholder="QA - pricing flow"
                />

                <label className="flex items-center gap-2 text-sm mb-4" style={{ color: INK }}>
                  <input
                    type="checkbox"
                    checked={userForm.autoConfirm}
                    onChange={(event) => setUserForm({ ...userForm, autoConfirm: event.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--forest)]"
                  />
                  Auto-confirm email
                </label>

                <PrimaryButton type="submit" className="w-full">
                  Create test user
                </PrimaryButton>
              </form>

              <div className="p-6" style={CARD}>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search email, name, ID…"
                  className="mb-4"
                />

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <Th>User</Th>
                        <Th>Status</Th>
                        <Th>Subscription</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <Td>
                            <strong style={{ color: INK }}>
                              {user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.email}
                            </strong>
                            <div className="text-xs mt-0.5" style={{ color: INK_FAINT }}>
                              {user.email}
                            </div>
                            {user.isTestUser && (
                              <div className="mt-1">
                                <Pill>
                                  TEST{user.testLabel ? ` · ${user.testLabel}` : ""}
                                </Pill>
                              </div>
                            )}
                          </Td>

                          <Td>
                            {user.bannedUntil ? (
                              <Pill tone="danger">Banned</Pill>
                            ) : user.emailConfirmedAt ? (
                              <Pill tone="active">Active</Pill>
                            ) : (
                              <Pill tone="pending">Unverified</Pill>
                            )}
                          </Td>

                          <Td>
                            <span style={{ color: user.subscription ? INK : INK_FAINT }}>
                              {user.subscription
                                ? `${user.subscription.plan || "Unknown"} · ${user.subscription.status || "unknown"}`
                                : "None"}
                            </span>
                          </Td>

                          <Td>
                            <div className="flex flex-wrap gap-1.5">
                              {!user.emailConfirmedAt && (
                                <OutlineButton type="button" onClick={() => userAction(user.id, "confirm_email")}>
                                  Confirm
                                </OutlineButton>
                              )}

                              {user.bannedUntil ? (
                                <OutlineButton type="button" onClick={() => userAction(user.id, "unban")}>
                                  Unban
                                </OutlineButton>
                              ) : (
                                <OutlineButton type="button" onClick={() => userAction(user.id, "ban")}>
                                  Ban
                                </OutlineButton>
                              )}

                              <OutlineButton type="button" onClick={() => userAction(user.id, "reset_password")}>
                                Reset
                              </OutlineButton>

                              <OutlineButton type="button" danger onClick={() => deleteUser(user)}>
                                Delete
                              </OutlineButton>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Employees ────────────────────────────────────────────────── */}
        {tab === "employees" && (
          <>
            <SectionHeading title="Employees" description="Internal staff accounts for the employee portal." />

            <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(300px,380px) 1fr", alignItems: "start" }}>
              <form onSubmit={createEmployee} className="p-6" style={CARD}>
                <h2 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-display)", color: INK }}>
                  Create employee
                </h2>

                <FieldLabel>Username</FieldLabel>
                <Input
                  value={employeeForm.username}
                  onChange={(event) => setEmployeeForm({ ...employeeForm, username: event.target.value })}
                />

                <FieldLabel>Full name</FieldLabel>
                <Input
                  value={employeeForm.fullName}
                  onChange={(event) => setEmployeeForm({ ...employeeForm, fullName: event.target.value })}
                />

                <FieldLabel>Password</FieldLabel>
                <Input
                  type="password"
                  value={employeeForm.password}
                  onChange={(event) => setEmployeeForm({ ...employeeForm, password: event.target.value })}
                />

                <FieldLabel>Role</FieldLabel>
                <Select
                  value={employeeForm.role}
                  onChange={(event) => setEmployeeForm({ ...employeeForm, role: event.target.value })}
                  className="mb-4"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>

                <PrimaryButton type="submit" className="w-full">
                  Create employee
                </PrimaryButton>
              </form>

              <div className="p-6" style={CARD}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <Th>Employee</Th>
                        <Th>Role</Th>
                        <Th>Status</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>

                    <tbody>
                      {employees.map((employee) => (
                        <tr key={employee.id}>
                          <Td>
                            <strong style={{ color: INK }}>{employee.full_name || employee.display_name}</strong>
                            <div className="text-xs mt-0.5" style={{ color: INK_FAINT }}>
                              {employee.username}
                            </div>
                          </Td>

                          <Td>
                            <Select
                              value={employee.role}
                              onChange={(event) =>
                                employeeAction(employee.id, "set_role", { role: event.target.value })
                              }
                              className="text-xs py-2 max-w-[160px]"
                            >
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </Select>
                          </Td>

                          <Td>
                            {employee.is_active ? <Pill tone="active">Active</Pill> : <Pill>Disabled</Pill>}
                          </Td>

                          <Td>
                            <div className="flex flex-wrap gap-1.5">
                              <OutlineButton
                                type="button"
                                onClick={() =>
                                  employeeAction(employee.id, employee.is_active ? "deactivate" : "activate")
                                }
                              >
                                {employee.is_active ? "Disable" : "Enable"}
                              </OutlineButton>

                              <OutlineButton
                                type="button"
                                onClick={() => {
                                  const password = window.prompt("New employee password:");
                                  if (password) {
                                    employeeAction(employee.id, "reset_password", { password });
                                  }
                                }}
                              >
                                Reset password
                              </OutlineButton>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Traffic ──────────────────────────────────────────────────── */}
        {tab === "traffic" && (
          <>
            <SectionHeading title="Website traffic" description="Requests over the last 7 days." />

            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
              {[
                ["Top pages / routes", stats?.traffic?.topPaths],
                ["Countries", stats?.traffic?.countries],
                ["Referrers", stats?.traffic?.referrers],
              ].map(([title, items]) => (
                <div key={title} className="p-5" style={CARD}>
                  <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: INK }}>
                    {title}
                  </h3>
                  {(items || []).map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between py-2 text-sm"
                      style={{ borderBottom: "1px solid var(--border-soft)", color: INK }}
                    >
                      <span className="truncate pr-3" style={{ color: INK_SOFT }}>
                        {item.name}
                      </span>
                      <strong className="tabular-nums shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
                        {item.count}
                      </strong>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Subscriptions ────────────────────────────────────────────── */}
        {tab === "subscriptions" && (
          <>
            <SectionHeading title="Subscriptions" description="Active plans by status and tier." />

            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
              {[
                ["By status", stats?.subscriptions?.byStatus],
                ["By plan", stats?.subscriptions?.byPlan],
              ].map(([title, entries]) => (
                <div key={title} className="p-5" style={CARD}>
                  <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: "var(--font-display)", color: INK }}>
                    {title}
                  </h3>
                  {Object.entries(entries || {}).map(([label, count]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-2 text-sm"
                      style={{ borderBottom: "1px solid var(--border-soft)", color: INK }}
                    >
                      <span style={{ color: INK_SOFT }}>{label}</span>
                      <strong className="tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                        {count}
                      </strong>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}