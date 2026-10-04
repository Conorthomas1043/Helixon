"use client";

// /dashboard/shortlists/[id]/client-pack - every person on a shortlist as
// a client-ready profile (lib/client-profile.js), one per printed page, in
// the shortlist's order (strongest match first). Anonymised packs label
// people Candidate A, B, C… in that order.

import { use, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import DashboardNav from "@/components/DashboardNav";
import ClientProfileDocument from "@/components/dashboard/ClientProfileDocument";
import ClientProfileToolbar from "@/components/dashboard/ClientProfileToolbar";
import { getShortlist, getClientProfile, recordClientProfilePrinted } from "@/lib/dashboard-api";
import { blindLabel } from "@/lib/client-profile";
import { printSection } from "@/lib/print";
import { INK, INK_MUTED, CARD } from "@/lib/candidate-format";

export default function ClientPackPage({ params }) {
  const { id } = use(params);
  const { user } = useUser();
  const [options, setOptions] = useState({ blind: false, includeConcerns: false, showScore: true });
  const [shortlist, setShortlist] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [status, setStatus] = useState("loading");
  const docRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getShortlist(id)
      .then(async (d) => {
        const results = await Promise.all(
          d.candidates.map((c, i) =>
            getClientProfile(c.id, { blind: options.blind, includeConcerns: options.includeConcerns, label: blindLabel(i) })
              .then((p) => ({ id: c.id, ...p }))
              .catch(() => null)
          )
        );
        if (cancelled) return;
        setShortlist(d.shortlist);
        setProfiles(results.filter(Boolean));
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
    for (const p of profiles ?? []) recordClientProfilePrinted(p.id, { blind: options.blind }).catch(() => {});
    printSection(docRef.current);
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-8 space-y-5">
        <ClientProfileToolbar
          backHref={`/dashboard/shortlists/${id}`}
          backLabel="Back to shortlist"
          options={options}
          onOptions={changeOptions}
          onPrint={print}
          disabled={status !== "ready" || !profiles?.length}
        />
        {status === "loading" && <div className="rounded-[14px] h-96 animate-pulse motion-reduce:animate-none" style={CARD} aria-busy="true" />}
        {(status === "error" || status === "not-found") && (
          <div className="rounded-[14px] p-10 text-center" style={CARD}>
            <p className="font-semibold" style={{ color: INK }}>{status === "not-found" ? "Shortlist not found" : "Unable to build the pack"}</p>
          </div>
        )}
        {status === "ready" && profiles.length === 0 && (
          <div className="rounded-[14px] p-10 text-center text-[14px]" style={{ ...CARD, color: INK_MUTED }}>
            Nobody on this shortlist yet.
          </div>
        )}
        {status === "ready" && profiles.length > 0 && (
          <div ref={docRef} className="space-y-6">
            <p className="print-hide text-[13px]" style={{ color: INK_MUTED }}>
              {shortlist.name} · {profiles.length} {profiles.length === 1 ? "profile" : "profiles"}, one per printed page
            </p>
            {profiles.map((p) => (
              <ClientProfileDocument
                key={p.id}
                profile={p.profile}
                agencyName={p.agencyName}
                preparedBy={p.preparedBy}
                preparedByEmail={user?.primaryEmailAddress?.emailAddress}
                showScore={options.showScore}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
