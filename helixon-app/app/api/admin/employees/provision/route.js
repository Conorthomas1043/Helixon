import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function configuredAdmins() {
  return String(process.env.HELIXON_ADMIN_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(request, supabase) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return false;
  return configuredAdmins().includes(data.user.email.toLowerCase());
}

async function sendDetailsEmail({ to, name, loginEmail, testUserEmail }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return { sent: false, reason: "RESEND_API_KEY/RESEND_FROM not configured" };

  const html = `<!doctype html><html><body><h2>Helixon employee created</h2><p>Hello ${escapeHtml(name || "")},</p><p>Your employee record has been created.</p><p><strong>Login email:</strong> ${escapeHtml(loginEmail)}</p>${testUserEmail ? `<p><strong>Linked test user:</strong> ${escapeHtml(testUserEmail)}</p>` : ""}<p>Use the normal Helixon authentication/invitation flow to set access credentials. This email intentionally does not contain passwords or secrets.</p></body></html>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: "Your Helixon employee account", html }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Resend HTTP ${response.status}`);
  return { sent: true, id: body?.id || null };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

export async function POST(request) {
  const supabase = adminClient();
  if (!(await requireAdmin(request, supabase))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const createTestUser = Boolean(body.createTestUser);
  const sendEmail = Boolean(body.sendEmail);

  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Valid name and email are required" }, { status: 400 });

  let authUserId = null;
  let testUser = null;
  let employee = null;

  try {
    const created = await supabase.auth.admin.createUser({ email, email_confirm: false, user_metadata: { helixon_employee: true, name } });
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });
    authUserId = created.data.user?.id;
    if (!authUserId) throw new Error("Auth user was not created");

    if (createTestUser) {
      const testEmail = `test+${authUserId.slice(0, 12)}@helixon.local`;
      const testCreated = await supabase.auth.admin.createUser({ email: testEmail, email_confirm: true, user_metadata: { is_test_user: true, test_label: `Employee test user for ${name}`, test_created_by: authUserId } });
      if (testCreated.error) throw new Error(testCreated.error.message);
      testUser = { id: testCreated.data.user.id, email: testEmail };

      const userInsert = await supabase.from("users").insert({ id: testUser.id, email: testEmail, is_test_user: true, test_label: `Employee test user for ${name}`, test_created_by: authUserId });
      if (userInsert.error) throw new Error(userInsert.error.message);
    }

    const insert = await supabase.from("employees").insert({ name, email, linked_test_user_id: testUser?.id || null }).select("*").single();
    if (insert.error) throw new Error(insert.error.message);
    employee = insert.data;

    let emailResult = { sent: false, reason: "disabled" };
    if (sendEmail) emailResult = await sendDetailsEmail({ to: email, name, loginEmail: email, testUserEmail: testUser?.email || null });

    return NextResponse.json({ employee, testUser, email: emailResult }, { status: 201 });
  } catch (error) {
    console.error("Employee provisioning failed", error);
    if (authUserId && !employee) {
      await supabase.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }
    return NextResponse.json({ error: "Employee provisioning failed", detail: process.env.NODE_ENV === "development" ? error.message : undefined }, { status: 500 });
  }
}
