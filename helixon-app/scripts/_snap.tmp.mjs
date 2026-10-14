import { chromium } from "@playwright/test";
const [,, S, ...specs] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
for (const spec of specs) {
  const [vp, p, wait = "1500", full = ""] = spec.split("|");
  const size = vp === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100" + p, { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(Number(wait));
  const info = await page.evaluate(() => {
    const el = document.querySelector(".text-13");
    return { title: document.title, h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 60)), text13: el ? getComputedStyle(el).fontSize : null, lang: document.documentElement.lang, sw: document.documentElement.scrollWidth };
  });
  const name = `${vp}${p.replace(/[\/?=&]/g, "_")}`;
  await page.screenshot({ path: `${S}/${name}.png`, fullPage: full === "full" });
  console.log(name, JSON.stringify(info));
  await ctx.close();
}
await browser.close();
