"use client";

import { useMemo, useState } from "react";

import { PageHeader, KpiCard, Avatar, Drawer } from "../_shared/ui";
import { DataTable } from "../_shared/datatable";
import { useAdminUsers } from "../_shared/hooks";
import { confirmAction, promptText } from "../_shared/modal";
import { formatDate, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";

const PLAN_LABEL = { individual: "Individual", agency: "Agency", solo: "Individual" };

function displayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}

// Quick filters - each one answers a question an admin actually comes here
// with ("who's stuck?", "who's paying?"), and the KPI cards jump to them.
const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "unlinked", label: "Not set up", test: (u) => u.provider === "clerk" && !u.agency },
  { key: "paying", label: "Paying", test: (u) => u.subscription?.status === "active" && !u.isTestUser },
  { key: "demo", label: "Demo / test", test: (u) => u.isTestUser },
  { key: "unverified", label: "Unverified", test: (u) => !u.emailConfirmedAt },
  { key: "banned", label: "Banned", test: (u) => Boolean(u.bannedUntil) },
  { key: "legacy", label: "Legacy", test: (u) => u.provider !== "clerk" },
];

// The one thing most worth doing for this user right now, shown on the row.
// Everything else lives in the drawer so rows stay scannable.
function primaryAction(user) {
  if (user.provider !== "clerk") return null;
  if (!user.agency) return { key: "provision", label: "Set up agency", primary: true };
  if (user.subscription?.status !== "active") return { key: "grant_demo_access", label: "Grant demo access" };
  return null;
}

function UserDrawer({ user, busy, onClose, run }) {
  if (!user) return <Drawer open={false} onClose={onClose} />;
  const name = displayName(user);
  const clerk = user.provider === "clerk";
  const primary = primaryAction(user);

  return (
    <Drawer open onClose={onClose} title={name || user.email || "User"} subtitle={name ? user.email : user.username}>
      <section className="drawer-section">
        <h3>Account</h3>
        <dl className="kv">
          <dt>Type</dt>
          <dd>{clerk ? "Clerk (live customer)" : "Legacy - cannot sign in to the app"}</dd>
          <dt>Agency</dt>
          <dd>{user.agency ? user.agency.name || <span className="mono">{user.agency.id}</span> : clerk ? <span className="pill warn">Not set up</span> : "-"}</dd>
          <dt>Plan</dt>
          <dd>
            {user.subscription ? (
              <span className={`pill ${user.subscription.status === "active" ? "good" : "bad"}`}>
                {PLAN_LABEL[user.subscription.plan] || user.subscription.plan} · {user.subscription.status}
              </span>
            ) : (
              "None"
            )}
            {user.isTestUser && <span className="pill warn" style={{ marginLeft: 6 }}>{user.testLabel || "Test"}</span>}
          </dd>
          <dt>Signed up</dt>
          <dd>{formatDate(user.createdAt)}</dd>
          <dt>Last sign-in</dt>
          <dd>{user.lastSignInAt ? timeAgo(user.lastSignInAt) : "Never"}</dd>
          <dt>Email</dt>
          <dd>{user.emailConfirmedAt ? "Verified" : <span className="pill warn">Unverified</span>}</dd>
          <dt>ID</dt>
          <dd className="mono" style={{ wordBreak: "break-all" }}>{user.id}</dd>
        </dl>
      </section>

      {primary && (
        <section className="drawer-section">
          <h3>Suggested</h3>
          <button className={`btn ${primary.primary ? "primary" : ""}`} disabled={busy} onClick={() => run(primary.key, user)}>
            {primary.label}
          </button>
          <p className="faint" style={{ marginTop: 8 }}>
            {primary.key === "provision"
              ? "Creates their agency workspace so the app stops showing a setup screen. Doesn't create a subscription."
              : "Unlocks screening without payment - for demos and sales calls. Revoke any time."}
          </p>
        </section>
      )}

      <section className="drawer-section">
        <h3>Manage</h3>
        <div className="actions" style={{ flexWrap: "wrap", gap: 8 }}>
          <button className="btn small" disabled={busy} onClick={() => run("edit_name", user)}>
            <Icon name="user" /> Edit name
          </button>
          <button className="btn small" disabled={busy} onClick={() => run("reset_password", user)}>
            Reset password
          </button>
          {clerk && user.subscription?.status === "active" && user.isTestUser && (
            <button className="btn small" disabled={busy} onClick={() => run("revoke_demo_access", user)}>
              Revoke demo access
            </button>
          )}
          {!clerk && !user.emailConfirmedAt && (
            <button className="btn small" disabled={busy} onClick={() => run("confirm_email", user)}>
              Confirm email
            </button>
          )}
        </div>
      </section>

      <section className="drawer-section">
        <h3>Danger zone</h3>
        <div className="actions" style={{ flexWrap: "wrap", gap: 8 }}>
          <button className="btn small" disabled={busy} onClick={() => run(user.bannedUntil ? "unban" : "ban", user)}>
            {user.bannedUntil ? "Unban" : "Ban"}
          </button>
          <button className="btn small danger" disabled={busy} onClick={() => run("delete", user)}>
            <Icon name="trash" /> Delete user
          </button>
        </div>
      </section>
    </Drawer>
  );
}

