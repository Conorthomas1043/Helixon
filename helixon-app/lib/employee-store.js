// lib/employee-store.js
// Login, sessions, and to-dos have moved to lib/employee-auth.js and
// lib/employee-todos.js (Supabase-backed, real employees/employee_sessions/
// employee_todos tables). This file now only holds the read-only stats
// snapshot shown on the employee dashboard, since there's no stats table
// to back it yet — it's intentionally static.

export function getStats() {
  // Read-only subset of admin stats — safe for employee eyes.
  return {
    totalUsers: 4213,
    activeToday: 318,
    uptimePct: 99.97,
    openTickets: 12,
  };
}
