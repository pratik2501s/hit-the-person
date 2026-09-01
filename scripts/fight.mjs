/**
 * Walks into the arena, throws a pie, then punches. Screenshots the residue.
 *
 * Usage: node scripts/fight.mjs [outDir] [url]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "/tmp/venthit-fight";
const URL = process.argv[3] || "http://localhost:5173/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle"],
  defaultViewport: { width: 1100, height: 800, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1800));
await page.evaluate(() => document.querySelector("#btn-start")?.click());
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => document.querySelector("#btn-next-foe")?.click());
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => document.querySelector("#btn-next-scene")?.click());
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => document.querySelector("#btn-arena")?.click());
await new Promise((r) => setTimeout(r, 1600));

const shot = async (name) => {
  const el = await page.$("#arena");
  if (el) await el.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("shot", name);
};

await shot("idle");

await page.evaluate(() => document.querySelector('.move[data-act="pie"]')?.click());
await new Promise((r) => setTimeout(r, 2800));
await shot("pie");

await page.evaluate(() => document.querySelector('.move[data-act="tomato"]')?.click());
await new Promise((r) => setTimeout(r, 2800));
await shot("tomato");

await page.evaluate(() => document.querySelector('.move[data-act="punch"]')?.click());
await new Promise((r) => setTimeout(r, 900));
await shot("punch-mid");
await new Promise((r) => setTimeout(r, 1600));
await shot("punch-end");

const info = await page.evaluate(() => {
  const foe = document.querySelector("#char-foe");
  return {
    is3d: foe?.classList.contains("is-3d"),
    splatOn: [...foe.querySelectorAll("[data-fx].on")].map((n) => n.getAttribute("data-fx")),
  };
});
console.log(JSON.stringify(info));
if (errors.length) {
  console.log("errors", errors);
} else {
  console.log("no page errors");
}

await browser.close();
