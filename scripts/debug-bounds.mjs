/**
 * Outlines each fighter's element so the figure's position inside its canvas
 * can be compared against the element box.
 *
 * Usage: node scripts/debug-bounds.mjs [outDir] [url]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "/tmp/venthit-bounds";
const URL = process.argv[3] || "http://localhost:5199/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle"],
  defaultViewport: { width: 1400, height: 1000, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__frozen = false;
  window.__frozenAt = 0;
  window.requestAnimationFrame = (cb) => raf((t) => cb(window.__frozen ? window.__frozenAt : t));
  window.__freeze = () => {
    window.__frozenAt = performance.now();
    window.__frozen = true;
    document.getAnimations().forEach((a) => a.pause());
    const f = document.querySelector("#flash");
    if (f) f.style.visibility = "hidden";
  };
});

await page.goto(URL, { waitUntil: "networkidle2" });
await sleep(1500);
for (const id of ["#btn-start", "#btn-next-foe", "#btn-next-scene", "#btn-arena"]) {
  await page.evaluate((s) => document.querySelector(s)?.click(), id);
  await sleep(700);
}
await sleep(2000);

await page.evaluate(() => {
  const s = document.createElement("style");
  s.textContent = `
    #char-you { outline: 2px solid #00ff00 !important; }
    #char-foe { outline: 2px solid #ff00ff !important; }
    #fighter-you { outline: 2px dashed #ffff00 !important; }
    #fighter-foe { outline: 2px dashed #00ffff !important; }`;
  document.head.appendChild(s);
});

await page.evaluate(() => document.querySelector('.move[data-act="punch"]').click());
await sleep(600);
await page.evaluate(() => window.__freeze());

const info = await page.evaluate(() => {
  const r = (s) => {
    const b = document.querySelector(s).getBoundingClientRect();
    return { left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) };
  };
  return { fy: r("#fighter-you"), ff: r("#fighter-foe"), cy: r("#char-you"), cf: r("#char-foe") };
});
console.log(JSON.stringify(info));

const clip = {
  x: Math.max(0, info.cy.left - 60),
  y: 200,
  width: info.cf.right - info.cy.left + 120,
  height: 600,
};
await page.screenshot({ path: path.join(OUT, "bounds.png"), clip, captureBeyondViewport: false });
console.log("shot bounds.png");

await browser.close();
