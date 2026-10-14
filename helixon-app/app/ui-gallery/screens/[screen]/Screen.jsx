"use client";

import { Suspense } from "react";
import DashboardHome from "@/app/dashboard/DashboardHome";
import CandidateList from "@/app/dashboard/candidates/CandidateList";
import CandidateProfile from "@/app/dashboard/candidates/[id]/CandidateProfile";
import JobsList from "@/app/dashboard/jobs/JobsList";
import PipelinePage from "@/app/dashboard/pipeline/page";
import AnalysePage from "@/app/analyse/page";
import ClientsPage from "@/app/dashboard/clients/page";
import TalentPoolPage from "@/app/dashboard/talent-pool/page";
import InterviewsPage from "@/app/dashboard/interviews/page";
import PlacementsPage from "@/app/dashboard/placements/page";
import SettingsPage from "@/app/dashboard/settings/page";

const RENDER = {
  overview: () => <DashboardHome initialStats={null} />,
  candidates: () => <CandidateList initialData={null} />,
  candidate: () => <CandidateProfile id="c1" initialCandidate={null} />,
  jobs: () => <JobsList initialJobs={null} />,
  pipeline: () => <PipelinePage />,
  screen: () => <AnalysePage />,
  clients: () => <ClientsPage />,
  "talent-pool": () => <TalentPoolPage />,
  interviews: () => <InterviewsPage />,
  placements: () => <PlacementsPage />,
  settings: () => <SettingsPage />,
};

export default function Screen({ screen }) {
  return <Suspense fallback={null}>{RENDER[screen]()}</Suspense>;
}
