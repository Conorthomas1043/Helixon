"use client";

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
      const [statsRes, usersRes, employeesRes] =
        await Promise.all([
          fetch(
            "/api/admin/stats?range=7d",
            {
              cache: "no-store",
            }
          ),

          fetch(
            "/api/admin/users?perPage=1000",
            {
              cache: "no-store",
            }
          ),

          fetch("/api/admin/employees", {
            cache: "no-store",
          }),
        ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const employeesData =
        await employeesRes.json();

      if (!statsRes.ok) {
        throw new Error(
          statsData.error || "Failed to load stats."
        );
      }

      if (!usersRes.ok) {
        throw new Error(
          usersData.error || "Failed to load users."
        );
      }

      if (!employeesRes.ok) {
        throw new Error(
          employeesData.error ||
            "Failed to load employees."
        );
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
      const res = await fetch(
        "/api/admin/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userForm),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Could not create user."
        );
      }

      setMessage(
        `Created ${data.user.email}${
          data.user.isTestUser
            ? " as a test user."
            : "."
        }`
      );

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
      const res = await fetch(
        "/api/admin/employees",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(employeeForm),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Could not create employee."
        );
      }

      setMessage(
        `Employee ${data.employee.username} created.`
      );

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
      password = window.prompt(
        "Enter the new password:"
      );

      if (!password) return;
    }

    try {
      const res = await fetch(
        "/api/admin/users",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            action,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Action failed."
        );
      }

      setMessage(
        `User action "${action}" completed.`
      );

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
      const res = await fetch(
        "/api/admin/users",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Delete failed."
        );
      }

      setMessage(
        `Deleted ${user.email}.`
      );

      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function employeeAction(
    employeeId,
    action,
    extra = {}
  ) {
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        "/api/admin/employees",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeId,
            action,
            ...extra,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Action failed."
        );
      }

      setMessage(
        `Employee action "${action}" completed.`
      );

      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) return users;

    return users.filter((user) => {
      return [
        user.email,
        user.username,
        user.firstName,
        user.lastName,
        user.id,
        user.testLabel,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
  }, [users, search]);

  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#fff",
    padding: 20,
  };

  const button = {
    border: "1px solid #d1d5db",
    borderRadius: 9,
    padding: "9px 13px",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  };

  const input = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 9,
    padding: 10,
    marginTop: 5,
    marginBottom: 12,
    boxSizing: "border-box",
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
        }}
      >
        Loading admin console...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#111827",
      }}
    >
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "18px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            Helixon Admin
          </div>

          <div
            style={{
              color: "#6b7280",
              marginTop: 3,
            }}
          >
            Platform control centre
          </div>
        </div>

        <button
          style={button}
          onClick={loadAll}
        >
          Refresh
        </button>
      </header>

      <div
        style={{
          display: "flex",
          minHeight: "calc(100vh - 78px)",
        }}
      >
        <aside
          style={{
            width: 220,
            background: "#111827",
            color: "#fff",
            padding: 18,
          }}
        >
          {[
            ["overview", "Dashboard"],
            ["users", "Users"],
            ["employees", "Employees"],
            ["traffic", "Traffic"],
            ["subscriptions", "Subscriptions"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: 0,
                borderRadius: 8,
                background:
                  tab === value
                    ? "#374151"
                    : "transparent",
                color: "#fff",
                padding: "11px 12px",
                marginBottom: 5,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}

          <a
            href="/dashboard"
            style={{
              display: "block",
              marginTop: 20,
              color: "#d1d5db",
              textDecoration: "none",
              padding: "11px 12px",
            }}
          >
            Back to app
          </a>
        </aside>

        <section
          style={{
            flex: 1,
            padding: 28,
            overflow: "auto",
          }}
        >
          {message && (
            <div
              style={{
                ...card,
                marginBottom: 16,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                ...card,
                marginBottom: 16,
                borderColor: "#fecaca",
              }}
            >
              {error}
            </div>
          )}

          {tab === "overview" && (
            <>
              <h1>Dashboard</h1>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 14,
                }}
              >
                {Object.entries(
                  stats?.totals || {}
                ).map(([name, value]) => (
                  <div key={name} style={card}>
                    <div
                      style={{
                        color: "#6b7280",
                        textTransform: "capitalize",
                        fontSize: 13,
                      }}
                    >
                      {name
                        .replace(
                          /([A-Z])/g,
                          " $1"
                        )
                        .trim()}
                    </div>

                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        marginTop: 7,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "users" && (
            <>
              <h1>Users</h1>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(320px,420px) 1fr",
                  gap: 18,
                  alignItems: "start",
                }}
              >
                <form
                  onSubmit={createTestUser}
                  style={card}
                >
                  <h2>Create test user</h2>

                  <label>Email</label>
                  <input
                    style={input}
                    value={userForm.email}
                    onChange={(event) =>
                      setUserForm({
                        ...userForm,
                        email:
                          event.target.value,
                      })
                    }
                    placeholder="test@helixon.co.uk"
                  />

                  <label>Password</label>
                  <input
                    type="password"
                    style={input}
                    value={userForm.password}
                    onChange={(event) =>
                      setUserForm({
                        ...userForm,
                        password:
                          event.target.value,
                      })
                    }
                  />

                  <label>First name</label>
                  <input
                    style={input}
                    value={userForm.firstName}
                    onChange={(event) =>
                      setUserForm({
                        ...userForm,
                        firstName:
                          event.target.value,
                      })
                    }
                  />

                  <label>Last name</label>
                  <input
                    style={input}
                    value={userForm.lastName}
                    onChange={(event) =>
                      setUserForm({
                        ...userForm,
                        lastName:
                          event.target.value,
                      })
                    }
                  />

                  <label>Test label</label>
                  <input
                    style={input}
                    value={userForm.testLabel}
                    onChange={(event) =>
                      setUserForm({
                        ...userForm,
                        testLabel:
                          event.target.value,
                      })
                    }
                    placeholder="QA - pricing flow"
                  />

                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        userForm.autoConfirm
                      }
                      onChange={(event) =>
                        setUserForm({
                          ...userForm,
                          autoConfirm:
                            event.target.checked,
                        })
                      }
                    />
                    Auto-confirm email
                  </label>

                  <button
                    type="submit"
                    style={button}
                  >
                    Create test user
                  </button>
                </form>

                <div style={card}>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginBottom: 15,
                    }}
                  >
                    <input
                      style={{
                        ...input,
                        margin: 0,
                      }}
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search email, name, ID..."
                    />
                  </div>

                  <div
                    style={{
                      overflowX: "auto",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse:
                          "collapse",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={th}>
                            User
                          </th>
                          <th style={th}>
                            Status
                          </th>
                          <th style={th}>
                            Subscription
                          </th>
                          <th style={th}>
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredUsers.map(
                          (user) => (
                            <tr key={user.id}>
                              <td style={td}>
                                <strong>
                                  {user.firstName ||
                                    user.lastName
                                    ? `${user.firstName} ${user.lastName}`.trim()
                                    : user.email}
                                </strong>

                                <div
                                  style={{
                                    fontSize: 12,
                                    color:
                                      "#6b7280",
                                  }}
                                >
                                  {user.email}
                                </div>

                                {user.isTestUser && (
                                  <div
                                    style={{
                                      marginTop: 4,
                                      fontSize: 12,
                                    }}
                                  >
                                    TEST
                                    {user.testLabel
                                      ? ` · ${user.testLabel}`
                                      : ""}
                                  </div>
                                )}
                              </td>

                              <td style={td}>
                                {user.bannedUntil ? (
                                  "Banned"
                                ) : user.emailConfirmedAt ? (
                                  "Active"
                                ) : (
                                  "Unverified"
                                )}
                              </td>

                              <td style={td}>
                                {user.subscription
                                  ? `${user.subscription.plan || "Unknown"} · ${user.subscription.status || "unknown"}`
                                  : "None"}
                              </td>

                              <td style={td}>
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    gap: 6,
                                    flexWrap:
                                      "wrap",
                                  }}
                                >
                                  {!user.emailConfirmedAt && (
                                    <button
                                      style={button}
                                      onClick={() =>
                                        userAction(
                                          user.id,
                                          "confirm_email"
                                        )
                                      }
                                    >
                                      Confirm
                                    </button>
                                  )}

                                  {user.bannedUntil ? (
                                    <button
                                      style={button}
                                      onClick={() =>
                                        userAction(
                                          user.id,
                                          "unban"
                                        )
                                      }
                                    >
                                      Unban
                                    </button>
                                  ) : (
                                    <button
                                      style={button}
                                      onClick={() =>
                                        userAction(
                                          user.id,
                                          "ban"
                                        )
                                      }
                                    >
                                      Ban
                                    </button>
                                  )}

                                  <button
                                    style={button}
                                    onClick={() =>
                                      userAction(
                                        user.id,
                                        "reset_password"
                                      )
                                    }
                                  >
                                    Reset
                                  </button>

                                  <button
                                    style={{
                                      ...button,
                                      borderColor:
                                        "#ef4444",
                                    }}
                                    onClick={() =>
                                      deleteUser(
                                        user
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "employees" && (
            <>
              <h1>Employees</h1>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(320px,420px) 1fr",
                  gap: 18,
                  alignItems: "start",
                }}
              >
                <form
                  onSubmit={createEmployee}
                  style={card}
                >
                  <h2>Create employee</h2>

                  <label>Username</label>
                  <input
                    style={input}
                    value={
                      employeeForm.username
                    }
                    onChange={(event) =>
                      setEmployeeForm({
                        ...employeeForm,
                        username:
                          event.target.value,
                      })
                    }
                  />

                  <label>Full name</label>
                  <input
                    style={input}
                    value={
                      employeeForm.fullName
                    }
                    onChange={(event) =>
                      setEmployeeForm({
                        ...employeeForm,
                        fullName:
                          event.target.value,
                      })
                    }
                  />

                  <label>Password</label>
                  <input
                    type="password"
                    style={input}
                    value={
                      employeeForm.password
                    }
                    onChange={(event) =>
                      setEmployeeForm({
                        ...employeeForm,
                        password:
                          event.target.value,
                      })
                    }
                  />

                  <label>Role</label>
                  <select
                    style={input}
                    value={
                      employeeForm.role
                    }
                    onChange={(event) =>
                      setEmployeeForm({
                        ...employeeForm,
                        role:
                          event.target.value,
                      })
                    }
                  >
                    {roles.map((role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {role}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    style={button}
                  >
                    Create employee
                  </button>
                </form>

                <div style={card}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse:
                        "collapse",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={th}>
                          Employee
                        </th>
                        <th style={th}>
                          Role
                        </th>
                        <th style={th}>
                          Status
                        </th>
                        <th style={th}>
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {employees.map(
                        (employee) => (
                          <tr
                            key={employee.id}
                          >
                            <td style={td}>
                              <strong>
                                {employee.full_name ||
                                  employee.display_name}
                              </strong>

                              <div
                                style={{
                                  fontSize: 12,
                                  color:
                                    "#6b7280",
                                }}
                              >
                                {
                                  employee.username
                                }
                              </div>
                            </td>

                            <td style={td}>
                              <select
                                style={{
                                  ...input,
                                  margin: 0,
                                  width: 150,
                                }}
                                value={
                                  employee.role
                                }
                                onChange={(event) =>
                                  employeeAction(
                                    employee.id,
                                    "set_role",
                                    {
                                      role:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                              >
                                {roles.map(
                                  (role) => (
                                    <option
                                      key={
                                        role
                                      }
                                      value={
                                        role
                                      }
                                    >
                                      {role}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                            <td style={td}>
                              {employee.is_active
                                ? "Active"
                                : "Disabled"}
                            </td>

                            <td style={td}>
                              <div
                                style={{
                                  display:
                                    "flex",
                                  gap: 6,
                                  flexWrap:
                                    "wrap",
                                }}
                              >
                                <button
                                  style={
                                    button
                                  }
                                  onClick={() =>
                                    employeeAction(
                                      employee.id,
                                      employee.is_active
                                        ? "deactivate"
                                        : "activate"
                                    )
                                  }
                                >
                                  {employee.is_active
                                    ? "Disable"
                                    : "Enable"}
                                </button>

                                <button
                                  style={
                                    button
                                  }
                                  onClick={() => {
                                    const password =
                                      window.prompt(
                                        "New employee password:"
                                      );

                                    if (
                                      password
                                    ) {
                                      employeeAction(
                                        employee.id,
                                        "reset_password",
                                        {
                                          password,
                                        }
                                      );
                                    }
                                  }}
                                >
                                  Reset password
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === "traffic" && (
            <>
              <h1>Website traffic</h1>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(250px,1fr))",
                  gap: 14,
                }}
              >
                <div style={card}>
                  <h3>Top pages / routes</h3>

                  {(
                    stats?.traffic
                      ?.topPaths || []
                  ).map((item) => (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        padding: "7px 0",
                        borderBottom:
                          "1px solid #f1f5f9",
                      }}
                    >
                      <span>
                        {item.name}
                      </span>
                      <strong>
                        {item.count}
                      </strong>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <h3>Countries</h3>

                  {(
                    stats?.traffic
                      ?.countries || []
                  ).map((item) => (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        padding: "7px 0",
                      }}
                    >
                      <span>
                        {item.name}
                      </span>
                      <strong>
                        {item.count}
                      </strong>
                    </div>
                  ))}
                </div>

                <div style={card}>
                  <h3>Referrers</h3>

                  {(
                    stats?.traffic
                      ?.referrers || []
                  ).map((item) => (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        padding: "7px 0",
                      }}
                    >
                      <span>
                        {item.name}
                      </span>
                      <strong>
                        {item.count}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "subscriptions" && (
            <>
              <h1>Subscriptions</h1>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(240px,1fr))",
                  gap: 14,
                }}
              >
                <div style={card}>
                  <h3>By status</h3>

                  {Object.entries(
                    stats?.subscriptions
                      ?.byStatus || {}
                  ).map(
                    ([status, count]) => (
                      <div
                        key={status}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          padding: "8px 0",
                        }}
                      >
                        <span>
                          {status}
                        </span>

                        <strong>
                          {count}
                        </strong>
                      </div>
                    )
                  )}
                </div>

                <div style={card}>
                  <h3>By plan</h3>

                  {Object.entries(
                    stats?.subscriptions
                      ?.byPlan || {}
                  ).map(
                    ([plan, count]) => (
                      <div
                        key={plan}
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          padding: "8px 0",
                        }}
                      >
                        <span>{plan}</span>

                        <strong>
                          {count}
                        </strong>
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

const th = {
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 8px",
  fontSize: 12,
  color: "#6b7280",
};

const td = {
  borderBottom: "1px solid #f1f5f9",
  padding: "12px 8px",
  verticalAlign: "top",
};