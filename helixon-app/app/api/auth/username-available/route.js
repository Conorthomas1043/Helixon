import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("u") || "").trim();

  if (!USERNAME_RE.test(raw)) {
    return NextResponse.json({ available: false, reason: "invalid" }, { status: 200 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", raw)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, reason: "error" }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}