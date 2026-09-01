/**
 * Captures the avatar preview across builder option combinations so every chip
 * can be eyeballed at once.
 *
 * Usage: node scripts/variants.mjs [outDir] [url]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "/tmp/venthit-variants";
const URL = process.argv[3] || "http://localhost:5199/";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

fs.mkdirSync(OUT, { recursive: true });

const VARIANTS = [
  { label: "hair-short", chips: { hairStyle: "short" } },
  { label: "hair-messy", chips: { hairStyle: "messy" } },
  { label: "hair-long", chips: { hairStyle: "long" } },
  { label: "hair-buzz", chips: { hairStyle: "buzz" } },
  { label: "hair-bun", chips: { hairStyle: "bun" } },
  { label: "acc-glasses", chips: { accessory: "glasses" } },
  { label: "acc-hat", chips: { accessory: "hat" } },
  { label: "acc-headphones", chips: { accessory: "headphones" } },
  { label: "body-slim", chips: { body: "slim" } },
  { label: "body-stocky", chips: { body: "stocky" } },
  { label: "face-soft", chips: { face: "soft" } },
  { label: "face-square", chips: { face: "square" } },
  { label: "shoes-boots", chips: { shoes: "boots" } },
  { label: "shoes-slippers", chips: { shoes: "slippers" } },
  { label: "expr-smirk", chips: { expression: "smirk" } },
  { label: "expr-frown", chips: { expression: "frown" } },
  { label: "expr-wink", chips: { expression: "wink" } },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle"],
  defaultViewport: { width: 1400, height: 1000, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate(() => document.querySelector("#btn-start").click());
await new Promise((r) => setTimeout(r, 1400));

const RESET = {
  hairStyle: "short",
  body: "avg",
  face: "round",
  expression: "calm",
  accessory: "none",
  shoes: "sneakers",
};

for (const v of VARIANTS) {
  await page.evaluate(
    (chips) => {
      const form = document.querySelector("#form-you");
      for (const [field, val] of Object.entries(chips)) {
        const row = form.querySelector(`.chip-row[data-field="${field}"]`);
        const chip = row?.querySelector(`.chip[data-v="${val}"]`);
        chip?.click();
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
    },
    { ...RESET, ...v.chips },
  );
  await new Promise((r) => setTimeout(r, 700));
  const el = await page.$("#char-you-preview");
  await el.screenshot({ path: path.join(OUT, `${v.label}.png`) });
  console.log("shot", v.label);
}

if (errors.length) {
  console.log("\n--- page errors ---");
  errors.forEach((e) => console.log(e));
} else {
  console.log("\nno page errors");
}

await browser.close();
