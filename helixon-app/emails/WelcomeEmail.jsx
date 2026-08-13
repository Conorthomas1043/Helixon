import { Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text, Row, Column } from "@react-email/components";

const COLORS = {
  forest: "#0b6e4f",
  forestDeep: "#08533c",
  mint: "#e8f3ee",
  gold: "#c08a2d",
  signal: "#ff6b4a",
  ink: "#13201b",
  inkSoft: "#5a7a6a",
  inkFaint: "#8aaa9a",
  inkMute: "#b0c4ba",
  mist: "#f3f6f4",
  border: "#e3e8e5",
};
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const LOGO_URL = `${process.env.NEXT_PUBLIC_SITE_URL || "https://helixon.co.uk"}/logo-mark.png`;

// Small reusable "step" row for the "how it works" mini-recap —
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

export default function WelcomeEmail({ email = "there", analyseUrl }) {
  const firstName = email && email.includes("@") ? "" : email;

  return (
    <Html>
      <Head />
      <Preview>You're verified — your 3 free CV analyses are ready to use.</Preview>
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
          {/* ── Logo ── */}
          <Section style={{ padding: "32px 32px 0" }}>
            <Row>
              <Column>
                <table role="presentation" cellPadding="0" cellSpacing="0">
                  <tr>
                    <td style={{ verticalAlign: "middle" }}>
                      <Img
                        src={LOGO_URL}
                        width="32"
                        height="32"
                        alt="Helixon"
                        style={{ borderRadius: "9px", display: "block" }}
                      />
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
            {/* ── Eyebrow — green "success" tone since this fires right
                after verification succeeds, not before it like VerifyEmail. ── */}
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
              Your first analysis is 30 seconds away
            </Heading>
            <Text style={{ fontSize: "14px", lineHeight: 1.6, color: COLORS.inkSoft, margin: "0 0 24px" }}>
              You've got <strong style={{ color: COLORS.ink }}>3 free analyses</strong> to try. No card, no
              catch — just drop in a CV and a job spec and see your first score.
            </Text>

            {/* ── Primary CTA — same forest button as VerifyEmail, keeps
                the two emails visually part of one sequence. ── */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginBottom: "28px" }}>
              <tr>
                <td style={{ backgroundColor: COLORS.forest, borderRadius: "12px", boxShadow: "0 12px 24px -10px rgba(11,58,42,0.5)" }}>
                  <Link
                    href={analyseUrl}
                    style={{ display: "inline-block", padding: "13px 24px", fontSize: "14px", fontWeight: 600, color: "#ffffff", textDecoration: "none" }}
                  >
                    Run your first analysis →
                  </Link>
                </td>
              </tr>
            </table>

            {/* ── Mini "how it works" recap — mirrors the landing page's
                3-step section, so the email reinforces something they've
                already half-seen rather than introducing new UI cold. ── */}
            <Text style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.inkFaint, margin: "0 0 14px" }}>
              How it works
            </Text>
            <StepRow number="1" title="Name & pick the job" body="Name the analysis, then pick a preset role or paste your own job description." />
            <StepRow number="2" title="Upload the CV" body="Drag in a PDF or Word file — no formatting required." />
            <StepRow number="3" title="Get your score" body="Match score, red flags, and a ready-to-send email, all in one screen." />
          </Section>

          {/* ── Retention nudge — sets expectation for what happens after
              the 3 free analyses run out, framed as value not a paywall,
              and gives a reason to come back even if they don't convert
              on this first visit. ── */}
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
                    <strong style={{ color: COLORS.ink }}>Screening a stack of CVs this week?</strong>{" "}
                    Individual and Agency plans unlock unlimited analyses, bulk upload, and shortlist
                    history — most agencies break even after one placement.
                  </Text>
                </td>
              </tr>
            </table>
          </Section>

          <Section style={{ padding: "20px 32px 28px", borderTop: `1px solid ${COLORS.border}` }}>
            <Text style={{ fontSize: "11px", color: COLORS.inkFaint, lineHeight: 1.6, margin: 0 }}>
              Helixon · Screen candidates in seconds · GDPR-ready, EU-hosted
              <br />
              Questions? Just reply to this email — a real person reads these.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}