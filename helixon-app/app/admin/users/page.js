"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader, KpiCard, Avatar, Drawer } from "../_shared/ui";
import { DataTable } from "../_shared/datatable";
import { useAdminUsers } from "../_shared/hooks";
import { confirmAction, promptText } from "../_shared/modal";
import { toast } from "../_shared/toast";
import { formatDate, formatDateTime, timeAgo, useAdminData } from "../_shared/data";
import { Icon } from "../_shared/icons";
import { downloadCsv } from "@/lib/csv";

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

const DEMO_LENGTHS = [
  [0, "No end date"],
  [7, "7 days"],
  [14, "14 days"],
  [30, "30 days"],
];
const BAN_LENGTHS = [
  [0, "Until unbanned"],
  [1, "1 day"],
  [7, "7 days"],
  [30, "30 days"],
];

// "Banned" with its end date when it has one. Clerk bans have no end of
// their own (a far-future marker); timed ones carry banEndsAt, and legacy
// accounts have a real banned_until.
function banLabel(user) {
  if (user.banEndsAt) return `Banned until ${formatDateTime(user.banEndsAt)}`;
  const until = Date.parse(user.bannedUntil);
  if (Number.isFinite(until) && new Date(until).getUTCFullYear() < 2100) return `Banned until ${formatDateTime(user.bannedUntil)}`;
  return "Banned";
}

const HISTORY_LABELS = {
  user_ban: "Banned",
  user_unban: "Unbanned",
  user_reset_password: "Password reset",
  user_update_profile: "Profile edited",
  user_set_agency: "Agency changed",
  user_provision_agency: "Agency set up",
  user_grant_demo_access: "Demo access granted",
  user_revoke_demo_access: "Demo access revoked",
  user_revoke_sessions: "Signed out everywhere",
  user_confirm_email: "Email confirmed",
};

