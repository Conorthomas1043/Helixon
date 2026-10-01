"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmAction, promptNewPassword, promptText } from "./modal";
import { csrfHeaders } from "./csrf"; // echoes the CSRF cookie back as a header on mutating requests
import { toast } from "./toast";

// range null = don't fetch (a page that only needs stats sometimes).
export function useAdminStats(range) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!range) return;
    setError("");

    try {
      const response = await fetch(`/api/admin/stats?range=${range}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load stats.");
      }

      setStats(data);
    } catch (err) {
      setError(err?.message || "Failed to load stats.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, error, loading, reload: load };
}

// `filters` narrows the request log (the map and totals always cover the
// whole range): { country: "GB", ip: "1.2.3.4", blocked: true }.
export function useAdminTraffic(range, filters = {}) {
  const [traffic, setTraffic] = useState(null);
  const qs = [
    `range=${encodeURIComponent(range)}`,
    filters.country ? `country=${encodeURIComponent(filters.country)}` : "",
    filters.ip ? `ip=${encodeURIComponent(filters.ip)}` : "",
    filters.blocked ? "blocked=1" : "",
    filters.outcome ? `outcome=${encodeURIComponent(filters.outcome)}` : "",
    filters.flagged ? "flagged=1" : "",
    filters.method ? `method=${encodeURIComponent(filters.method)}` : "",
    filters.path ? `path=${encodeURIComponent(filters.path)}` : "",
    filters.ua ? `ua=${encodeURIComponent(filters.ua)}` : "",
    filters.referrer ? `referrer=${encodeURIComponent(filters.referrer)}` : "",
    filters.audience ? `audience=${encodeURIComponent(filters.audience)}` : "",
    filters.from ? `from=${encodeURIComponent(filters.from)}` : "",
    filters.to ? `to=${encodeURIComponent(filters.to)}` : "",
  ].filter(Boolean).join("&");
  // Older pages of the log, appended by loadOlder(); cleared whenever the
  // filters (qs) change or the log reloads.
  const [older, setOlder] = useState({ qs: "", rows: [], cursor: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(`/api/admin/traffic?${qs}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load traffic.");
      }

      setTraffic(data);
      setOlder({ qs, rows: [], cursor: null });
    } catch (err) {
      setError(err?.message || "Failed to load traffic.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  // Next page of older requests (keyset: everything before the oldest row
  // shown so far).
  const loadOlder = useCallback(async () => {
    const current = older.qs === qs ? older : { qs, rows: [], cursor: null };
    const cursor = current.cursor || traffic?.cursor;
    if (!cursor) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/traffic?${qs}&before=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Failed to load older requests.");
      setOlder({ qs, rows: [...current.rows, ...(data.rows || [])], cursor: data.cursor || null, done: !data.cursor });
    } catch (err) {
      toast.error(err?.message || "Failed to load older requests.");
    } finally {
      setBusy(false);
    }
  }, [qs, older, traffic]);

  const olderRows = older.qs === qs ? older.rows : [];
  const hasOlder = older.qs === qs && older.rows.length ? !older.done : Boolean(traffic?.cursor);

  useEffect(() => {
    load();
  }, [load]);

  // `hours`: optional block length; omitted/0 = permanent.
  const block = useCallback(
    async (ip, presetReason, hours = 0) => {
      const reason = presetReason ?? (await promptText(`Reason for blocking ${ip}:`, {
        defaultValue: "Admin block",
      }));
      if (reason === null) return false;

      setBusy(true);
      setError("");

      try {
        const response = await fetch("/api/admin/traffic", {
          method: "POST",
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ ip, reason, hours }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to block IP.");
        }

        toast.success(hours ? `${ip} blocked for ${hours >= 24 ? `${Math.round(hours / 24)} day(s)` : `${hours} hour(s)`}.` : `${ip} blocked.`);
        await load();
        return true;
      } catch (err) {
        setError(err?.message || "Failed to block IP.");
        toast.error(err?.message || "Failed to block IP.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const unblock = useCallback(
    async (ip) => {
      setBusy(true);
      setError("");

      try {
        const response = await fetch("/api/admin/traffic", {
          method: "DELETE",
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ ip }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to unblock IP.");
        }

        toast.success(`${ip} unblocked.`);
        await load();
      } catch (err) {
        setError(err?.message || "Failed to unblock IP.");
        toast.error(err?.message || "Failed to unblock IP.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return { traffic, error, busy, loading, reload: load, block, unblock, olderRows, hasOlder, loadOlder };
}

const USER_ACTION_DONE = {
  ban: "User banned.",
  unban: "User unbanned.",
  reset_password: "Password updated.",
  update_profile: "Profile saved.",
  provision_agency: "Agency set up.",
  grant_demo_access: "Demo access granted.",
  revoke_demo_access: "Demo access revoked.",
  confirm_email: "Email confirmed.",
  revoke_sessions: "Signed out on every device.",
  set_agency: "Agency changed.",
};

export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [clerkWarning, setClerkWarning] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(
        // No page parameter: the API returns every account, so the counts
        // and filters here cover everyone.
        `/api/admin/users?search=${encodeURIComponent(search)}`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load users.");
      }

      setUsers(data.users || []);
      setClerkWarning(
        data.clerkError || (data.truncated ? `Showing the newest ${data.users?.length || 0} of ${data.total} accounts - search to find anyone older.` : ""),
      );
    } catch (err) {
      setError(err?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    load();
  }, [load]);

  // Confirms success with a toast (it used to reload silently, so an admin
  // couldn't tell whether a click had done anything) and reports failures
  // as a toast too - the page-top error notice is often scrolled out of view.
  // Resolves true on success.
  const action = useCallback(
    async (userId, actionName, extra = {}) => {
      setBusy(true);
      setError("");

      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ userId, action: actionName, ...extra }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "User action failed.");
        }

        toast.success(USER_ACTION_DONE[actionName] || "Done.");
        await load();
        return true;
      } catch (err) {
        const message = err?.message || "User action failed.";
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (userId, email) => {
      const confirmed = await confirmAction(
        `Permanently delete ${email || "this user"}? This cannot be undone.`,
        { title: "Delete user", danger: true },
      );
      if (!confirmed) return;

      setBusy(true);
      setError("");

      try {
        const response = await fetch("/api/admin/users", {
          method: "DELETE",
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ userId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to delete user.");
        }

        toast.success(`Deleted ${email || "user"}.`);
        await load();
        return true;
      } catch (err) {
        const message = err?.message || "Failed to delete user.";
        setError(message);
        toast.error(message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const resetPassword = useCallback(
    async (userId, email) => {
      const password = await promptNewPassword(
        `New password for ${email || "this user"}:`,
        { minLength: 12 },
      );
      if (password === null) return;

      if (password.length < 12) {
        toast.error("Password must be at least 12 characters.");
        return false;
      }

      await action(userId, "reset_password", { password });
    },
    [action],
  );

  // The same action on several accounts, one request at a time (each is
  // audited separately), with one summary toast and one reload at the end.
  const bulk = useCallback(
    async (userIds, actionName, extra = {}) => {
      setBusy(true);
      setError("");
      let done = 0;
      const failed = [];
      for (const userId of userIds) {
        try {
          const response = await fetch("/api/admin/users", {
            method: "PATCH",
            headers: csrfHeaders({ "content-type": "application/json" }),
            body: JSON.stringify({ userId, action: actionName, ...extra }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "failed");
          done += 1;
        } catch (err) {
          failed.push(err?.message || "failed");
        }
      }
      if (failed.length) toast.error(`${done} done, ${failed.length} failed (${failed[0]}).`);
      else toast.success(`${USER_ACTION_DONE[actionName] || "Done."} (${done} account${done === 1 ? "" : "s"})`);
      await load();
      setBusy(false);
      return failed.length === 0;
    },
    [load],
  );

  return {
    users,
    clerkWarning,
    searchInput,
    setSearchInput,
    error,
    busy,
    loading,
    reload: load,
    action,
    bulk,
    remove,
    resetPassword,
  };
}

// Staff accounts for /admin/employees. `patch` and `create` return the
// API's JSON on success (it may carry a one-time `temporaryPassword`) and
// null on failure, after showing the error as a toast.
export function useAdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/employees`, { cache: "no-store" });
      if (response.status === 401) throw new Error("Your admin session has ended. Sign in again to continue.");
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Failed to load employees.");
      setEmployees(data.employees || []);
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(
    async (method, url, body, fallback) => {
      setBusy(true);
      try {
        const response = await fetch(url, {
          method,
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || fallback);
        await load();
        return data;
      } catch (err) {
        toast.error(err?.message || fallback);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const patch = useCallback(
    (employeeId, action, extra = {}) =>
      send("PATCH", "/api/admin/employees", { employeeId, action, ...extra }, "Employee action failed."),
    [send],
  );

  const create = useCallback((payload) => send("POST", "/api/admin/employees", payload, "Couldn't create the employee."), [send]);

  // Signs this browser into the staff portal (own account, or as someone)
  // and goes there.
  const openPortal = useCallback(
    async (employeeId = null) => {
      const data = await send("POST", "/api/admin/employees/portal", employeeId ? { employeeId } : {}, "Couldn't open the portal.");
      if (data?.redirect) window.location.assign(data.redirect);
    },
    [send],
  );

  return { employees, error, busy, loading, reload: load, patch, create, openPortal };
}

// Aggregated cross-package data (sales, SEO, security, revenue) - the same
// payload the standalone Sales/SEO pages already read from, surfaced here so
// Command can house all of it in one place instead of sending people
// section-by-section.
export function useAdminOps() {
  const [ops, setOps] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/admin/ops", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load operational data.");
      }

      setOps(data);
    } catch (err) {
      setError(err?.message || "Failed to load operational data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ops, error, loading, reload: load };
}

// Combined infrastructure/product health: Stripe/Clerk/Redis/Resend/Sentry
// (the same data useAdminServices reads) plus the database itself, the AI
// providers the product runs on, and a live check that key public pages
// still return 200. See app/api/admin/health and lib/ops/health-checks.js.
export function useAdminHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/admin/health", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load health data.");
      }

      setHealth(data);
    } catch (err) {
      setError(err?.message || "Failed to load health data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { health, error, loading, reload: load };
}

// Live per-service data (Stripe, Clerk, Redis, Resend, Sentry) - queried
// directly from each service rather than through the Supabase mirror, which
// is missing fields (e.g. subscription amounts) and, for users, is no
// longer even the right identity source post-Clerk-migration.
export function useAdminServices() {
  const [services, setServices] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/admin/services", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load service data.");
      }

      setServices(data);
    } catch (err) {
      setError(err?.message || "Failed to load service data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { services, error, loading, reload: load };
}
