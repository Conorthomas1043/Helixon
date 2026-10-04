import { Resend } from "resend";
import { currentUser } from "@clerk/nextjs/server";

import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanLine } from "@/lib/sanitize";
import { rateLimit } from "@/lib/ratelimit";
import { logActivity } from "@/lib/candidates/activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { reportError } from "@/lib/report-error";
import { agencyDb } from "@/lib/agency-db";

// Sends real email through Resend, so cap how many one account can fire off
// even though each draft can only be sent once.
const MAX_SENDS_PER_HOUR = 60;

const resend = new Resend(
  process.env.RESEND_API_KEY
);

function isValidEmail(value) {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value.trim()
    )
  );
}

export async function POST(request) {
  try {
    const auth =
      await requireCustomerContext({
        requireSubscription: true,
      });

    if (!auth.ok) {
      return Response.json(
        {
          ok: false,
          upgrade: auth.upgrade || false,
          error: auth.error,
        },
        { status: auth.status }
      );
    }

    if (!(await rateLimit(`send-email:${auth.userId}`, MAX_SENDS_PER_HOUR))) {
      return Response.json(
        { ok: false, error: "Too many emails sent. Please try again later." },
        { status: 429 }
      );
    }

    const {
      userId,
      agencyId,
    } = auth;

    const body = await request.json();

    const artifactId =
      body?.artifactId;

    const to =
      typeof body?.to === "string"
        ? body.to.trim().toLowerCase()
        : "";

    const subject = cleanLine(body?.subject, 200);

    if (!artifactId || !to) {
      return Response.json(
        {
          ok: false,
          error:
            "Missing artifactId or recipient.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(to)) {
      return Response.json(
        {
          ok: false,
          error:
            "Invalid recipient email address.",
        },
        { status: 400 }
      );
    }

    const {
      data: artifact,
      error: artifactError,
    } = await (await agencyDb())
      .from("artifacts")
      .select("*")
      .eq("id", artifactId)
      .eq("agency_id", agencyId)
      .single();

    if (
      artifactError ||
      !artifact
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Email draft not found.",
        },
        { status: 404 }
      );
    }

    if (
      artifact.kind !==
      "email_draft"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This artifact cannot be emailed.",
        },
        { status: 400 }
      );
    }

    if (artifact.content?.sent_at) {
      return Response.json(
        {
          ok: false,
          error:
            "This email draft has already been sent.",
        },
        { status: 409 }
      );
    }

    const {
      data: agency,
    } = await supabase
      .from("agencies")
      .select(
        "id,name,settings"
      )
      .eq("id", agencyId)
      .single();

    const bodyText =
      artifact.content?.final_text ||
      artifact.content?.original_text ||
      "";

    if (!bodyText.trim()) {
      return Response.json(
        {
          ok: false,
          error:
            "This draft is empty.",
        },
        { status: 400 }
      );
    }

    if (
      !process.env.RESEND_API_KEY
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Email sending is not configured.",
        },
        { status: 500 }
      );
    }

    if (
      !process.env.RESEND_FROM_EMAIL
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Sender email is not configured.",
        },
        { status: 500 }
      );
    }

    // Agency-controlled text going into a raw From header: strip the
    // characters that end or restructure an address (quotes, angle
    // brackets, commas, semicolons, colons, line breaks), so a company
    // name like `x" <ceo@bank.example>` can't rewrite the sender.
    const fromName =
      String(
        agency?.settings
          ?.company_name ||
        agency?.name ||
        "Helixon"
      )
        .replace(/["<>,;:\\\r\n]/g, "")
        .trim()
        .slice(0, 80) || "Helixon";

    // Mail goes out from the no-reply sending address, so without a
    // Reply-To every reply from a candidate or client was lost. Replies now
    // go to the recruiter who sent it.
    const sender = await currentUser().catch(() => null);
    const replyTo =
      sender?.primaryEmailAddress?.emailAddress || undefined;

    const finalSubject =
      subject ||
      "Regarding your application";

    const {
      data: sent,
      error: sendError,
    } =
      await resend.emails.send({
        from: `${fromName} <${process.env.RESEND_FROM_EMAIL}>`,
        to,
        ...(replyTo ? { replyTo } : {}),
        subject: finalSubject,
        text: bodyText,
      });

    if (sendError) {
      reportError(
        "[send-email] Resend error:",
        sendError.message
      );

      return Response.json(
        {
          ok: false,
          error:
            "Failed to send email.",
        },
        { status: 502 }
      );
    }

    await (await agencyDb())
      .from("artifacts")
      .update({
        content: {
          ...artifact.content,

          sent_at:
            new Date().toISOString(),

          sent_to: to,

          resend_id:
            sent?.id || null,

          sent_by: userId,
        },
      })
      .eq("id", artifactId)
      .eq("agency_id", agencyId);

    // On the candidate's timeline, and counted with the rest of their
    // outreach in Analytics ("Emails") - sends from Helixon used to leave
    // no trace outside the draft itself.
    if (artifact.candidate_id) {
      await logActivity(
        supabase,
        artifact.candidate_id,
        "email_logged",
        recruiterDisplayName(auth.profile) || userId,
        { note: `Sent from Helixon to ${to}: "${finalSubject}"`, sent_via: "helixon" }
      ).catch((err) => {
        reportError("[send-email] Sent, but couldn't record it on the timeline:", err?.message);
      });
    }

    return Response.json({
      ok: true,
      sentTo: to,
      id: sent?.id || null,
    });
  } catch (error) {
    reportError(
      "[send-email] Error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to send email.",
      },
      { status: 500 }
    );
  }
}