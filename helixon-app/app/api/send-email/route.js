import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { artifactId, to, subject } = await request.json();

    if (!artifactId || !to) {
      return Response.json({ ok: false, error: "Missing artifactId or recipient." }, { status: 400 });
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(to)) {
      return Response.json({ ok: false, error: "Invalid recipient email address." }, { status: 400 });
    }

    // ── Resolve agencyId server-side ────────────────────────────────────
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          }
        }
      }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const userId = user?.id || null;
    const trialAgencyId = cookieStore.get("helixon_trial")?.value || null;
    const agencyId = userId ? null : trialAgencyId;

    if (!agencyId && !userId) {
      return Response.json({ ok: false, error: "No trial session found." }, { status: 401 });
    }

    // ── Fetch the artifact, scoped to this agency ───────────────────────
    const { data: artifact, error: artErr } = await supabase
      .from("artifacts")
      .select("*")
      .eq("id", artifactId)
      .eq("agency_id", agencyId)
      .single();

    if (artErr || !artifact) {
      return Response.json({ ok: false, error: "Draft not found." }, { status: 404 });
    }

    const { data: agency } = await supabase
      .from("agencies")
      .select("*")
      .eq("id", agencyId)
      .single();

    const bodyText = artifact.content?.final_text || artifact.content?.original_text || "";
    const fromName = agency?.settings?.company_name || agency?.name || "Helixon";

    const { data: sent, error: sendErr } = await resend.emails.send({
      from: `${fromName} <${process.env.RESEND_FROM_EMAIL}>`,
      to,
      subject: subject || "Regarding your application",
      text: bodyText,
    });

    if (sendErr) {
      return Response.json({ ok: false, error: sendErr.message || "Failed to send email." }, { status: 502 });
    }

    // ── Mark the artifact as sent ────────────────────────────────────────
    await supabase
      .from("artifacts")
      .update({
        content: {
          ...artifact.content,
          sent_at: new Date().toISOString(),
          sent_to: to,
          resend_id: sent?.id || null,
        },
      })
      .eq("id", artifactId);

    return Response.json({ ok: true, sentTo: to, id: sent?.id });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}