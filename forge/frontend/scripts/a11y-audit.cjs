/* WCAG 2.2 AA audit of every FORGE page in light and dark themes (axe-core).
   Usage: start FORGE, then:  node frontend/scripts/a11y-audit.cjs [http://127.0.0.1:8765]
   Needs Playwright (npx playwright install chromium, or a system Chromium) and the axe-core dev dependency.
   The audit browser bypasses FORGE's Content-Security-Policy only to inject axe; the product's policy is unchanged. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8765";
const AXE = fs.readFileSync(path.join(__dirname, "..", "node_modules", "axe-core", "axe.min.js"), "utf8");
const ROUTES = ["home", "pipeline", "learn", "agent-studio", "knowledge-studio", "studio", "datasets", "training", "playground", "modelmap", "lens", "weightlab",
  "trajectories", "knowledge", "evaluation", "robustness", "bench", "compare", "history", "governance", "model", "observatory", "overview", "factory", "guide", "settings"];
(async () => {
  const browser = await chromium.launch();
  let total = 0;
  for (const theme of ["light", "dark"]) {
    const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, bypassCSP: true })).newPage();
    await page.addInitScript((t) => localStorage.setItem("forge.ui.v1", JSON.stringify({ theme: t, mode: "expert" })), theme);
    for (const r of ROUTES) {
      await page.goto(`${BASE}/#/${r}`);
      await page.waitForTimeout(1200);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations);
      for (const x of v) { total += x.nodes.length; console.log(`${theme} ${r}: ${x.id} (${x.impact}) ×${x.nodes.length} — ${x.help}`); }
    }
  }
  console.log(total ? `\n${total} violating elements` : "\nNo WCAG 2.2 AA violations on any page in either theme.");
  await browser.close();
  process.exit(total ? 1 : 0);
})();
