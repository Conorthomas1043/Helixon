"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmAction, promptNewPassword, promptText } from "./modal";
import { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER } from "@/lib/admin-csrf-constants";

// ── CSRF header helper ────────────────────────────────────────────────────
// Reads the non-httpOnly helixon_admin_csrf cookie (set by /api/admin/login,
// see lib/admin-csrf.js) and echoes it back as a header on every mutating
// admin fetch. The server compares cookie === header; see lib/admin-csrf.js
// for why this defeats CSRF without needing server-side token storage.
function csrfHeaders(extra = {}) {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_CSRF_COOKIE}=`));
  const token = match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
  return { ...extra, [ADMIN_CSRF_HEADER]: token };
}

export function useAdminStats(range) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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

export function useAdminTraffic(range) {
  const [traffic, setTraffic] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(`/api/admin/traffic?range=${range}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load traffic.");
      }

      setTraffic(data);
    } catch (err) {
      setError(err?.message || "Failed to load traffic.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const block = useCallback(
    async (ip) => {
      const reason = await promptText("Reason for blocking this IP:", {
        defaultValue: "Admin block",
      });
      if (reason === null) return;

      setBusy(true);
      setError("");

      try {
        const response = await fetch("/api/admin/traffic", {
          method: "POST",
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ ip, reason }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to block IP.");
        }

        await load();
      } catch (err) {
        setError(err?.message || "Failed to block IP.");
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

        await load();
      } catch (err) {
        setError(err?.message || "Failed to unblock IP.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return { traffic, error, busy, loading, reload: load, block, unblock };
}

export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(
        `/api/admin/users?perPage=100&search=${encodeURIComponent(search)}`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load users.");
      }

      setUsers(data.users || []);
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

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "User action failed.");
        }

        await load();
      } catch (err) {
        setError(err?.message || "User action failed.");
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

        await load();
      } catch (err) {
        setError(err?.message || "Failed to delete user.");
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
        { minLength: 8 },
      );
      if (password === null) return;

      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }

      await action(userId, "reset_password", { password });
    },
    [action],
  );

  return {
    users,
    searchInput,
    setSearchInput,
    error,
    busy,
    loading,
    reload: load,
    action,
    remove,
    resetPassword,
  };
}

export function useAdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "employee",
  });

  const load = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(`/api/admin/employees`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to load employees.");
      }

      setEmployees(data.employees || []);
    } catch (err) {
      setError(err?.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const action = useCallback(
    async (employeeId, actionName, extra = {}) => {
      setBusy(true);
      setError("");

      try {
        const response = await fetch("/api/admin/employees", {
          method: "PATCH",
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ employeeId, action: actionName, ...extra }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Employee action failed.");
        }

        await load();
      } catch (err) {
        setError(err?.message || "Employee action failed.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const create = useCallback(
    async (event) => {
      event.preventDefault();
      setBusy(true);
      setError("");

      try {
        const response = await fetch("/api/admin/employees", {
          method: "POST",
          headers: csrfHeaders({ "content-type": "application/json" }),
          body: JSON.stringify(form),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Employee creation failed.");
        }

        setForm({ username: "", password: "", fullName: "", role: "employee" });
        await load();
      } catch (err) {
        setError(err?.message || "Employee creation failed.");
      } finally {
        setBusy(false);
      }
    },
    [form, load],
  );

  return { employees, form, setForm, error, busy, loading, reload: load, action, create };
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
