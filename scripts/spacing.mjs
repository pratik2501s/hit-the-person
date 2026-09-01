/**
 * Calibrates how far the attacker should close in before striking.
 *
 * Freezes a punch at its contact frame, then nudges the attacker through a
 * range of overlaps and shoots each one, so the right value can be read off
 * instead of guessed.
 *
 * Usage: node scripts/spacing.mjs [outDir] [url]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "/tmp/venthit-spacing";
const URL = process.argv[3] || "http://localhost:5199/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Fractions of the fighter's element width to overlap.
const FACTORS = [0.65, 0.5, 0.38, 0.28, 0.18];

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

const clip = await page.evaluate(() => {
  const f = document.querySelector("#fighter-foe").getBoundingClientRect();
  const w = document.querySelector("#fighter-you").getBoundingClientRect().width;
  return {
    x: Math.round(f.left - w - 40),
    y: Math.round(f.top - 120),
    width: Math.round(w + f.width + 80),
    height: Math.round(f.height + 180),
  };
});

// Each factor gets its own punch: the pose only holds while frozen, and the
// game keeps running underneath, so one frozen frame cannot serve them all.
for (const factor of FACTORS) {
  await page.evaluate(() => document.querySelector('.move[data-act="punch"]').click());
  await sleep(540);
  await page.evaluate((k) => {
    const you = document.querySelector("#fighter-you");
    const foe = document.querySelector("#fighter-foe");
    you.style.transition = "none";
    you.style.transform = "none";
    const y = you.getBoundingClientRect();
    const f = foe.getBoundingClientRect();
    you.style.transform = `translateX(${f.left - y.right + Math.round(y.width * k)}px)`;
  }, factor);
  await sleep(60);
  await page.evaluate(() => window.__freeze());

  const file = `overlap-${String(factor).replace(".", "_")}.png`;
  await page.screenshot({ path: path.join(OUT, file), clip, captureBeyondViewport: false });
  console.log("shot", file);

  await page.evaluate(() => {
    window.__frozen = false;
    document.getAnimations().forEach((a) => a.play());
    const f = document.querySelector("#flash");
    if (f) f.style.visibility = "";
    const you = document.querySelector("#fighter-you");
    you.style.transition = "";
    you.style.transform = "";
  });
  await sleep(2000);
}

await browser.close();
