import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function authEmployee(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const supabase = client();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const email = data.user.email?.toLowerCase();
  const employee = await supabase.from("employees").select("id,email").ilike("email", email).maybeSingle();
  if (employee.error || !employee.data) return null;
  return { supabase, user: data.user, employee: employee.data };
}

export async function GET(request) {
  const session = await authEmployee(request);
  if (!session) return NextResponse.json({ error: "Employee access required" }, { status: 403 });
  const { data, error } = await session.supabase.from("shared_todos").select("*").or(`created_by.eq.${session.user.id},assigned_to.eq.${session.user.id}`).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load shared tasks" }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request) {
  const session = await authEmployee(request);
  if (!session) return NextResponse.json({ error: "Employee access required" }, { status: 403 });
  const body = await request.json();
  const payload = { title: String(body.title || "").trim(), description: body.description ? String(body.description) : null, priority: body.priority || "normal", due_at: body.due_at || null, assigned_to: body.assigned_to || session.user.id, created_by: session.user.id, list_id: body.list_id || null };
  if (!payload.title || payload.title.length > 200) return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  const { data, error } = await session.supabase.from("shared_todos").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: "Unable to create shared task" }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request) {
  const session = await authEmployee(request);
  if (!session) return NextResponse.json({ error: "Employee access required" }, { status: 403 });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  const changes = {};
  for (const key of ["title", "description", "priority", "due_at", "completed"]) if (key in body) changes[key] = body[key];
  const { data, error } = await session.supabase.from("shared_todos").update(changes).eq("id", body.id).or(`created_by.eq.${session.user.id},assigned_to.eq.${session.user.id}`).select("*").single();
  if (error || !data) return NextResponse.json({ error: "Task not found or not permitted" }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request) {
  const session = await authEmployee(request);
  if (!session) return NextResponse.json({ error: "Employee access required" }, { status: 403 });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  const { error } = await session.supabase.from("shared_todos").delete().eq("id", body.id).eq("created_by", session.user.id);
  if (error) return NextResponse.json({ error: "Unable to delete task" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
