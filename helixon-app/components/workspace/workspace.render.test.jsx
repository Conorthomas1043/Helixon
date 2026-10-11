// The workspace tab strip, the AI-writing notice and the split view, rendered
// the way the server renders them, so a broken screen fails CI rather than
// waiting for someone to look.

import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: null, isLoaded: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("open=c1,c2:cv"),
  usePathname: () => "/dashboard/candidates/c1",
}));
vi.mock("@/components/DashboardNav", () => ({ default: () => null }));

const { WorkspaceTabStrip } = await import("./WorkspaceTabs");
const { default: AiWritingNotice, AiWritingBadge } = await import("@/components/dashboard/AiWritingNotice");
const { default: SplitWorkspace } = await import("@/app/dashboard/workspace/SplitWorkspace");

const tabs = [
  { kind: "candidate", id: "c1", title: "Grace Hopper", openedAt: 1 },
  { kind: "candidate", id: "c2", title: "Alan Turing", openedAt: 2 },
  { kind: "job", id: "j1", title: "Data Engineer", openedAt: 3 },
];

describe("workspace screens", () => {
  it("the tab strip lists every tab, marks the open one and offers the split view", () => {
    const html = renderToString(<WorkspaceTabStrip tabs={tabs} activeKey="candidate:c1" onClose={() => {}} onCloseAll={() => {}} />);
    expect(html).toContain("Grace Hopper");
    expect(html).toContain('href="/dashboard/jobs/j1"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Close Alan Turing"');
    // The open candidate first, then the most recent.
    expect(html).toContain('href="/dashboard/workspace?open=c1,c2"');
  });

  it("no tabs, no strip", () => {
    expect(renderToString(<WorkspaceTabStrip tabs={[]} activeKey={null} onClose={() => {}} onCloseAll={() => {}} />)).toBe("");
  });

  it("the amber notice lists the signs and asks whether it's right", () => {
    const notice = { message: "This CV reads as if much of it was written with AI.", signals: ["Stock phrasing", "No figures"] };
    const html = renderToString(<AiWritingNotice notice={notice} candidateId="c1" />);
    expect(html).toContain("Possibly AI-written");
    expect(html).toContain("Stock phrasing");
    expect(html).toContain("Does this look right?");
    expect(renderToString(<AiWritingNotice notice={notice} />)).not.toContain("Does this look right?");
    expect(renderToString(<AiWritingNotice notice={null} />)).toBe("");
    expect(renderToString(<AiWritingBadge />)).toContain("Possibly AI-written");
  });

  it("the split view lays out a pane per candidate in the address", () => {
    const html = renderToString(<SplitWorkspace />);
    expect(html).toContain("Split view");
    expect((html.match(/<section aria-label=/g) || []).length).toBe(2);
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain("Compare");
  });
});
