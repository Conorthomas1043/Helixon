import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text, Row, Column } from "@react-email/components";

const COLORS = {
  forest: "#0b6e4f",
  forestDeep: "#08533c",
  mint: "#e8f3ee",
  gold: "#c08a2d",
  signal: "#ff6b4a",
  ink: "#13201b",
  inkSoft: "#4a6658",
  inkFaint: "#587364",
  inkMute: "#b0c4ba",
  mist: "#f3f6f4",
  border: "#e3e8e5",
};
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Small reusable "step" row for the "how it works" mini-recap -
// mirrors the numbered 1/2/3 cards in the "How it works" section
// on the landing page, so returning-from-email users recognise it.
function StepRow({ number, title, body }) {
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginBottom: "16px", width: "100%" }}>
      <tr>
        <td style={{ verticalAlign: "top", width: "32px" }}>
          <table role="presentation" cellPadding="0" cellSpacing="0">
            <tr>
              <td
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "7px",
                  backgroundColor: COLORS.mint,
                  textAlign: "center",
                  verticalAlign: "middle",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: COLORS.forest }}>{number}</span>
              </td>
            </tr>
          </table>
        </td>
        <td style={{ verticalAlign: "top", paddingLeft: "12px" }}>
          <Text style={{ fontSize: "13.5px", fontWeight: 600, color: COLORS.ink, margin: "0 0 2px" }}>{title}</Text>
          <Text style={{ fontSize: "12.5px", lineHeight: 1.55, color: COLORS.inkSoft, margin: 0 }}>{body}</Text>
        </td>
      </tr>
    </table>
  );
}

export default function WelcomeEmail({ firstName, planLabel, isAgency = false, analyseUrl, teamUrl, importUrl }) {
  return (
    <Html>
      <Head />
      <Preview>Your Helixon workspace is ready. Here&apos;s the quickest way to your first shortlist.</Preview>
      <Body style={{ backgroundColor: COLORS.mist, margin: 0, padding: "32px 0", fontFamily: FONT_BODY }}>
        <Container
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: `1px solid ${COLORS.border}`,
            overflow: "hidden",
          }}
        >
          {/* ── Logo - same nested-table mark as VerifyEmail (two bars +
              signal dot on a forest square). Drawn with tables rather
              than an <Img>, so it never depends on an externally-hosted
              asset existing or NEXT_PUBLIC_SITE_URL being set correctly -
              renders identically to VerifyEmail in every client. ── */}
          <Section style={{ padding: "32px 32px 0" }}>
            <Row>
              <Column>
                <table role="presentation" cellPadding="0" cellSpacing="0">
                  <tr>
                    <td style={{ width: "32px", height: "32px", borderRadius: "9px", backgroundColor: COLORS.forest, textAlign: "center", verticalAlign: "middle" }}>
                      <table role="presentation" cellPadding="0" cellSpacing="0" width="32" height="32">
                        <tr>
                          <td style={{ position: "relative", width: "32px", height: "32px" }}>
                            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ margin: "9px auto 0" }}>
                              <tr>
                                <td style={{ width: "16px", height: "4px", borderRadius: "2px", backgroundColor: "rgba(255,255,255,0.55)" }} />
                              </tr>
                            </table>
                            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ margin: "2px auto 0" }}>
                              <tr>
                                <td style={{ width: "16px", height: "4px", borderRadius: "2px", backgroundColor: "#ffffff" }} />
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style={{ paddingLeft: "10px", verticalAlign: "middle" }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "15px", color: COLORS.ink }}>Helixon</span>
                    </td>
                  </tr>
                </table>
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "24px 32px 0" }}>
            {/* ── Eyebrow - green "success" tone since this fires right
                after the workspace is created. ── */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginBottom: "18px" }}>
              <tr>
                <td style={{ backgroundColor: COLORS.mint, borderRadius: "999px", padding: "6px 14px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: COLORS.forest }}>
                    You&apos;re in
                  </span>
                </td>
              </tr>
            </table>

            <Heading style={{ fontFamily: FONT_DISPLAY, fontSize: "26px", fontWeight: 600, lineHeight: 1.15, color: COLORS.ink, margin: "0 0 12px" }}>
              {firstName ? `${firstName}, your` : "Your"} first shortlist is a few minutes away
            </Heading>
            <Text style={{ fontSize: "14px", lineHeight: 1.6, color: COLORS.inkSoft, margin: "0 0 24px" }}>
              Your <strong style={{ color: COLORS.ink }}>{planLabel || "Helixon"}</strong> plan includes unlimited
              screening. The quickest way to see what it does: take one role you&apos;re working on today and a
              few of the CVs you&apos;ve had for it.
            </Text>

            {/* ── Primary CTA - same forest button as VerifyEmail, keeps
                the two emails visually part of one sequence. ── */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginBottom: "28px" }}>
              <tr>
                <td style={{ backgroundColor: COLORS.forest, borderRadius: "12px", boxShadow: "0 12px 24px -10px rgba(11,58,42,0.5)" }}>
                  <Link
                    href={analyseUrl}
                    style={{ display: "inline-block", padding: "13px 24px", fontSize: "14px", fontWeight: 600, color: "#ffffff", textDecoration: "none" }}
                  >
                    Screen your first CV →
                  </Link>
                </td>
              </tr>
            </table>

            {/* ── Mini "how it works" recap - mirrors the landing page's
                3-step section, so the email reinforces something they've
                already half-seen rather than introducing new UI cold. ── */}
            <Text style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.inkFaint, margin: "0 0 14px" }}>
              How it works
            </Text>
            <StepRow number="1" title="Add the role" body="Pick a preset, paste the advert or upload the job spec." />
            <StepRow number="2" title="Upload the CVs" body="One at a time, or up to 50 at once with bulk upload. PDF or Word." />
            <StepRow number="3" title="Review the ranked shortlist" body="A score for each candidate, the evidence behind it, what to check and a draft email." />
          </Section>

          {/* ── The one next step after the first CV: the team (Agency) or
              existing candidates (Individual). ── */}
          <Section style={{ padding: "4px 32px 28px" }}>
            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              style={{ width: "100%", backgroundColor: COLORS.mist, borderRadius: "12px" }}
            >
              <tr>
                <td style={{ padding: "16px 18px" }}>
                  <Text style={{ fontSize: "12.5px", lineHeight: 1.6, color: COLORS.inkSoft, margin: 0 }}>
                    {isAgency ? (
                      <>
                        <strong style={{ color: COLORS.ink }}>Working as a team?</strong>{" "}
                        Your plan includes up to 5 people. Invite them from{" "}
                        <Link href={teamUrl} style={{ color: COLORS.forest }}>Team</Link> and shortlists, notes and scores are shared.
                      </>
                    ) : (
                      <>
                        <strong style={{ color: COLORS.ink }}>Already have a candidate database?</strong>{" "}
                        <Link href={importUrl} style={{ color: COLORS.forest }}>Import it</Link> from a spreadsheet so every search covers everyone.
                      </>
                    )}
                  </Text>
                </td>
              </tr>
            </table>
          </Section>

          <Section style={{ padding: "20px 32px 28px", borderTop: `1px solid ${COLORS.border}` }}>
            <Text style={{ fontSize: "11px", color: COLORS.inkFaint, lineHeight: 1.6, margin: 0 }}>
              Helixon · AI CV screening for recruitment agencies · GDPR-ready, Swiss-hosted
              <br />
              Questions? Just reply to this email - a real person reads these.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}