// The email that carries a feedback-request link
// (app/api/candidates/[id]/feedback-requests): to the candidate for their
// experience rating, or to the client contact for their view of the
// candidate. Plain text, from the agency, replies to the recruiter.

export function feedbackRequestEmail({ kind, url, agencyName, recruiterName, candidateName, jobTitle }) {
  const signOff = [recruiterName, agencyName].filter(Boolean).join("\n");
  if (kind === "candidate_nps") {
    return {
      subject: `How was your experience with ${agencyName}?`,
      text: [
        "Hi,",
        "",
        `Thanks for working with us${jobTitle ? ` on the ${jobTitle} role` : ""}. Could you spare a minute to tell us how we did? It's one question and an optional comment - no account needed.`,
        "",
        url,
        "",
        "Thank you,",
        signOff,
      ].join("\n"),
    };
  }
  return {
    subject: `Quick feedback on ${candidateName}${jobTitle ? ` for ${jobTitle}` : ""}`,
    text: [
      "Hi,",
      "",
      `Could you give us a quick rating of ${candidateName}${jobTitle ? ` for the ${jobTitle} role` : ""}? It takes under a minute and helps us send you better candidates - no account needed.`,
      "",
      url,
      "",
      "Thank you,",
      signOff,
    ].join("\n"),
  };
}
