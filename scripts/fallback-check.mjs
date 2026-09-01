/**
 * Verifies the builder preview and the arena fighters degrade to the SVG
 * renderer when WebGL is unavailable, that a whole fight still runs, and that
 * three.js is never fetched in that case.
 */
import puppeteer from "puppeteer-core";

const URL = process.argv[2] || "http://localhost:5199/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
  defaultViewport: { width: 1200, height: 900 },
});

const page = await browser.newPage();
const requested = [];
page.on("request", (r) => requested.push(r.url()));

// Break WebGL before any app code runs.
await page.evaluateOnNewDocument(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (String(type).includes("webgl")) return null;
    return orig.call(this, type, ...rest);
  };
  delete window.WebGLRenderingContext;
});

await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1800));
await page.evaluate(() => document.querySelector("#btn-start").click());
await new Promise((r) => setTimeout(r, 1800));

const read = (sel) =>
  page.evaluate((s) => {
    const host = document.querySelector(s);
    return {
      hostClass: host.className,
      hasCanvas: !!host.querySelector("canvas"),
      hasSvg: !!host.querySelector("svg"),
    };
  }, sel);

const preview = await read("#char-you-preview");

// Then run a real fight, since the arena drives moods and weapons through the
// same seam and would throw if the SVG branch were missing.
for (const id of ["#btn-next-foe", "#btn-next-scene", "#btn-arena"]) {
  await page.evaluate((s) => document.querySelector(s)?.click(), id);
  await new Promise((r) => setTimeout(r, 700));
}

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

for (const act of ["punch", "slap", "hammer"]) {
  await page.evaluate((a) => document.querySelector(`.move[data-act="${a}"]`)?.click(), act);
  await new Promise((r) => setTimeout(r, 2000));
}

const you = await read("#char-you");
const foe = await read("#char-foe");
const loadedThree = requested.some((u) => /avatar3d|three/i.test(u));

console.log("preview host class :", preview.hostClass);
console.log("preview svg/canvas :", preview.hasSvg, "/", preview.hasCanvas);
console.log("arena you svg/canvas:", you.hasSvg, "/", you.hasCanvas);
console.log("arena foe svg/canvas:", foe.hasSvg, "/", foe.hasCanvas);
console.log("page errors        :", errors.length ? errors : "none");
console.log("fetched 3d chunk   :", loadedThree);

const svgOnly = (r) => r.hasSvg && !r.hasCanvas && !r.hostClass.includes("is-3d");
const ok =
  svgOnly(preview) && svgOnly(you) && svgOnly(foe) && !loadedThree && errors.length === 0;
console.log(ok ? "\nPASS: fell back to SVG without downloading three.js" : "\nFAIL");
process.exitCode = ok ? 0 : 1;

await browser.close();
