/**
 * Screenshots the avatar builder previews from the dev server.
 *
 * Usage: node scripts/shoot.mjs [outDir] [url]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "/tmp/venthit-shots";
const URL = process.argv[3] || "http://localhost:5174/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--window-size=1400,1000",
  ],
  defaultViewport: { width: 1400, height: 1000, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`);
});

await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2200));

await page.evaluate(() => document.querySelector("#btn-start").click());
await new Promise((r) => setTimeout(r, 1600));

const info = await page.evaluate(() => {
  const out = {};
  for (const which of ["you", "foe"]) {
    const f = document.querySelector(`#form-${which}`);
    const colors = {};
    f.querySelectorAll("input").forEach((i) => (colors[i.name] = i.value));
    const chips = {};
    f.querySelectorAll(".chip-row[data-field]").forEach((r) => {
      chips[r.dataset.field] = [...r.querySelectorAll(".chip")]
        .filter((c) => c.classList.contains("on"))
        .map((c) => c.dataset.v);
    });
    const host = document.querySelector(`#char-${which}-preview`);
    out[which] = {
      colors,
      chips,
      hostClass: host?.className,
      hasCanvas: !!host?.querySelector("canvas"),
    };
  }
  const cv = document.querySelector("#char-you-preview canvas");
  if (cv) {
    const gl = cv.getContext("webgl2") || cv.getContext("webgl");
    out.glRenderer = gl
      ? gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)
      : "no gl";
  }
  return out;
});

console.log(JSON.stringify(info, null, 1));

// Reveal both panels in turn and shoot each preview stage.
for (const which of ["you", "foe"]) {
  await page.evaluate((w) => {
    document.querySelector(`.step[data-go="${w}"]`)?.click();
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.querySelectorAll("form").forEach((f) => (f.scrollTop = 0));
  }, which);
  await new Promise((r) => setTimeout(r, 900));
  for (const [suffix, sel] of [
    ["stage", `#panel-${which} .stage-preview`],
    ["char", `#char-${which}-preview`],
  ]) {
    const el = await page.$(sel);
    if (el) {
      const p = path.join(OUT, `${which}-${suffix}.png`);
      await el.screenshot({ path: p });
      console.log("shot", p);
    }
  }
}

if (logs.length) {
  console.log("\n--- console ---");
  logs.slice(0, 40).forEach((l) => console.log(l));
}

await browser.close();
