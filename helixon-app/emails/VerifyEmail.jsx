import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text, Row, Column } from "@react-email/components";

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
// Fraunces isn't reliably available in email clients, so this falls back
// to Georgia — same fallback chain used for --font-display on the landing
// page when the webfont fails to load.
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export default function VerifyEmail({ email = "there", verifyUrl }) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your email to start your free Helixon trial.</Preview>
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
          {/* ── Logo — matches the nav mark on the landing page: two
              overlapping bars in white, plus a signal-colored dot,
              on a forest-green rounded square. ── */}
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
            {/* ── Eyebrow badge — same mint pill / forest text pattern as
                the "GDPR-ready · Data held in the EU" badge in the hero. ── */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginBottom: "18px" }}>
              <tr>
                <td style={{ backgroundColor: COLORS.mint, borderRadius: "999px", padding: "6px 14px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: COLORS.forest }}>
                    Verify your email
                  </span>
                </td>
              </tr>
            </table>

            <Heading style={{ fontFamily: FONT_DISPLAY, fontSize: "26px", fontWeight: 600, lineHeight: 1.15, color: COLORS.ink, margin: "0 0 12px" }}>
              Confirm your email
            </Heading>
            <Text style={{ fontSize: "14px", lineHeight: 1.6, color: COLORS.inkSoft, margin: "0 0 24px" }}>
              One more step — click below to confirm <strong style={{ color: COLORS.ink }}>{email}</strong> and unlock your 3 free
              CV analyses. This link expires in 24 hours.
            </Text>

            {/* ── Primary CTA — same forest bg + raised shadow as
                .btn-forest on the landing page. ── */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ marginBottom: "20px" }}>
              <tr>
                <td style={{ backgroundColor: COLORS.forest, borderRadius: "12px", boxShadow: "0 12px 24px -10px rgba(11,58,42,0.5)" }}>
                  <Link
                    href={verifyUrl}
                    style={{ display: "inline-block", padding: "13px 24px", fontSize: "14px", fontWeight: 600, color: "#ffffff", textDecoration: "none" }}
                  >
                    Confirm email &amp; start scanning →
                  </Link>
                </td>
              </tr>
            </table>

            <Text style={{ fontSize: "12px", lineHeight: 1.6, color: COLORS.inkFaint, margin: "0 0 28px" }}>
              Or paste this link into your browser:
              <br />
              <Link href={verifyUrl} style={{ color: COLORS.forest, wordBreak: "break-all" }}>{verifyUrl}</Link>
            </Text>
          </Section>

          <Section style={{ padding: "20px 32px 28px", borderTop: `1px solid ${COLORS.border}` }}>
            <Text style={{ fontSize: "11px", color: COLORS.inkFaint, lineHeight: 1.6, margin: 0 }}>
              Helixon · Screen candidates in seconds · GDPR-ready, EU-hosted
              <br />
              Didn&apos;t request this? You can safely ignore this email — your address won&apos;t be added to anything.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}