export default function UsersPage() {
  const { users, clerkWarning, searchInput, setSearchInput, error, loading, busy, reload, action, remove, resetPassword } = useAdminUsers();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, users.filter(f.test).length])), [users]);
  const rows = useMemo(() => users.filter(FILTERS.find((f) => f.key === filter).test), [users, filter]);
  const selected = users.find((u) => u.id === selectedId) || null;

  // Every user action goes through here, so confirmations are consistent
  // (ban used to fire on a single click with no confirmation).
  async function run(key, user) {
    const who = user.email || displayName(user) || "this user";
    if (key === "provision") {
      const name = await promptText(`Agency name for ${who}:`, { defaultValue: user.firstName ? `${user.firstName}'s agency` : "" });
      if (name?.trim()) await action(user.id, "provision_agency", { agencyName: name.trim() });
    } else if (key === "edit_name") {
      const full = await promptText(`Full name for ${who}:`, { defaultValue: displayName(user) });
      if (full === null || full === undefined) return;
      const [firstName, ...rest] = full.trim().split(/\s+/);
      await action(user.id, "update_profile", { firstName: firstName || "", lastName: rest.join(" "), agencyId: user.agency?.id || null });
    } else if (key === "reset_password") {
      await resetPassword(user.id, user.email);
    } else if (key === "ban") {
      if (await confirmAction(`Ban ${who}? They'll be signed out and unable to sign in until unbanned.`, { title: "Ban user", danger: true })) {
        await action(user.id, "ban");
      }
    } else if (key === "revoke_demo_access") {
      if (await confirmAction(`Revoke demo access for ${who}? Screening will be locked until they subscribe.`, { title: "Revoke demo access" })) {
        await action(user.id, "revoke_demo_access");
      }
    } else if (key === "delete") {
      if (await remove(user.id, user.email)) setSelectedId(null);
    } else {
      await action(user.id, key);
    }
  }

  const columns = [
    {
      key: "email",
      label: "User",
      sortable: true,
      render: (user) => {
        const name = displayName(user);
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
      key: "agency",
      label: "Agency",
      sortable: true,
      sortValue: (user) => user.agency?.name || (user.agency ? "~" : "~~"),
      render: (user) =>
        user.agency ? (
          <span className="truncate" title={user.agency.id}>{user.agency.name || <span className="mono muted">{user.agency.id.slice(0, 8)}</span>}</span>
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
            {user.isTestUser ? " · demo" : ""}
          </span>
        ) : (
          <span className="faint">-</span>
        ),
    },
    {
      key: "lastSignInAt",
      label: "Last sign-in",
      sortable: true,
      defaultDir: "desc",
      render: (user) => (user.lastSignInAt ? <span title={user.lastSignInAt}>{timeAgo(user.lastSignInAt)}</span> : <span className="faint">Never</span>),
    },
    { key: "createdAt", label: "Signed up", sortable: true, defaultDir: "desc", render: (user) => <span className="muted">{formatDate(user.createdAt)}</span> },
    {
      key: "state",
      label: "State",
      render: (user) => (
        <div className="actions" style={{ gap: 5 }}>
          {user.bannedUntil ? <span className="pill bad">Banned</span> : <span className="pill good">Active</span>}
          {!user.emailConfirmedAt && <span className="pill warn">Unverified</span>}
          {user.provider !== "clerk" && <span className="pill bare" title="Created before the move to Clerk - cannot sign in to the app now">Legacy</span>}
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (user) => {
        const primary = primaryAction(user);
        return (
          <div className="actions" onClick={(e) => e.stopPropagation()}>
            {primary && (
              <button className={`btn small ${primary.primary ? "primary" : ""}`} onClick={() => run(primary.key, user)} disabled={busy}>
                {primary.label}
              </button>
            )}
            <button className="btn small" onClick={() => setSelectedId(user.id)} aria-label={`Manage ${user.email || "user"}`}>
              Manage
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Users" description="Everyone with a Helixon account. Click a row to manage it.">
        <div className="muted">{users.length} loaded</div>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {clerkWarning && <div className="notice warn" style={{ marginBottom: 16 }}>{clerkWarning}</div>}
      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="kpi-grid cols-4">
        {[
          ["paying", "Active subscriptions", "card", "var(--ok)", "Excludes demo accounts"],
          ["unlinked", "Not set up", "alert", "var(--warn)", "No agency - click to fix"],
          ["unverified", "Unverified email", "mail", "var(--info)", null],
          ["banned", "Banned", "ban", "var(--critical)", null],
        ].map(([key, label, icon, tone, foot]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(filter === key ? "all" : key)}
            style={{ all: "unset", cursor: "pointer", display: "block", borderRadius: 14, outline: filter === key ? `2px solid ${tone}` : "none" }}
            aria-pressed={filter === key}
          >
            <KpiCard label={label} value={counts[key] ?? 0} icon={icon} tone={tone} foot={foot} />
          </button>
        ))}
      </div>

      <div className="section-head" style={{ flexWrap: "wrap", gap: 8 }}>
        <input
          className="search-input"
          placeholder="Search by email, name, or ID..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search users"
        />
        <div className="actions" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Filter users">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`btn small ${filter === f.key ? "primary" : ""}`} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
              {f.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        pageSize={20}
        onRowClick={(user) => setSelectedId(user.id)}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        empty={{
          icon: "users",
          title: filter === "all" ? "No users found" : "Nobody matches this filter",
          body: filter === "all" ? "Accounts appear here as people sign up." : "Try another filter or clear the search.",
        }}
      />

      <UserDrawer user={selected} busy={busy} onClose={() => setSelectedId(null)} run={run} />
    </>
  );
}
