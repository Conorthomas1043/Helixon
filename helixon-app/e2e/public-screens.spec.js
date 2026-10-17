import axe from "axe-core";
import { expect, test } from "./fixtures";

// The public pages, in the same screens-* projects as screens.spec.js: at
// desktop and phone width, in light and dark. Each must fit the viewport
// without sideways scrolling and pass an axe scan (WCAG 2.2 AA), and a
// full-page screenshot is attached to the report.

const PAGES = ["/", "/pricing", "/how-it-works", "/about", "/faq", "/contact", "/demo", "/careers", "/blog", "/updates", "/privacy", "/terms", "/dpa", "/login", "/signup"];

for (const path of PAGES) {
  test(`public page: ${path}`, async ({ page, baseURL }, testInfo) => {
    await page.context().addCookies([{ name: "helixon_cookie_consent", value: "essential-only", url: baseURL }]);
    // Scan the settled page, not whichever frame of the homepage's hero or
    // scroll story happens to be on screen: with reduced motion they render
    // finished.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main").first()).toBeVisible();
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

    await testInfo.attach(`${path}-${testInfo.project.name}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
}
