"use client";

// /dashboard/candidates/[id]/client-profile - the client-ready version of
// a candidate's profile (lib/client-profile.js), optionally anonymised, to
// print or save as PDF and send to a hiring manager.

import { use, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import DashboardNav from "@/components/DashboardNav";
import ClientProfileDocument from "@/components/dashboard/ClientProfileDocument";
import ClientProfileToolbar from "@/components/dashboard/ClientProfileToolbar";
import { getClientProfile, recordClientProfilePrinted } from "@/lib/dashboard-api";
import { printSection } from "@/lib/print";
import { INK, INK_MUTED, CARD } from "@/lib/candidate-format";

export default function ClientProfilePage({ params }) {
  const { id } = use(params);
  const { user } = useUser();
  const [options, setOptions] = useState({ blind: false, includeConcerns: false, showScore: true });
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const docRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getClientProfile(id, { blind: options.blind, includeConcerns: options.includeConcerns })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) setStatus(err.message === "Not found" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, options.blind, options.includeConcerns]);

  // Anonymising or adding concerns rebuilds the profile on the server; the
  // score toggle is display-only.
  function changeOptions(next) {
    if (next.blind !== options.blind || next.includeConcerns !== options.includeConcerns) setStatus("loading");
    setOptions(next);
  }

  function print() {
    recordClientProfilePrinted(id, { blind: options.blind }).catch(() => {});
    printSection(docRef.current);
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-8 space-y-5">
        <ClientProfileToolbar
          backHref={`/dashboard/candidates/${id}`}
          backLabel="Back to candidate"
          options={options}
          onOptions={changeOptions}
          onPrint={print}
          disabled={status !== "ready"}
        />
        {status === "loading" && <div className="rounded-[14px] h-96 animate-pulse motion-reduce:animate-none" style={CARD} aria-busy="true" />}
        {(status === "error" || status === "not-found") && (
          <div className="rounded-[14px] p-10 text-center" style={CARD}>
            <p className="font-semibold" style={{ color: INK }}>{status === "not-found" ? "Candidate not found" : "Unable to build the profile"}</p>
            <p className="text-[13px] mt-1" style={{ color: INK_MUTED }}>{status === "not-found" ? "They may have been removed." : "Please try again."}</p>
          </div>
        )}
        {status === "ready" && data && (
          <div ref={docRef}>
            <ClientProfileDocument
              profile={data.profile}
              agencyName={data.agencyName}
              preparedBy={data.preparedBy}
              preparedByEmail={user?.primaryEmailAddress?.emailAddress}
              showScore={options.showScore}
            />
          </div>
        )}
      </div>
    </main>
  );
}
