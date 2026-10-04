import { requireCustomerContext } from "@/lib/customer-auth";
import { countCandidateStages, listCandidates } from "@/lib/candidate-list";
import { buildCandidatesQuery, filtersFromParams } from "@/lib/candidate-list-params";
import CandidateList from "./CandidateList";

// The candidate list, loaded on the server so it arrives with its first page
// and stage counts instead of a skeleton. Same loaders and checks as GET
// /api/candidates and /api/candidates/stage-counts, with the filters read
// from the address bar the same way the list reads them. If it fails, the
// list loads itself and shows its own error state.
export default async function CandidatesPage({ searchParams }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of [value].flat()) if (v != null) params.append(key, v);
  }
  let initialData = null;
  try {
    const auth = await requireCustomerContext();
    if (auth.ok) {
      const query = buildCandidatesQuery(filtersFromParams(params));
      const [list, counts] = await Promise.all([listCandidates(auth, query), countCandidateStages(auth, query)]);
      if (list.status === 200 && counts.status === 200) initialData = { result: list.body, stageCounts: counts.body };
    }
  } catch {
    // Fall back to loading in the browser.
  }
  return <CandidateList initialData={initialData} />;
}
