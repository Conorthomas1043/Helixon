"use client";

import { PageHeader, KpiCard, Avatar } from "../_shared/ui";
import { DataTable } from "../_shared/datatable";
import { useAdminUsers } from "../_shared/hooks";
import { promptText } from "../_shared/modal";
import { formatDate, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";

const PLAN_LABEL = { individual: "Individual", agency: "Agency", solo: "Individual" };

export default function UsersPage() {
  const {
    users,
    clerkWarning,
    searchInput,
    setSearchInput,
    error,
    loading,
    busy,
    reload,
    action,
    remove,
    resetPassword,
  } = useAdminUsers();

  const banned = users.filter((user) => user.bannedUntil).length;
  const unverified = users.filter((user) => !user.emailConfirmedAt).length;
  const paying = users.filter((user) => user.subscription?.status === "active").length;
  // Signed in but with no agency: these accounts get "not connected to an agency"
  // errors everywhere in the app until someone sets them up.
  const unlinked = users.filter((user) => user.provider === "clerk" && !user.agency).length;

  async function provision(user) {
    const name = await promptText(`Agency name for ${user.email || "this user"}:`, {
      defaultValue: user.firstName ? `${user.firstName}'s agency` : "",
    });
    if (!name || !name.trim()) return;
    action(user.id, "provision_agency", { agencyName: name.trim() });
  }

  const columns = [
    {
      key: "email",
      label: "User",
      sortable: true,
      render: (user) => {
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <Avatar name={name || user.email} />
            <span style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontWeight: 600 }}>{name || user.email || "(no email)"}</div>
              <div className="faint truncate">{name ? user.email : user.username}</div>
            </span>
          </span>
        );
      },
    },
    {
      key: "provider",
      label: "Account",
      sortable: true,
      render: (user) =>
        user.provider === "clerk" ? <span className="pill info bare">Clerk</span> : <span className="pill bare" title="Created before the move to Clerk - cannot sign in to the app now">Legacy</span>,
    },
    {
      key: "agency",
      label: "Agency",
      sortable: true,
      sortValue: (user) => (user.agency ? 0 : 1),
      render: (user) =>
        user.agency ? (
          <span className="mono muted">{user.agency.id.slice(0, 8)}</span>
        ) : user.provider === "clerk" ? (
          <span className="pill warn">Not set up</span>
        ) : (
          <span className="faint">-</span>
        ),
    },
    {
      key: "plan",
      label: "Plan",
      sortable: true,
      sortValue: (user) => user.subscription?.plan || "",
      render: (user) =>
        user.subscription ? (
          <span className={`pill ${user.subscription.status === "active" ? "good" : "bad"}`}>
            {PLAN_LABEL[user.subscription.plan] || user.subscription.plan}
          </span>
        ) : (
          <span className="faint">-</span>
        ),
    },
    { key: "createdAt", label: "Signed up", sortable: true, defaultDir: "desc", render: (user) => <span className="muted">{formatDate(user.createdAt)}</span> },
    {
      key: "lastSignInAt",
      label: "Last sign-in",
      sortable: true,
      defaultDir: "desc",
      render: (user) => (user.lastSignInAt ? <span title={user.lastSignInAt}>{timeAgo(user.lastSignInAt)}</span> : <span className="faint">Never</span>),
    },
    {
      key: "state",
      label: "State",
      render: (user) => (
        <div className="actions" style={{ gap: 5 }}>
          {user.bannedUntil ? <span className="pill bad">Banned</span> : <span className="pill good">Active</span>}
          {!user.emailConfirmedAt && <span className="pill warn">Unverified</span>}
          {user.isTestUser && <span className="pill warn">Test</span>}
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (user) => (
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          {user.provider === "clerk" && !user.agency && (
            <button className="btn small primary" onClick={() => provision(user)} disabled={busy}>
              Set up agency
            </button>
          )}
          <button className="btn small" onClick={() => action(user.id, user.bannedUntil ? "unban" : "ban")} disabled={busy}>
            {user.bannedUntil ? "Unban" : "Ban"}
          </button>
          {user.provider !== "clerk" && !user.emailConfirmedAt && (
            <button className="btn small" onClick={() => action(user.id, "confirm_email")} disabled={busy}>
              Confirm email
            </button>
          )}
          <button className="btn small" onClick={() => resetPassword(user.id, user.email)} disabled={busy}>
            Reset password
          </button>
          <button className="btn small danger" onClick={() => remove(user.id, user.email)} disabled={busy} aria-label={`Delete ${user.email}`}>
            <Icon name="trash" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Users" description="Everyone with a Helixon account - Clerk accounts (the live customers) and any older accounts from before the move.">
        <div className="muted">{users.length} loaded</div>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {clerkWarning && <div className="notice warn" style={{ marginBottom: 16 }}>{clerkWarning}</div>}
      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      {unlinked > 0 && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <b>{unlinked}</b> {unlinked === 1 ? "account is" : "accounts are"} signed up but not connected to an agency, so the app shows them a
          &ldquo;finish setting up&rdquo; screen. Use <b>Set up agency</b> on the row to fix one (this doesn&apos;t create a subscription).
        </div>
      )}

      <div className="kpi-grid cols-4">
        <KpiCard label="Active subscriptions" value={paying} icon="card" tone="var(--ok)" />
        <KpiCard label="Not set up" value={unlinked} icon="alert" tone="var(--warn)" foot="No agency linked" />
        <KpiCard label="Unverified email" value={unverified} icon="mail" tone="var(--info)" />
        <KpiCard label="Banned" value={banned} icon="ban" tone="var(--critical)" />
      </div>

      <div className="section-head">
        <input
          className="search-input"
          placeholder="Search by email, name, or ID..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search users"
        />
      </div>

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        pageSize={20}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        empty={{ icon: "users", title: "No users found", body: "Accounts appear here as people sign up." }}
      />
    </>
  );
}
