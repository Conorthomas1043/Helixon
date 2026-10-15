import axe from "axe-core";
import { expect, test } from "./fixtures";
import { apiFixture } from "./data/api.js";

// The signed-in screens, rendered from /ui-gallery/screens/[screen] with
// fixture API answers (e2e/data/api.js), at desktop and phone width. Each
// must fit the viewport without sideways scrolling and pass an axe scan
// (WCAG 2.2 AA); a full-page screenshot is attached to the report so a
// change can be checked by eye. Runs in the screens-* projects, against a
// second server with UI_GALLERY=1 (playwright.config.mjs).

const SCREENS = ["overview", "candidates", "candidate", "jobs", "pipeline", "screen", "clients", "talent-pool", "interviews", "placements", "settings"];

for (const screen of SCREENS) {
  test(`signed-in screen: ${screen}`, async ({ page, baseURL }, testInfo) => {
    const unanswered = new Set();
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      const answer = apiFixture(route.request().method(), url.pathname);
      if (!answer) unanswered.add(`${route.request().method()} ${url.pathname}`);
      return route.fulfill({ status: answer?.status ?? 404, contentType: "application/json", body: JSON.stringify(answer?.body ?? { error: "No fixture." }) });
    });

    // The cookie choice made, so the banner doesn't cover the screen.
    await page.context().addCookies([{ name: "helixon_cookie_consent", value: "essential-only", url: baseURL }]);
    await page.goto(`/ui-gallery/screens/${screen}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main").first()).toBeVisible();
    // Loaded: no skeleton is still marked busy.
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    // Let entrance animations finish before measuring and scanning.
    await page.waitForTimeout(800);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);

    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] });
      return result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 120)}`);
    });
    expect(violations, "accessibility violations").toEqual([]);

    await testInfo.attach(`${screen}-${testInfo.project.name}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    expect([...unanswered], "API calls without a fixture").toEqual([]);
  });
}
