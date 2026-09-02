import { Resend } from "resend";

import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";

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

    const subject =
      typeof body?.subject === "string"
        ? body.subject.trim()
        : "";

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
    } = await supabase
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

    const fromName =
      agency?.settings
        ?.company_name ||
      agency?.name ||
      "Helixon";

    const {
      data: sent,
      error: sendError,
    } =
      await resend.emails.send({
        from: `${fromName} <${process.env.RESEND_FROM_EMAIL}>`,
        to,
        subject:
          subject ||
          "Regarding your application",
        text: bodyText,
      });

    if (sendError) {
      return Response.json(
        {
          ok: false,
          error:
            sendError.message ||
            "Failed to send email.",
        },
        { status: 502 }
      );
    }

    await supabase
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

    return Response.json({
      ok: true,
      sentTo: to,
      id: sent?.id || null,
    });
  } catch (error) {
    console.error(
      "[send-email] Error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to send email.",
      },
      { status: 500 }
    );
  }
}