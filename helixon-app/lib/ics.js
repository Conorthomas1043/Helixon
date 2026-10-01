// iCalendar invites (RFC 5545 / iTIP RFC 5546) for interviews - attached
// to the invite email as invite.ics so Outlook, Google Calendar and Apple
// Calendar offer "Add to calendar" / accept. Updates reuse the same UID with
// a higher SEQUENCE; cancellations send METHOD:CANCEL.

const CRLF = "\r\n";

export function icsEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function icsDateTime(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Lines longer than 75 octets are folded: CRLF then a single space.
export function foldLine(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, "utf8");
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function person(prop, { name, email }, extra = "") {
  const cn = name ? `;CN="${String(name).replace(/["\\]/g, "")}"` : "";
  return `${prop}${cn}${extra}:mailto:${email}`;
}

// { uid, sequence, method: "REQUEST"|"CANCEL", start, durationMinutes,
//   summary, description, location, url, organizer: {name,email},
//   attendees: [{name,email}], now }
export function buildInvite(ev) {
  const start = new Date(ev.start);
  const end = new Date(start.getTime() + (ev.durationMinutes || 60) * 60000);
  const method = ev.method === "CANCEL" ? "CANCEL" : "REQUEST";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Helixon//Interviews//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence || 0}`,
    `DTSTAMP:${icsDateTime(ev.now || new Date())}`,
    `DTSTART:${icsDateTime(start)}`,
    `DTEND:${icsDateTime(end)}`,
    `SUMMARY:${icsEscape(ev.summary)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  if (ev.organizer?.email) lines.push(person("ORGANIZER", ev.organizer));
  for (const a of ev.attendees || []) {
    if (a?.email) lines.push(person("ATTENDEE", a, ";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE"));
  }
  lines.push(`STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
