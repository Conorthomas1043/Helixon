import { requireCustomerContext } from "@/lib/customer-auth";
import { loadCandidateProfile } from "@/lib/candidates/profile";
import { shapeCandidate } from "@/lib/candidates/shape";
import CandidateProfile from "./CandidateProfile";

// The candidate profile, loaded on the server so the page arrives with the
// candidate instead of a loading skeleton followed by a second request. It is
// the same loader and the same checks as GET /api/candidates/[id]. If it
// fails, the client component loads the profile itself and shows its own
// error or not-found state.
export default async function CandidateProfilePage({ params }) {
  const { id } = await params;
  let initialCandidate = null;
  try {
    const auth = await requireCustomerContext();
    if (auth.ok) {
      const result = await loadCandidateProfile(auth, id);
      if (result.status === 200) initialCandidate = shapeCandidate(result.body);
    }
  } catch {
    // Fall back to loading in the browser.
  }
  return <CandidateProfile id={id} initialCandidate={initialCandidate} />;
}
