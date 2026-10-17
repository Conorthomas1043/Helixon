// The overview's "Today" strip: the three things most worth doing now, each
// with one action, picked from what the overview already loads (interviews,
// money and compliance alerts, client follow-ups, the attention list).
// Most urgent first; similar candidate prompts are grouped into one card
// ("3 strong matches waiting") so the strip never lists the same kind twice.

const HOUR = 60 * 60 * 1000;
const MAX = 3;

function time(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function names(items) {
  const first = items.slice(0, 2).map((i) => i.candidateName);
  return items.length > 2 ? `${first.join(", ")} and ${items.length - 2} more` : first.join(" and ");
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * @param {{ interviews?: any[], alerts?: any[], clientFollowUps?: any[], attentionItems?: any[], now?: number }} input
 * @returns {{ id: string, tone: string, when: string, title: string, body: string, cta: string, href: string }[]}
 */
export function todayBriefing({ interviews = [], alerts = [], clientFollowUps = [], attentionItems = [], now = Date.now() } = {}) {
  const today = new Date(now);
  const cards = [];

  // The next interview in the coming day.
  const next = interviews
    .filter((i) => i.startsAt && Date.parse(i.startsAt) >= now - HOUR && Date.parse(i.startsAt) <= now + 24 * HOUR)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  if (next) {
    const isToday = sameDay(new Date(next.startsAt), today);
    cards.push({
      id: `interview-${next.id}`,
      urgency: isToday ? 1 : 3,
      tone: isToday ? "amber" : "neutral",
      when: `${isToday ? "Today" : "Tomorrow"} ${time(next.startsAt)}`,
      title: `${next.candidateName}'s interview`,
      body: [next.round > 1 ? `Round ${next.round}` : null, next.jobTitle].filter(Boolean).join(" · ") || "Interview",
      cta: "Prepare",
      href: `/dashboard/candidates/${next.candidateId}`,
    });
  }

  // The most urgent money or compliance problem.
  const alert = [...alerts].filter((a) => a.tone === "red").sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9))[0];
  if (alert) {
    const more = alerts.filter((a) => a.tone === "red").length - 1;
    cards.push({
      id: `alert-${alert.id}`,
      urgency: 0,
      tone: "red",
      when: "Overdue",
      title: alert.title,
      body: [alert.detail, more > 0 ? `${plural(more, "other")} to sort` : null].filter(Boolean).join(" · ") || "Needs sorting",
      cta: "Sort it",
      href: alert.href,
    });
  }

  const overdueClient = clientFollowUps.find((c) => c.overdue);
  if (overdueClient) {
    cards.push({
      id: `client-${overdueClient.id}`,
      urgency: 2,
      tone: "red",
      when: "Overdue",
      title: overdueClient.label,
      body: `Client · ${overdueClient.name}`,
      cta: "Open client",
      href: `/dashboard/clients/${overdueClient.id}`,
    });
  }

  const byKind = (suffix) => attentionItems.filter((i) => String(i.id).endsWith(suffix));

  const overdue = byKind("-overdue");
  if (overdue.length) {
    cards.push({
      id: "candidates-overdue",
      urgency: 1.5,
      tone: "red",
      when: "Overdue",
      title: overdue.length === 1 ? overdue[0].reasonLabel.replace(/^Overdue · /, "") : `${plural(overdue.length, "follow-up")} overdue`,
      body: overdue.length === 1 ? `${overdue[0].candidateName}${overdue[0].jobTitle ? ` · ${overdue[0].jobTitle}` : ""}` : names(overdue),
      cta: overdue.length === 1 ? "Open candidate" : "See them",
      href: overdue.length === 1 ? overdue[0].actionHref : "/dashboard/candidates",
    });
  }

  const failed = byKind("-failed");
  if (failed.length) {
    cards.push({
      id: "candidates-failed",
      urgency: 2.5,
      tone: "red",
      when: "Failed",
      title: `${plural(failed.length, "analysis", "analyses")} didn't finish`,
      body: names(failed),
      cta: "Retry",
      href: failed[0].actionHref,
    });
  }

  const strong = byKind("-unreviewed");
  if (strong.length) {
    cards.push({
      id: "candidates-strong",
      urgency: 4,
      tone: "green",
      when: "Waiting",
      title: `${plural(strong.length, "strong match", "strong matches")} to review`,
      body: names(strong),
      cta: "Review",
      href: strong.length === 1 ? strong[0].actionHref : "/dashboard/pipeline",
    });
  }

  const stalled = byKind("-stalled");
  if (stalled.length) {
    cards.push({
      id: "candidates-stalled",
      urgency: 5,
      tone: "amber",
      when: "5+ days",
      title: `${plural(stalled.length, "candidate")} stalled`,
      body: names(stalled),
      cta: stalled.length === 1 ? "Open candidate" : "Open pipeline",
      href: stalled.length === 1 ? stalled[0].actionHref : "/dashboard/pipeline",
    });
  }

  return cards
    .sort((a, b) => a.urgency - b.urgency)
    .slice(0, MAX)
    .map(({ urgency: _urgency, ...card }) => card);
}
