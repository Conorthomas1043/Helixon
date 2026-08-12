"use client";
// components/admin/EmployeesTab.js
// Drop this component into your admin dashboard as the Employees tab.
// Lets admins list, create, delete, and reset passwords for employee accounts.

import { useState, useEffect, useCallback } from "react";

const ROLE_META = {
  manager:  { label: "Manager",  badge: "bg-violet-950 text-violet-300 border-violet-800" },
  employee: { label: "Employee", badge: "bg-slate-800 text-slate-400 border-slate-700" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_FORM = { username: "", full_name: "", password: "", role: "employee" };

export default function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // Create form
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving]       = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget]   = useState(null); // { id, username }
  const [resetPw, setResetPw]           = useState("");
  const [resetError, setResetError]     = useState("");
  const [resetting, setResetting]       = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/employees");
      const data = await res.json();
      if (data.ok) setEmployees(data.employees);
      else setError(data.error || "Failed to load employees.");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // ── Create ─────────────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.username.trim() || !form.full_name.trim() || !form.password.trim()) {
      setFormError("All fields are required.");
      return;
    }
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form }),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to create."); return; }
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchEmployees();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(emp) {
    if (!confirm(`Delete employee "${emp.username}"? This cannot be undone.`)) return;
    const res  = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: emp.id }),
    });
    const data = await res.json();
    if (data.ok) setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    else alert(data.error || "Failed to delete.");
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  async function handleReset(e) {
    e.preventDefault();
    setResetError("");
    if (resetPw.length < 8) { setResetError("Password must be at least 8 characters."); return; }
    setResetting(true);
    try {
      const res  = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", id: resetTarget.id, password: resetPw }),
      });
      const data = await res.json();
      if (!data.ok) { setResetError(data.error || "Failed to reset."); return; }
      setResetTarget(null);
      setResetPw("");
    } catch {
      setResetError("Network error.");
    } finally {
      setResetting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Employees</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {employees.length} account{employees.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(""); setForm(EMPTY_FORM); }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          {showForm ? "Cancel" : "+ Add employee"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">New employee</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full name *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Username *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                  placeholder="jsmith"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>

            {formError && (
              <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">{formError}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              {saving ? "Creating…" : "Create employee"}
            </button>
          </form>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-900 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm">No employees yet. Add one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Username</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {employees.map((emp) => {
                const rm = ROLE_META[emp.role] || ROLE_META.employee;
                return (
                  <tr key={emp.id} className="group hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5 text-white font-medium">{emp.full_name}</td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{emp.username}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${rm.badge}`}>
                        {rm.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(emp.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => { setResetTarget(emp); setResetPw(""); setResetError(""); }}
                          className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-700 transition"
                        >
                          Reset password
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="text-xs text-red-500 hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-950 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Reset password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Set a new password for <span className="text-slate-300 font-medium">{resetTarget.username}</span>.
            </p>
            <form onSubmit={handleReset} className="space-y-3">
              <input
                type="password"
                autoFocus
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
              {resetError && (
                <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">{resetError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={resetting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition"
                >
                  {resetting ? "Saving…" : "Save password"}
                </button>
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="flex-1 text-sm text-slate-400 hover:text-white py-2 rounded-lg hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}