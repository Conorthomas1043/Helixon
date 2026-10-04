import { expect, test, watchCsp } from "./fixtures";

test.describe("public site", () => {
  test("homepage renders and becomes interactive", async ({ page }) => {
    const csp = watchCsp(page);
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    // Interactive once hydrated: an FAQ question opens.
    const question = page.locator("button[aria-expanded]:visible").first();
    const before = await question.getAttribute("aria-expanded");
    await question.click();
    await expect(question).not.toHaveAttribute("aria-expanded", before);
    expect(csp).toEqual([]);
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveTitle(/Pricing/);
  });
});

test.describe("security", () => {
  test("every script carries this request's nonce and injected handlers don't run", async ({ page }) => {
    const response = await page.goto("/pricing");
    const policy = response.headers()["content-security-policy"] || "";
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    const scriptSrc = policy.split("; ").find((d) => d.startsWith("script-src ")) || "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    await page.waitForLoadState("networkidle");
    // Scripts added later by an already-trusted script (Vercel analytics) are
    // allowed by 'strict-dynamic' and need no nonce of their own.
    const offenders = await page.evaluate(
      (expected) =>
        [...document.querySelectorAll("script:not([type]), script[type='text/javascript'], script[type='module']")]
          .filter((s) => !s.src.includes("/_vercel/") && s.nonce !== expected)
          .map((s) => s.src || `inline: ${s.textContent.slice(0, 80)}`),
      nonce
    );
    expect(offenders).toEqual([]);
    const ran = await page.evaluate(
      () =>
        new Promise((resolve) => {
          window.__pwned = false;
          const d = document.createElement("div");
          d.innerHTML = '<img src="x" data-id="e2e-injected" onerror="window.__pwned=true">';
          document.body.appendChild(d);
          setTimeout(() => resolve(window.__pwned), 400);
        })
    );
    expect(ran).toBe(false);
  });

  test("signed-out visitors are sent to log in from the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("customer API refuses signed-out requests with JSON", async ({ request }) => {
    const res = await request.get("/api/clients");
    expect(res.status()).toBe(401);
    expect(await res.json()).toHaveProperty("error");
  });

  test("the UI gallery isn't public", async ({ request }) => {
    expect((await request.get("/ui-gallery")).status()).toBe(404);
  });
});

test.describe("private links", () => {
  test("an unknown shortlist link explains itself instead of breaking", async ({ page }) => {
    await page.goto("/share/not-a-real-token");
    await expect(page.locator("body")).toContainText(/isn.t available|not found|expired|couldn.t/i);
  });
});
