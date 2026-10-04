import { NextResponse } from "next/server";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { siteUrl } from "@/lib/mailer";
import { bccAddress, memberToken } from "@/lib/member-tokens";
import { inboundDomain } from "@/lib/tracked-email";

// The signed-in member's calendar feed and BCC logging address
// (lib/member-tokens.js), made on first ask.
// GET                          both
// POST { purpose, rotate }     a new one - the old feed URL / address stops working

async function shape(auth, rotatePurpose = null) {
  const cal = await memberToken(auth, "calendar", { rotate: rotatePurpose === "calendar" });
  if (cal.unavailable) return { unavailable: true };
  const domain = inboundDomain();
  const bcc = domain ? await memberToken(auth, "bcc", { rotate: rotatePurpose === "bcc" }) : null;
  const feed = `${siteUrl()}/api/calendar/${cal.token}.ics`;
  return {
    calendarUrl: feed,
    calendarTeamUrl: `${feed}?scope=team`,
    // webcal:// opens the subscribe dialog in Apple Calendar and Outlook.
    calendarWebcal: feed.replace(/^https?:/, "webcal:"),
    bccAddress: bcc?.token ? bccAddress(bcc.token, domain) : null,
    bccAvailable: Boolean(domain),
  };
}

export const GET = customerRoute(async (_request, _context, auth) => {
  return NextResponse.json(await shape(auth));
});

export const POST = customerRoute(async (request, _context, auth, input) => {
  const body = input;
  if (!["calendar", "bcc"].includes(body.purpose) || body.rotate !== true) return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
  return NextResponse.json(await shape(auth, body.purpose));
}, { body: JsonObject, optionalBody: true });
