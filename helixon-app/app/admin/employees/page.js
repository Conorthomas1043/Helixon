"use client";

import { useState } from "react";

import { PageHeader, KpiCard, RangeControl } from "../_shared/ui";
import { useAdminEmployees } from "../_shared/hooks";
import SalesMarketingPanel from "./sales-marketing-panel";

const roles = [
  "super_admin",
  "admin",
  "sales",
  "support",
  "operations",
  "viewer",
  "employee",
];

export default function EmployeesPage() {
  const { employees, form, setForm, error, busy, action, create } =
    useAdminEmployees();
  const [view, setView] = useState("staff");
  const [range, setRange] = useState("30d");

  const active = employees.filter((employee) => employee.is_active).length;

  return (
    <>
      <PageHeader
        title="Employees"
        description={
          view === "staff"
            ? "Staff accounts and access levels."
            : "SEO, marketing, and sales-facing numbers — kept simple for the sales team."
        }
      >
        <div className="segmented">
          <button
            className={view === "staff" ? "active" : ""}
            onClick={() => setView("staff")}
          >
            Staff
          </button>
          <button
            className={view === "sales" ? "active" : ""}
            onClick={() => setView("sales")}
          >
            Sales &amp; marketing
          </button>
        </div>

        {view === "sales" ? (
          <RangeControl
            range={range}
            setRange={setRange}
            options={["7d", "30d", "90d"]}
          />
        ) : (
          <div className="muted">{employees.length} total</div>
        )}
      </PageHeader>

      {view === "sales" ? (
        <SalesMarketingPanel range={range} />
      ) : (
        <>
          <div className="kpi-grid cols-3">
            <KpiCard label="Total staff" value={employees.length} />
            <KpiCard label="Active" value={active} tone="var(--ok)" />
            <KpiCard
              label="Disabled"
              value={employees.length - active}
              tone="var(--critical)"
            />
          </div>

          {error && <div className="notice error section">{error}</div>}

          <section className="panel">
            <div className="panel-title">Create employee</div>

            <form onSubmit={create} className="section form-grid">
              <div className="field">
                <label>Username</label>
                <input
                  value={form.username}
                  onChange={(event) =>
                    setForm({ ...form, username: event.target.value })
                  }
                  required
                />
              </div>

              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  minLength={8}
                  required
                />
              </div>

              <div className="field">
                <label>Full name</label>
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    setForm({ ...form, fullName: event.target.value })
                  }
                  required
                />
              </div>

              <div className="field">
                <label>Role</label>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value })
                  }
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="actions">
                <button className="btn primary" disabled={busy}>
                  Create
                </button>
              </div>
            </form>
          </section>

          <section className="section">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>State</th>
                    <th>Last login</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty">
                        No employees yet.
                      </td>
                    </tr>
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id}>
                        <td>
                          {employee.username}
                          <div className="muted">
                            {employee.full_name || employee.display_name}
                          </div>
                        </td>

                        <td>{employee.role}</td>

                        <td>
                          {employee.is_active ? (
                            <span className="pill good">Active</span>
                          ) : (
                            <span className="pill bad">Disabled</span>
                          )}
                        </td>

                        <td>
                          {employee.last_login
                            ? new Date(employee.last_login).toLocaleString()
                            : "Never"}
                        </td>

                        <td>
                          <div className="actions">
                            <button
                              className="btn small"
                              onClick={() =>
                                action(
                                  employee.id,
                                  employee.is_active
                                    ? "deactivate"
                                    : "activate",
                                )
                              }
                              disabled={busy}
                            >
                              {employee.is_active ? "Deactivate" : "Activate"}
                            </button>

                            <select
                              className="btn small"
                              value={employee.role}
                              onChange={(event) =>
                                action(employee.id, "set_role", {
                                  role: event.target.value,
                                })
                              }
                              disabled={busy}
                            >
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
