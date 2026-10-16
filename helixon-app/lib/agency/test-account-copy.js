// The banner a test account sees on signed-in pages (components/DashboardNav).
// Just the account type and when access ends.

export function testAccountBannerText(endsAt) {
  if (!endsAt) return "Test account";
  const date = new Date(endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
  return `Test account · access until ${date}`;
}
