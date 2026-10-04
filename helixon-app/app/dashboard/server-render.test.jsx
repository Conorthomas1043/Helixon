// The dashboard home, candidate list and jobs list are now rendered on the
// server with their data (page.js / page.jsx pass it in). This renders each
// client component the way the server does - no window, no localStorage -
// and checks the data is in the HTML rather than a loading skeleton.

import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: null, isLoaded: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard",
}));
vi.mock("@/components/DashboardNav", () => ({ default: () => null }));
vi.mock("@/components/dashboard/research", () => ({ PulseSurvey: () => null }));

const { default: DashboardHome } = await import("./DashboardHome");
const { default: CandidateList } = await import("./candidates/CandidateList");
const { default: JobsList } = await import("./jobs/JobsList");

describe("server-rendered dashboard pages", () => {
  it("dashboard home shows the agency's numbers", () => {
    const html = renderToString(
      <DashboardHome
        initialStats={{
          agencyName: "Acme Recruiting",
          plan: null,
          truncated: false,
          analyses: [
            { id: "c1", candidateId: "c1", candidateName: "Ada Lovelace", jobId: "j1", jobTitle: "Engineer", status: "completed", stage: "Screened", score: 91, createdAt: "2026-10-01T10:00:00Z" },
          ],
        }}
      />
    );
    expect(html).toContain("Acme Recruiting");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Recent analyses"); // a panel the skeleton doesn't have
  });

  it("candidate list shows its first page", () => {
    const html = renderToString(
      <CandidateList
        initialData={{
          result: { items: [{ id: "c1", fullName: "Ada Lovelace", stage: "Screened", status: "completed", score: 91, tags: [], skills: ["Rust"] }], total: 1, page: 1, pageSize: 8, totalPages: 1 },
          stageCounts: { all: 1, Screened: 1 },
        }}
      />
    );
    expect(html).toContain("Ada Lovelace");
    expect(html).not.toContain("Loading candidates");
  });

  it("jobs list shows the jobs", () => {
    const html = renderToString(
      <JobsList initialJobs={[{ id: "j1", title: "Platform Engineer", client: "Acme", status: "open", candidateCount: 3, created_at: "2026-10-01T10:00:00Z" }]} />
    );
    expect(html).toContain("Platform Engineer");
  });

  it("each falls back to its loading state without server data", () => {
    expect(renderToString(<CandidateList />)).toContain("Loading candidates");
    expect(renderToString(<DashboardHome />)).toBeTruthy();
    expect(renderToString(<JobsList />)).toBeTruthy();
  });
});
