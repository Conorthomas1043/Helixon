"use client";

import Link from "next/link";

import { Panel, Avatar, Skeleton } from "../_shared/ui";
import { useAdminData, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";

const POLL = 120_000;

function Row({ left, right }) {
  return (
    <div className="mini-row">
      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>{left}</span>
      <span className="faint" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{right}</span>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Skeleton height={26} />
      <Skeleton height={26} />
      <Skeleton height={26} />
    </div>
  );
}

// "Needs attention" + latest activity, so the landing page answers "what should
// I look at right now?" before "what are the numbers?".
export default function RecentPanels() {
  const leads = useAdminData("/api/admin/leads?range=30d", { every: POLL });
  const agencies = useAdminData("/api/admin/agencies", { every: POLL });
  const audit = useAdminData("/api/admin/audit?page=1", { every: POLL });

  const attention = [];

  const notEmailed = leads.data?.summary?.notEmailed || 0;
  if (notEmailed > 0) {
    attention.push({
      key: "leads",
      href: "/admin/leads",
      icon: "inbox",
      text: `${notEmailed} ${notEmailed === 1 ? "lead" : "leads"} saved but your team was never notified`,
    });
  }

  const withoutPlan = agencies.data?.summary?.withoutPlan || 0;
  if (withoutPlan > 0) {
    attention.push({
      key: "plan",
      href: "/admin/agencies",
      icon: "building",
      text: `${withoutPlan} ${withoutPlan === 1 ? "agency has" : "agencies have"} no active plan`,
    });
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const failedLogins = (audit.data?.entries || []).filter(
    (e) => e.action === "admin_login_failed" && Date.parse(e.at) > dayAgo,
  ).length;
  if (failedLogins > 0) {
    attention.push({
      key: "logins",
      href: "/admin/audit?action=admin_login_failed",
      icon: "alert",
      text: `${failedLogins} failed admin sign-in ${failedLogins === 1 ? "attempt" : "attempts"} in the last 24 hours`,
    });
  }

  const latestLeads = (leads.data?.leads || []).slice(0, 5);
  const newestAgencies = (agencies.data?.agencies || []).slice(0, 5);
  const recentAudit = (audit.data?.entries || []).slice(0, 5);

  const allLoaded = leads.data && agencies.data && audit.data;

  return (
    <>
      <div className="section">
        {allLoaded && attention.length === 0 ? (
          <div className="notice" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--ok)", display: "inline-flex" }}>
              <Icon name="check" />
            </span>
            <span>
              <b>Nothing needs attention.</b> No unnotified leads, agencies without a plan or failed admin sign-ins.
            </span>
          </div>
        ) : (
          attention.length > 0 && (
            <div className="grid-3" style={{ gap: 12 }}>
              {attention.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="notice warn"
                  style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}
                >
                  <Icon name={item.icon} />
                  <span style={{ flex: 1 }}>{item.text}</span>
                  <Icon name="chevronRight" />
                </Link>
              ))}
            </div>
          )
        )}
      </div>

      <div className="grid-3 section">
        <Panel
          title="Latest leads"
          sub="Last 30 days"
          action={
            <Link className="panel-link" href="/admin/leads">
              All leads
            </Link>
          }
        >
          {!leads.data ? (
            <Loading />
          ) : latestLeads.length === 0 ? (
            <div className="empty">No demo requests yet.</div>
          ) : (
            <div className="mini-list">
              {latestLeads.map((l) => (
                <Row
                  key={l.id}
                  left={
                    <>
                      <Avatar name={l.name} size={28} />
                      <span style={{ minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{l.name}</div>
                        <div className="faint truncate" style={{ fontSize: 12 }}>{l.company || l.email}</div>
                      </span>
                    </>
                  }
                  right={timeAgo(l.createdAt)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Newest agencies"
          sub="Latest sign-ups"
          action={
            <Link className="panel-link" href="/admin/agencies">
              All agencies
            </Link>
          }
        >
          {!agencies.data ? (
            <Loading />
          ) : newestAgencies.length === 0 ? (
            <div className="empty">No agencies yet.</div>
          ) : (
            <div className="mini-list">
              {newestAgencies.map((a) => (
                <Row
                  key={a.id}
                  left={
                    <>
                      <Avatar name={a.name} size={28} />
                      <span style={{ minWidth: 0 }}>
                        <div className="truncate" style={{ fontWeight: 600 }}>{a.name}</div>
                        <div className="faint" style={{ fontSize: 12 }}>
                          {a.subscriptionStatus === "active" ? "Paying" : "No plan"} &middot; {a.members} {a.members === 1 ? "member" : "members"}
                        </div>
                      </span>
                    </>
                  }
                  right={timeAgo(a.createdAt)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent admin activity"
          sub="From the audit log"
          action={
            <Link className="panel-link" href="/admin/audit">
              Full log
            </Link>
          }
        >
          {!audit.data ? (
            <Loading />
          ) : recentAudit.length === 0 ? (
            <div className="empty">No activity recorded.</div>
          ) : (
            <div className="mini-list">
              {recentAudit.map((e) => (
                <Row
                  key={e.id}
                  left={
                    <span style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 600 }}>{e.action.replace(/_/g, " ")}</div>
                      <div className="faint truncate" style={{ fontSize: 12 }}>by {e.admin}</div>
                    </span>
                  }
                  right={timeAgo(e.at)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