function UserHistory({ userId }) {
  const { data, loading } = useAdminData(`/api/admin/users?history=${encodeURIComponent(userId)}`);
  const rows = data?.history || [];
  if (loading && !data) return <div className="skeleton" style={{ height: 40 }} />;
  if (!rows.length) return <div className="faint" style={{ fontSize: 13.5 }}>No admin changes recorded.</div>;
  return (
    <div className="mini-list">
      {rows.map((h) => (
        <div className="mini-row" key={h.id}>
          <div style={{ minWidth: 0 }}>
            <div>{HISTORY_LABELS[h.action] || h.action}{h.reason ? ` - ${h.reason}` : ""}</div>
            <div className="faint" style={{ fontSize: 13 }}>by {h.admin} · {formatDateTime(h.at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Move a user to another agency (or detach them). Loads the agency list
// only when the drawer is open.
function AgencyPicker({ user, busy, run }) {
  const { data } = useAdminData("/api/admin/agencies");
  const [value, setValue] = useState(null);
  const agencies = data?.agencies || [];
  const current = user.agency?.id || "";
  const selected = value ?? current;
  return (
    <div className="inline-form">
      <select className="select-input" value={selected} onChange={(e) => setValue(e.target.value)} aria-label="Agency" style={{ flex: 1, minWidth: 0 }}>
        <option value="">No agency</option>
        {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        {current && !agencies.some((a) => a.id === current) && <option value={current}>{user.agency?.name || current}</option>}
      </select>
      <button className="btn small" disabled={busy || selected === current} onClick={() => run("set_agency", user, { agencyId: selected || null }).then(() => setValue(null))}>
        Move
      </button>
    </div>
  );
}

function UserDrawer({ user, busy, onClose, run }) {
  const [demoPlan, setDemoPlan] = useState("agency");
  const [demoDays, setDemoDays] = useState(14);
  const [banDays, setBanDays] = useState(0);
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
            {user.subscription?.demoExpiresAt && (
              <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
                Demo access {user.subscription.status === "active" ? "ends" : "ended"} {formatDateTime(user.subscription.demoExpiresAt)}
              </div>
            )}
          </dd>
          <dt>Signed up</dt>
          <dd>{formatDate(user.createdAt)}</dd>
          <dt>Last sign-in</dt>
          <dd>{user.lastSignInAt ? timeAgo(user.lastSignInAt) : "Never"}</dd>
          <dt>Email</dt>
          <dd>{user.emailConfirmedAt ? "Verified" : <span className="pill warn">Unverified</span>}</dd>
          {user.bannedUntil && (
            <>
              <dt>Banned</dt>
              <dd><span className="pill bad">{banLabel(user)}</span>{user.banReason ? <span className="muted"> - {user.banReason}</span> : null}</dd>
            </>
          )}
          <dt>ID</dt>
          <dd className="mono" style={{ wordBreak: "break-all" }}>{user.id}</dd>
        </dl>
      </section>

      {primary && (
        <section className="drawer-section">
          <h3>Suggested</h3>
          <div className="inline-form">
            {primary.key === "grant_demo_access" && (
              <>
                <select className="select-input" value={demoPlan} onChange={(e) => setDemoPlan(e.target.value)} aria-label="Demo plan">
                  <option value="agency">Agency plan</option>
                  <option value="individual">Individual plan</option>
                </select>
                <select className="select-input" value={demoDays} onChange={(e) => setDemoDays(Number(e.target.value))} aria-label="How long">
                  {DEMO_LENGTHS.map(([days, label]) => <option key={days} value={days}>{label}</option>)}
                </select>
              </>
            )}
            <button className={`btn ${primary.primary ? "primary" : ""}`} disabled={busy} onClick={() => run(primary.key, user, { plan: demoPlan, days: demoDays })}>
              {primary.label}
            </button>
          </div>
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
          {clerk && (
            <button className="btn small" disabled={busy} onClick={() => run("revoke_sessions", user)}>
              Sign out everywhere
            </button>
          )}
          {!clerk && !user.emailConfirmedAt && (
            <button className="btn small" disabled={busy} onClick={() => run("confirm_email", user)}>
              Confirm email
            </button>
          )}
        </div>
      </section>

      {clerk && user.agency !== undefined && (
        <section className="drawer-section">
          <h3>Agency</h3>
          <AgencyPicker user={user} busy={busy} run={run} />
          <p className="faint" style={{ marginTop: 8, fontSize: 13 }}>Moving someone changes which workspace, candidates and plan they see. Their own subscription (if any) moves with them.</p>
        </section>
      )}

      <section className="drawer-section">
        <h3>History</h3>
        <UserHistory userId={user.id} />
      </section>

      <section className="drawer-section">
        <h3>Danger zone</h3>
        <div className="actions" style={{ flexWrap: "wrap", gap: 8 }}>
          {user.bannedUntil ? (
            <button className="btn small" disabled={busy} onClick={() => run("unban", user)}>Unban</button>
          ) : (
            <span className="inline-form">
              <select className="select-input" value={banDays} onChange={(e) => setBanDays(Number(e.target.value))} aria-label="Ban length">
                {BAN_LENGTHS.map(([days, label]) => <option key={days} value={days}>{label}</option>)}
              </select>
              <button className="btn small" disabled={busy} onClick={() => run("ban", user, { days: banDays })}>Ban</button>
            </span>
          )}
          <button className="btn small danger" disabled={busy} onClick={() => run("delete", user)}>
            <Icon name="trash" /> Delete user
          </button>
        </div>
      </section>
    </Drawer>
  );
}

function exportUsers(rows) {
  downloadCsv(
    `helixon-users-${new Date().toISOString().slice(0, 10)}.csv`,
    rows.map((u) => ({
      email: u.email,
      name: displayName(u),
      agency: u.agency?.name || "",
      plan: u.subscription?.plan || "",
      subscription_status: u.subscription?.status || "",
      demo: u.isTestUser ? "yes" : "",
      banned: u.bannedUntil ? "yes" : "",
      email_verified: u.emailConfirmedAt ? "yes" : "no",
      signed_up: u.createdAt || "",
      last_sign_in: u.lastSignInAt || "",
      type: u.provider,
      id: u.id,
    })),
  );
}

export default function UsersPage() {
  const { users, clerkWarning, searchInput, setSearchInput, error, loading, busy, reload, action, bulk, remove, resetPassword } = useAdminUsers();
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  // Accounts ticked for a bulk action.
  const [picked, setPicked] = useState(() => new Set());

  // ?q=... (links from an agency's member list) starts the page searched
  // and opens that account. Read after mount so the server render matches.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return undefined;
    const timer = setTimeout(() => {
      setSearchInput(q);
      setSelectedId(q);
    }, 0);
    return () => clearTimeout(timer);
  }, [setSearchInput]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, users.filter(f.test).length])), [users]);
  const rows = useMemo(() => users.filter(FILTERS.find((f) => f.key === filter).test), [users, filter]);
  const selected = users.find((u) => u.id === selectedId) || null;
  const pickedUsers = users.filter((u) => picked.has(u.id));

  function togglePick(id) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(key) {
    const n = pickedUsers.length;
    const clerkIds = pickedUsers.filter((u) => u.provider === "clerk").map((u) => u.id);
    const ids = pickedUsers.map((u) => u.id);
    if (key === "revoke_sessions") {
      if (!clerkIds.length) return toast.warn("Only Clerk accounts have sessions to sign out.");
      if (!(await confirmAction(`Sign ${clerkIds.length} account${clerkIds.length === 1 ? "" : "s"} out on every device?`, { title: "Sign out everywhere" }))) return;
      await bulk(clerkIds, "revoke_sessions");
    } else if (key === "ban") {
      const reason = await promptText(`Why are you banning these ${n} accounts? They'll be signed out and unable to sign in until unbanned.`, { defaultValue: "" });
      if (reason === null || reason === undefined) return;
      await bulk(ids.filter((id) => !users.find((u) => u.id === id)?.bannedUntil), "ban", { reason: reason.trim() });
    } else if (key === "unban") {
      if (!(await confirmAction(`Unban ${n} account${n === 1 ? "" : "s"}?`, { title: "Unban" }))) return;
      await bulk(ids.filter((id) => users.find((u) => u.id === id)?.bannedUntil), "unban");
    }
    setPicked(new Set());
  }

  // Every user action goes through here, so confirmations are consistent
  // (ban used to fire on a single click with no confirmation).
  async function run(key, user, extra = {}) {
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
      const length = extra.days ? `for ${extra.days} day${extra.days === 1 ? "" : "s"}` : "until you unban them";
      const reason = await promptText(`Why are you banning ${who}? They'll be signed out and unable to sign in ${length}.`, { defaultValue: "" });
      if (reason !== null && reason !== undefined) await action(user.id, "ban", { reason: reason.trim(), days: extra.days || 0 });
    } else if (key === "grant_demo_access") {
      await action(user.id, "grant_demo_access", { plan: extra.plan, days: extra.days || 0 });
    } else if (key === "set_agency") {
      const target = extra.agencyId ? "another agency" : "no agency";
      if (await confirmAction(`Move ${who} to ${target}? They'll see that workspace's candidates and plan from their next page load.`, { title: "Change agency" })) {
        await action(user.id, "set_agency", { agencyId: extra.agencyId });
      }
    } else if (key === "revoke_sessions") {
      if (await confirmAction(`Sign ${who} out on every device? They can sign straight back in.`, { title: "Sign out everywhere" })) {
        await action(user.id, "revoke_sessions");
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
      key: "pick",
      label: "",
      render: (user) => (
        <input
          type="checkbox"
          checked={picked.has(user.id)}
          onChange={() => togglePick(user.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${user.email || displayName(user) || user.id}`}
        />
      ),
    },
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
        <div className="muted">{users.length} accounts</div>
        <button className="btn small" onClick={() => exportUsers(rows)} disabled={!rows.length}>
          <Icon name="external" /> Export CSV
        </button>
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

      {picked.size > 0 ? (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <b>{picked.size} selected</b>
          <button className="btn small" disabled={busy} onClick={() => runBulk("revoke_sessions")}>Sign out everywhere</button>
          <button className="btn small danger" disabled={busy} onClick={() => runBulk("ban")}>Ban</button>
          <button className="btn small" disabled={busy} onClick={() => runBulk("unban")}>Unban</button>
          <button className="btn small" onClick={() => exportUsers(pickedUsers)}>Export selected</button>
          <button className="btn small ghost" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      ) : (
        rows.length > 0 && (
          <div className="faint" style={{ fontSize: 13, marginBottom: 8 }}>
            Tick accounts for bulk actions, or{" "}
            <button className="panel-link" style={{ marginLeft: 0 }} onClick={() => setPicked(new Set(rows.map((u) => u.id)))}>
              select all {rows.length} shown
            </button>
            .
          </div>
        )
      )}

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
