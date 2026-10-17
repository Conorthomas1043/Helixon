import { describe, expect, it } from "vitest";
import { todayBriefing } from "./today";

const NOW = new Date(2026, 9, 17, 9, 0).getTime();
const at = (h, dayOffset = 0) => new Date(2026, 9, 17 + dayOffset, h, 0).toISOString();
const item = (id, name, extra = {}) => ({ id, candidateName: name, jobTitle: "Warehouse Operative", actionHref: `/dashboard/candidates/${name}`, reasonLabel: "", ...extra });

describe("todayBriefing", () => {
  it("is empty when there's nothing to do", () => {
    expect(todayBriefing({ now: NOW })).toEqual([]);
  });

  it("puts an overdue invoice first, then today's interview, then overdue follow-ups", () => {
    const cards = todayBriefing({
      now: NOW,
      interviews: [{ id: "i1", candidateId: "amy", candidateName: "Amy Clarke", startsAt: at(14), round: 2, jobTitle: "Team Leader" }],
      alerts: [{ id: "inv", tone: "red", priority: 0, title: "Invoice INV-7 is 3 days overdue", detail: "Northwind", href: "/dashboard/placements?tab=invoices" }],
      attentionItems: [item("a-overdue", "Jordan", { reasonLabel: "Overdue · Send to Northwind" }), item("b-unreviewed", "Priya")],
    });
    expect(cards.map((c) => c.id)).toEqual(["alert-inv", "interview-i1", "candidates-overdue"]);
    expect(cards[1]).toMatchObject({ when: "Today 14:00", title: "Amy Clarke's interview", body: "Round 2 · Team Leader", cta: "Prepare" });
    expect(cards[2].title).toBe("Send to Northwind");
  });

  it("groups strong matches into one card and names a few", () => {
    const [card] = todayBriefing({ now: NOW, attentionItems: ["Amy", "Dan", "Priya", "Tom"].map((n) => item(`${n}-unreviewed`, n)) });
    expect(card).toMatchObject({ title: "4 strong matches to review", body: "Amy, Dan and 2 more", href: "/dashboard/pipeline" });
  });

  it("links straight to the candidate when there's only one", () => {
    const [card] = todayBriefing({ now: NOW, attentionItems: [item("x-unreviewed", "Amy")] });
    expect(card).toMatchObject({ title: "1 strong match to review", href: "/dashboard/candidates/Amy" });
  });

  it("ignores interviews more than a day away and amber alerts", () => {
    const cards = todayBriefing({
      now: NOW,
      interviews: [{ id: "i2", candidateId: "c", candidateName: "Cat", startsAt: at(10, 3) }],
      alerts: [{ id: "chk", tone: "amber", title: "DBS expires soon", href: "/x" }],
    });
    expect(cards).toEqual([]);
  });

  it("shows tomorrow's interview as tomorrow", () => {
    const [card] = todayBriefing({ now: NOW, interviews: [{ id: "i3", candidateId: "c", candidateName: "Cat", startsAt: at(8, 1) }] });
    expect(card.when).toBe("Tomorrow 08:00");
  });

  it("keeps at most three", () => {
    const cards = todayBriefing({
      now: NOW,
      alerts: [{ id: "a", tone: "red", title: "x", href: "/" }],
      clientFollowUps: [{ id: "c", overdue: true, label: "Call Lisa", name: "Northwind" }],
      attentionItems: [item("1-overdue", "A"), item("2-failed", "B"), item("3-unreviewed", "C"), item("4-stalled", "D")],
    });
    expect(cards).toHaveLength(3);
  });
});
