// One client-ready candidate profile as a printable page (see
// lib/client-profile.js for what's in it and what's deliberately not).
// Used by /dashboard/candidates/[id]/client-profile and a shortlist's
// client pack, which prints one of these per page.

const INK = "#13201b";
const MUTED = "#4a6658";
const FAINT = "#7a948a";
const RULE = "#dfe7e2";

const STATUS = {
  met: { mark: "✓", color: "#0f6b4f", label: "Met" },
  unverified: { mark: "?", color: "#92620f", label: "Not shown on CV" },
  not_met: { mark: "✕", color: "#b42318", label: "Not met" },
};

function Heading({ children }) {
  return (
    <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: FAINT }}>
      {children}
    </h3>
  );
}

export default function ClientProfileDocument({ profile, agencyName, preparedBy, preparedByEmail, showScore = true }) {
  const p = profile;
  const facts = [
    p.yearsExperience != null && `${Math.round(p.yearsExperience)} years' experience`,
    p.location,
    p.noticePeriod && `Notice: ${p.noticePeriod}`,
    p.willingToRelocate === true && "Open to relocating",
    p.languages.length > 0 && p.languages.join(", "),
  ].filter(Boolean);

  return (
    <article className="client-profile-page bg-white rounded-[14px] p-8 sm:p-10 text-[14px] leading-relaxed" style={{ color: INK, border: `1px solid ${RULE}` }}>
      <header className="flex items-start justify-between gap-6 pb-5 mb-6" style={{ borderBottom: `2px solid ${INK}` }}>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: FAINT }}>
            Candidate profile{p.job?.title ? ` · ${p.job.title}` : ""}{p.job?.client && !p.blind ? ` · ${p.job.client}` : ""}
          </p>
          <h2 className="text-[26px] font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {p.name}
          </h2>
          {(p.currentTitle || p.currentEmployer) && (
            <p className="text-[14px] mt-1" style={{ color: MUTED }}>
              {[p.currentTitle, p.currentEmployer].filter(Boolean).join(" at ")}
            </p>
          )}
          {facts.length > 0 && (
            <p className="text-[13px] mt-2" style={{ color: MUTED }}>
              {facts.join(" · ")}
            </p>
          )}
        </div>
        {showScore && p.score != null && (
          <div className="text-center shrink-0">
            <div className="text-[34px] font-semibold leading-none tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "#0f6b4f" }}>
              {p.score}
            </div>
            <div className="text-[12px] uppercase tracking-[0.12em] mt-1" style={{ color: FAINT }}>Match</div>
          </div>
        )}
      </header>

      {p.summary && (
        <section className="mb-6">
          <Heading>Summary</Heading>
          <p>{p.summary}</p>
        </section>
      )}

      {(p.strengths.length > 0 || p.concerns.length > 0) && (
        <section className="mb-6 grid sm:grid-cols-2 gap-6 print:grid-cols-2">
          {p.strengths.length > 0 && (
            <div>
              <Heading>Why they fit</Heading>
              <ul className="space-y-1.5 list-disc pl-4">
                {p.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {p.concerns.length > 0 && (
            <div>
              <Heading>Points to explore</Heading>
              <ul className="space-y-1.5 list-disc pl-4">
                {p.concerns.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {p.requirements.length > 0 && (
        <section className="mb-6">
          <Heading>Key requirements</Heading>
          <ul className="space-y-1">
            {p.requirements.map((r, i) => {
              const s = STATUS[r.status] || STATUS.not_met;
              return (
                <li key={i} className="flex gap-2">
                  <span className="font-semibold w-4 shrink-0" style={{ color: s.color }} aria-label={s.label}>{s.mark}</span>
                  <span>{r.requirement}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {p.skills.length > 0 && (
        <section className="mb-6">
          <Heading>Skills</Heading>
          <p>{p.skills.join(" · ")}</p>
        </section>
      )}

      {p.positions.length > 0 && (
        <section className="mb-6">
          <Heading>Experience</Heading>
          <ul className="space-y-1.5">
            {p.positions.map((pos, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span>
                  <span className="font-semibold">{pos.title}</span>
                  {pos.employer && <span style={{ color: MUTED }}> · {pos.employer}</span>}
                </span>
                {pos.dates && <span className="shrink-0 tabular-nums" style={{ color: FAINT }}>{pos.dates}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(p.education.length > 0 || p.certifications.length > 0) && (
        <section className="mb-6 grid sm:grid-cols-2 gap-6 print:grid-cols-2">
          {p.education.length > 0 && (
            <div>
              <Heading>Education</Heading>
              <ul className="space-y-1">
                {p.education.map((e, i) => (
                  <li key={i}>
                    {e.qualification}
                    {e.institution && <span style={{ color: MUTED }}> · {e.institution}</span>}
                    {e.dates && <span style={{ color: FAINT }}> ({e.dates})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.certifications.length > 0 && (
            <div>
              <Heading>Certifications</Heading>
              <ul className="space-y-1">
                {p.certifications.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="pt-4 mt-2 text-[12px] flex flex-wrap justify-between gap-2" style={{ borderTop: `1px solid ${RULE}`, color: FAINT }}>
        <span>
          Presented by {agencyName}
          {preparedBy ? ` · ${preparedBy}` : ""}
          {preparedByEmail ? ` · ${preparedByEmail}` : ""}
        </span>
        <span>{p.blind ? "Anonymised profile · " : ""}Please contact us, not the candidate, about this profile.</span>
      </footer>
    </article>
  );
}
