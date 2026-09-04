"use client";

import { PageHeader, KpiCard } from "../_shared/ui";
import { useAdminUsers } from "../_shared/hooks";

export default function UsersPage() {
  const {
    users,
    searchInput,
    setSearchInput,
    error,
    busy,
    action,
    remove,
    resetPassword,
  } = useAdminUsers();

  const banned = users.filter((user) => user.bannedUntil).length;
  const unverified = users.filter((user) => !user.emailConfirmedAt).length;
  const paying = users.filter((user) => user.subscription?.status === "active").length;

  return (
    <>
      <PageHeader title="Users" description="Everyone with a Helixon account.">
        <div className="muted">{users.length} loaded</div>
      </PageHeader>

      <div className="kpi-grid cols-3">
        <KpiCard label="Active subscriptions" value={paying} tone="var(--ok)" />
        <KpiCard label="Unverified email" value={unverified} tone="var(--warn)" />
        <KpiCard label="Banned" value={banned} tone="var(--critical)" />
      </div>

      {error && <div className="notice error section">{error}</div>}

      <div className="section-head">
        <input
          className="search-input"
          placeholder="Search by email, name, or ID…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Agency</th>
              <th>Plan</th>
              <th>Signed up</th>
              <th>Last sign-in</th>
              <th>State</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.email}
                    <div className="muted mono">{user.id}</div>
                  </td>

                  <td>
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") || "-"}
                  </td>

                  <td>{user.agency?.id || "-"}</td>

                  <td>
                    {user.subscription?.plan || "-"}
                    {user.subscription?.status && (
                      <div className="muted">{user.subscription.status}</div>
                    )}
                  </td>

                  <td className="mono">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                  </td>

                  <td className="mono">
                    {user.lastSignInAt
                      ? new Date(user.lastSignInAt).toLocaleString()
                      : "Never"}
                  </td>

                  <td>
                    <div className="actions" style={{ gap: 5 }}>
                      {user.bannedUntil ? (
                        <span className="pill bad">Banned</span>
                      ) : (
                        <span className="pill good">Active</span>
                      )}

                      {!user.emailConfirmedAt && <span className="pill warn">Unverified</span>}
                      {user.isTestUser && <span className="pill warn">Test</span>}
                    </div>
                  </td>

                  <td>
                    <div className="actions">
                      <button
                        className="btn small"
                        onClick={() => action(user.id, user.bannedUntil ? "unban" : "ban")}
                        disabled={busy}
                      >
                        {user.bannedUntil ? "Unban" : "Ban"}
                      </button>

                      {!user.emailConfirmedAt && (
                        <button
                          className="btn small"
                          onClick={() => action(user.id, "confirm_email")}
                          disabled={busy}
                        >
                          Confirm email
                        </button>
                      )}

                      <button
                        className="btn small"
                        onClick={() => resetPassword(user.id, user.email)}
                        disabled={busy}
                      >
                        Reset password
                      </button>

                      <button
                        className="btn small danger"
                        onClick={() => remove(user.id, user.email)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
