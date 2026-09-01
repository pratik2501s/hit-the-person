import type {
  Accessory,
  CharData,
  Expression,
  FaceShape,
  Mood,
  ShoeStyle,
} from "./types";

function shade(hex: string, amt: number): string {
  const n = hex.replace("#", "");
  const full =
    n.length === 3
      ? n
          .split("")
          .map((c) => c + c)
          .join("")
      : n;
  const num = parseInt(full, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function defsBlock(
  id: string,
  skin: string,
  skinD: string,
  skinL: string,
  hair: string,
  hairL: string,
  shirt: string,
  shirtD: string,
  shirtL: string,
  pants: string,
  pantsL: string,
): string {
  return `<defs>
  <radialGradient id="skin-${id}" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="${skinL}"/>
    <stop offset="55%" stop-color="${skin}"/>
    <stop offset="100%" stop-color="${skinD}"/>
  </radialGradient>
  <linearGradient id="skin-arm-${id}" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="${skinD}"/>
    <stop offset="35%" stop-color="${skinL}"/>
    <stop offset="100%" stop-color="${skinD}"/>
  </linearGradient>
  <linearGradient id="shirt-${id}" x1="20%" y1="0%" x2="90%" y2="100%">
    <stop offset="0%" stop-color="${shirtL}"/>
    <stop offset="45%" stop-color="${shirt}"/>
    <stop offset="100%" stop-color="${shirtD}"/>
  </linearGradient>
  <linearGradient id="pants-${id}" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="${shade(pants, -20)}"/>
    <stop offset="40%" stop-color="${pantsL}"/>
    <stop offset="100%" stop-color="${shade(pants, -30)}"/>
  </linearGradient>
  <radialGradient id="hair-${id}" cx="40%" cy="25%" r="75%">
    <stop offset="0%" stop-color="${hairL}"/>
    <stop offset="55%" stop-color="${hair}"/>
    <stop offset="100%" stop-color="${shade(hair, -25)}"/>
  </radialGradient>
  <filter id="soft-${id}" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="0.6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <radialGradient id="cheek-${id}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#e07a6a" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#e07a6a" stop-opacity="0"/>
  </radialGradient>
</defs>`;
}

function hairSvg(style: string, id: string, underHat: boolean): string {
  const f = `fill="url(#hair-${id})" stroke="none"`;
  const hi = `fill="#ffffff" opacity="0.14" stroke="none"`;
  if (underHat) {
    return `<path d="M34 44 C38 32, 50 28, 62 28 C74 28, 86 32, 90 44 C82 38, 72 36, 62 36 C52 36, 42 38, 34 44 Z" ${f}/>`;
  }
  if (style === "buzz") {
    return `<path d="M28 50 C28 30, 42 22, 62 22 C82 22, 96 30, 96 50 C90 38, 78 34, 62 34 C46 34, 34 38, 28 50 Z" ${f}/>
      <ellipse cx="52" cy="28" rx="10" ry="4" ${hi}/>`;
  }
  if (style === "messy") {
    return `<path d="M26 44 L30 16 L40 34 L48 10 L58 32 L66 8 L76 30 L88 12 L98 40 C92 28, 70 24, 50 26 C38 28, 30 36, 26 44 Z" ${f}/>
      <path d="M48 18 L52 28 L56 16" ${hi}/>`;
  }
  if (style === "long") {
    return `<path d="M24 40 C26 16, 50 10, 74 14 C96 18, 102 40, 100 52 L104 95 C100 88, 96 70, 94 55 C90 38, 78 30, 62 28 C46 26, 32 34, 28 48 L22 92 C22 80, 22 55, 24 40 Z" ${f}/>
      <path d="M44 30 Q50 22 58 28" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="3"/>`;
  }
  if (style === "bun") {
    return `<path d="M30 42 C32 22, 52 16, 74 20 C92 24, 98 40, 96 50 C88 36, 72 30, 58 30 C44 30, 34 36, 30 42 Z" ${f}/>
      <circle cx="62" cy="14" r="12" ${f}/>
      <ellipse cx="58" cy="10" rx="5" ry="3" ${hi}/>`;
  }
  return `<path d="M28 40 C28 20, 48 14, 62 14 C76 14, 96 20, 96 42 C90 32, 78 28, 62 28 C46 28, 34 32, 28 40 Z" ${f}/>
    <ellipse cx="50" cy="22" rx="12" ry="5" ${hi}/>`;
}

function faceFeatures(mood: Mood): { brows: string; eyes: string; mouth: string; nose: string } {
  const nose = `<ellipse cx="62" cy="64" rx="3.2" ry="2.4" fill="#000" opacity="0.12"/>`;
  const eyeBall = (cx: number, cy: number, rx: number, ry: number, open = true) => {
    if (!open) {
      return `<path d="M${cx - rx} ${cy} Q${cx} ${cy - 2} ${cx + rx} ${cy}" stroke="#1a1008" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff"/>
      <ellipse cx="${cx}" cy="${cy + 0.5}" rx="${rx * 0.55}" ry="${ry * 0.62}" fill="#2a1810"/>
      <circle cx="${cx + rx * 0.12}" cy="${cy - ry * 0.15}" r="${Math.max(1.4, rx * 0.28)}" fill="#1a1008"/>
      <circle cx="${cx + rx * 0.28}" cy="${cy - ry * 0.35}" r="${Math.max(0.8, rx * 0.16)}" fill="#fff"/>`;
  };

  const moods: Record<Mood, { brows: string; eyes: string; mouth: string }> = {
    smug: {
      brows: `<path d="M40 48 Q48 44 54 48" stroke-width="2.4" fill="none"/><path d="M70 48 Q76 44 84 48" stroke-width="2.4" fill="none"/>`,
      eyes: eyeBall(47, 56, 7, 7.5) + eyeBall(77, 56, 7, 7.5),
      mouth: `<path d="M52 74 Q62 82 72 74" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    },
    annoyed: {
      brows: `<path d="M38 50 L54 46" stroke-width="2.6" fill="none"/><path d="M70 46 L86 50" stroke-width="2.6" fill="none"/>`,
      eyes: eyeBall(47, 56, 6.5, 6.5) + eyeBall(77, 56, 6.5, 6.5),
      mouth: `<path d="M54 75 L70 75" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    },
    angry: {
      brows: `<path d="M38 52 L54 44" stroke-width="3" fill="none"/><path d="M70 44 L86 52" stroke-width="3" fill="none"/>`,
      eyes: eyeBall(47, 56, 7, 6) + eyeBall(77, 56, 7, 6),
      mouth: `<path d="M52 78 Q62 70 72 78" stroke-width="2.4" fill="none"/>`,
    },
    ready: {
      brows: `<path d="M40 48 Q48 46 54 48" stroke-width="2.3" fill="none"/><path d="M70 48 Q76 46 84 48" stroke-width="2.3" fill="none"/>`,
      eyes: eyeBall(47, 56, 7, 8) + eyeBall(77, 56, 7, 8),
      mouth: `<path d="M54 73 Q62 79 70 73" stroke-width="2.3" fill="none"/>`,
    },
    hurt: {
      brows: `<path d="M40 46 Q48 50 54 46" stroke-width="2.4" fill="none"/><path d="M70 46 Q76 50 84 46" stroke-width="2.4" fill="none"/>`,
      eyes: eyeBall(47, 56, 6, 6, false) + eyeBall(77, 56, 6, 6, false),
      mouth: `<ellipse cx="62" cy="76" rx="8" ry="6.5" fill="#4a1010" stroke="none"/>`,
    },
    shocked: {
      brows: `<path d="M40 44 Q48 40 54 44" stroke-width="2.4" fill="none"/><path d="M70 44 Q76 40 84 44" stroke-width="2.4" fill="none"/>`,
      eyes: eyeBall(47, 56, 8.5, 9) + eyeBall(77, 56, 8.5, 9),
      mouth: `<ellipse cx="62" cy="76" rx="6" ry="8" fill="#4a1010" stroke="none"/>`,
    },
    dizzy: {
      brows: `<path d="M40 48 Q48 44 54 50" stroke-width="2.4" fill="none"/><path d="M70 50 Q76 44 84 48" stroke-width="2.4" fill="none"/>`,
      eyes: `<text x="40" y="61" font-size="15" fill="#1a1008" font-weight="700">✕</text><text x="70" y="61" font-size="15" fill="#1a1008" font-weight="700">✕</text>`,
      mouth: `<path d="M52 74 Q58 70 62 74 Q66 78 72 74" stroke-width="2.4" fill="none"/>`,
    },
    scared: {
      brows: `<path d="M40 42 Q48 38 54 44" stroke-width="2.4" fill="none"/><path d="M70 44 Q76 38 84 42" stroke-width="2.4" fill="none"/>`,
      eyes: eyeBall(47, 56, 8, 10) + eyeBall(77, 56, 8, 10),
      mouth: `<ellipse cx="62" cy="78" rx="5" ry="7" fill="#4a1010" stroke="none"/>`,
    },
    crying: {
      brows: `<path d="M40 50 Q48 46 54 50" stroke-width="2.4" fill="none"/><path d="M70 50 Q76 46 84 50" stroke-width="2.4" fill="none"/>`,
      eyes:
        eyeBall(47, 56, 6, 6, false) +
        eyeBall(77, 56, 6, 6, false) +
        `<path d="M47 62 L44 78" stroke="#5b9fff" stroke-width="3" fill="none"/><path d="M77 62 L80 78" stroke="#5b9fff" stroke-width="3" fill="none"/>`,
      mouth: `<path d="M52 78 Q62 70 72 78" stroke-width="2.4" fill="none"/>`,
    },
    laughing: {
      brows: `<path d="M40 48 Q48 44 54 48" stroke-width="2.4" fill="none"/><path d="M70 48 Q76 44 84 48" stroke-width="2.4" fill="none"/>`,
      eyes: eyeBall(47, 56, 6, 6, false) + eyeBall(77, 56, 6, 6, false),
      mouth: `<path d="M48 70 Q62 90 76 70" stroke-width="2.6" fill="#4a1010"/>`,
    },
    nerdy: {
      brows: `<path d="M40 48 Q48 46 54 48" stroke-width="2" fill="none"/><path d="M70 48 Q76 46 84 48" stroke-width="2" fill="none"/>`,
      eyes: eyeBall(47, 56, 6, 6.5) + eyeBall(77, 56, 6, 6.5),
      mouth: `<path d="M56 74 L68 74" stroke-width="2.2" fill="none"/>`,
    },
    fancy: {
      brows: `<path d="M40 48 Q48 44 54 48" stroke-width="2.4" fill="none"/><path d="M70 48 Q76 44 84 48" stroke-width="2.4" fill="none"/>`,
      eyes: eyeBall(47, 56, 7, 7.5) + eyeBall(77, 56, 7, 7.5),
      mouth: `<path d="M54 73 Q62 79 70 73" stroke-width="2.3" fill="none"/>`,
    },
  };
  const m = moods[mood] ?? moods.annoyed;
  return { ...m, nose };
}

function headShape(face: FaceShape, id: string): string {
  const fill = `url(#skin-${id})`;
  if (face === "square") {
    return `<rect x="30" y="24" width="64" height="70" rx="16" fill="${fill}" stroke="none"/>
      <ellipse cx="48" cy="40" rx="14" ry="8" fill="#fff" opacity="0.18"/>`;
  }
  if (face === "soft") {
    return `<ellipse cx="62" cy="58" rx="36" ry="36" fill="${fill}" stroke="none"/>
      <ellipse cx="48" cy="42" rx="14" ry="9" fill="#fff" opacity="0.2"/>`;
  }
  return `<ellipse cx="62" cy="58" rx="34" ry="38" fill="${fill}" stroke="none"/>
    <ellipse cx="48" cy="42" rx="13" ry="9" fill="#fff" opacity="0.22"/>
    <ellipse cx="78" cy="72" rx="10" ry="8" fill="#000" opacity="0.06"/>`;
}

function ears(id: string): string {
  return `<g class="ears">
    <ellipse cx="28" cy="58" rx="7" ry="10" fill="url(#skin-${id})" stroke="none"/>
    <ellipse cx="96" cy="58" rx="7" ry="10" fill="url(#skin-${id})" stroke="none"/>
    <ellipse cx="28" cy="58" rx="3.5" ry="5" fill="#000" opacity="0.08"/>
    <ellipse cx="96" cy="58" rx="3.5" ry="5" fill="#000" opacity="0.08"/>
  </g>`;
}

function shoeSvg(style: ShoeStyle, cx: number): string {
  if (style === "slippers") {
    return `<g stroke="none">
      <ellipse cx="${cx}" cy="207" rx="15" ry="3.5" fill="#000" opacity="0.2"/>
      <path d="M${cx - 14} 196 Q${cx - 15} 208 ${cx} 209 Q${cx + 15} 208 ${cx + 14} 196 Z" fill="#f5a3c7"/>
      <ellipse cx="${cx}" cy="199" rx="7" ry="2.2" fill="#ffd0e3"/>
    </g>`;
  }
  if (style === "boots") {
    return `<g stroke="none">
      <ellipse cx="${cx}" cy="207" rx="14" ry="3.2" fill="#000" opacity="0.22"/>
      <path d="M${cx - 11} 184 L${cx - 12} 208 L${cx + 12} 208 L${cx + 11} 184 Z" fill="#1a1a1a"/>
      <rect x="${cx - 12}" y="200" width="24" height="8" fill="#0d0d0d"/>
      <rect x="${cx - 9}" y="188" width="4" height="10" fill="#fff" opacity="0.08"/>
    </g>`;
  }
  return `<g stroke="none">
    <ellipse cx="${cx}" cy="207" rx="15" ry="3.2" fill="#000" opacity="0.2"/>
    <path d="M${cx - 13} 194 L${cx - 14} 207 L${cx + 14} 207 L${cx + 13} 194 Z" fill="#f5f5f5"/>
    <rect x="${cx - 12}" y="199" width="24" height="4" rx="1" fill="#e11d48"/>
    <rect x="${cx - 13}" y="205" width="26" height="3" rx="1" fill="#ddd"/>
    <ellipse cx="${cx - 4}" cy="197" rx="4" ry="1.5" fill="#fff" opacity="0.5"/>
  </g>`;
}

function accessoryUnderHair(acc: Accessory): string {
  if (acc === "headphones") {
    return `<path d="M34 50 Q34 28 62 24 Q90 28 90 50" fill="none" stroke="#1a1a1a" stroke-width="3.5"/>`;
  }
  return "";
}

function accessoryOver(acc: Accessory): string {
  if (acc === "glasses") {
    return `<g fill="none" stroke="#222" stroke-width="2.2">
      <circle cx="47" cy="56" r="10"/><circle cx="77" cy="56" r="10"/>
      <line x1="57" y1="56" x2="67" y2="56"/>
      <line x1="37" y1="54" x2="28" y2="50"/>
      <line x1="87" y1="54" x2="96" y2="50"/>
      <ellipse cx="44" cy="53" rx="3" ry="2" fill="#fff" opacity="0.35" stroke="none"/>
      <ellipse cx="74" cy="53" rx="3" ry="2" fill="#fff" opacity="0.35" stroke="none"/>
    </g>`;
  }
  if (acc === "hat") {
    return `<g stroke="none">
      <ellipse cx="62" cy="26" rx="40" ry="9" fill="#2a1a12"/>
      <rect x="40" y="2" width="44" height="26" rx="7" fill="#3a2418"/>
      <rect x="40" y="22" width="44" height="5" fill="#c0392b"/>
      <ellipse cx="52" cy="10" rx="10" ry="4" fill="#fff" opacity="0.12"/>
    </g>`;
  }
  if (acc === "headphones") {
    return `<g stroke="none">
      <rect x="22" y="46" width="16" height="26" rx="6" fill="#222"/>
      <rect x="86" y="46" width="16" height="26" rx="6" fill="#222"/>
      <rect x="25" y="50" width="10" height="18" rx="4" fill="#555"/>
      <rect x="89" y="50" width="10" height="18" rx="4" fill="#555"/>
      <ellipse cx="30" cy="54" rx="3" ry="2" fill="#fff" opacity="0.2"/>
    </g>`;
  }
  return "";
}

function vibeAccent(data: CharData): string {
  if (data.vibe === "fancy") {
    return `<rect x="44" y="108" width="36" height="8" rx="1" fill="#111"/><path d="M62 116 L62 145" stroke="#c9a227" stroke-width="3"/>`;
  }
  if (data.vibe === "nerdy") {
    return `<rect x="40" y="118" width="44" height="28" rx="2" fill="#5b7cfa" opacity="0.35"/>`;
  }
  return "";
}

function buildCharSVG(data: CharData, mood: Mood): string {
  const id = uid();
  const skin = data.skin;
  const skinD = shade(skin, -32);
  const skinL = shade(skin, 28);
  const hair = data.hair;
  const hairL = shade(hair, 40);
  const shirt = data.shirt;
  const shirtD = shade(shirt, -40);
  const shirtL = shade(shirt, 35);
  const pants = "#2c3e50";
  const pantsL = shade(pants, 35);
  const face = faceFeatures(mood);
  const bodyScale = data.body === "slim" ? 0.9 : data.body === "stocky" ? 1.12 : 1;
  const torsoW = 38 * bodyScale;
  const shoes = data.shoes || "sneakers";
  const accessory = data.accessory || "none";
  const faceShape = data.face || "round";
  const underHat = accessory === "hat";
  const armStroke = 12;

  return `
<svg class="char-svg-3d" viewBox="0 0 124 220" xmlns="http://www.w3.org/2000/svg">
  ${defsBlock(id, skin, skinD, skinL, hair, hairL, shirt, shirtD, shirtL, pants, pantsL)}
  <ellipse class="foot-shadow" cx="62" cy="214" rx="34" ry="7" fill="rgba(0,0,0,0.38)"/>
  <g class="leg-l">
    <path d="M48 148 L45 194" stroke="url(#pants-${id})" stroke-width="15" stroke-linecap="butt"/>
    ${shoeSvg(shoes, 44)}
  </g>
  <g class="leg-r">
    <path d="M76 148 L79 194" stroke="url(#pants-${id})" stroke-width="15" stroke-linecap="butt"/>
    ${shoeSvg(shoes, 80)}
  </g>
  <g class="torso-g">
    <path d="M${62 - torsoW / 2} 106 Q${62 - torsoW / 2 - 3} 145 ${62 - torsoW / 2 + 5} 154
             L${62 + torsoW / 2 - 5} 154 Q${62 + torsoW / 2 + 3} 145 ${62 + torsoW / 2} 106
             Q62 100 ${62 - torsoW / 2} 106 Z" fill="url(#shirt-${id})"/>
    <path d="M${62 - torsoW / 2 + 6} 112 Q62 108 ${62 + torsoW / 2 - 6} 112
             L${62 + torsoW / 2 - 8} 132 Q62 128 ${62 - torsoW / 2 + 8} 132 Z" fill="#fff" opacity="0.14"/>
    <ellipse cx="${62 - torsoW / 4}" cy="138" rx="6" ry="10" fill="#000" opacity="0.08"/>
    ${vibeAccent(data)}
  </g>
  <g class="arm-l">
    <path d="M${62 - torsoW / 2 + 5} 112 Q28 128 26 158" stroke="url(#skin-arm-${id})" stroke-width="${armStroke}" stroke-linecap="round" fill="none"/>
    <circle cx="26" cy="162" r="9" fill="url(#skin-${id})"/>
    <ellipse cx="24" cy="159" rx="3" ry="2" fill="#fff" opacity="0.25"/>
    <g class="hand-prop" data-hand="l"></g>
  </g>
  <g class="arm-r">
    <path d="M${62 + torsoW / 2 - 5} 112 Q96 128 98 158" stroke="url(#skin-arm-${id})" stroke-width="${armStroke}" stroke-linecap="round" fill="none"/>
    <circle cx="98" cy="162" r="9" fill="url(#skin-${id})"/>
    <ellipse cx="96" cy="159" rx="3" ry="2" fill="#fff" opacity="0.25"/>
    <g class="hand-prop" data-hand="r"></g>
  </g>
  <g class="head-g">
    ${ears(id)}
    ${headShape(faceShape, id)}
    <ellipse cx="48" cy="70" rx="9" ry="6" fill="url(#cheek-${id})" stroke="none"/>
    <ellipse cx="76" cy="70" rx="9" ry="6" fill="url(#cheek-${id})" stroke="none"/>
    ${accessoryUnderHair(accessory)}
    ${hairSvg(data.hairStyle, id, underHat)}
    <g stroke="${hair}" fill="none" stroke-linecap="round">${face.brows}</g>
    <g stroke="none">${face.eyes}</g>
    ${face.nose}
    <g stroke="#5c3a2a" fill="none" stroke-linecap="round">${face.mouth}</g>
    ${accessoryOver(accessory)}
  </g>
</svg>
${OVERLAY_LAYERS}`;
}

/** Irregular face mess — not circles — used when WebGL is unavailable. */
const SPLAT_SVG = {
  mud: `<svg class="splat-svg" viewBox="0 0 100 120" aria-hidden="true">
    <path d="M28 22 C40 8 62 10 70 24 C82 20 88 34 80 46 C90 58 78 74 62 70 C50 86 28 78 26 60 C12 54 16 34 28 22 Z" fill="#5c3a1e"/>
    <path d="M52 48 C64 42 74 54 68 66 C58 78 44 70 46 58 C40 50 46 48 52 48 Z" fill="#3d2410"/>
    <path d="M34 68 Q32 92 36 108" stroke="#4a2e14" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M58 72 Q62 96 56 112" stroke="#5c3a1e" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="72" cy="38" rx="6" ry="4" fill="#6b4423"/>
  </svg>`,
  cream: `<svg class="splat-svg" viewBox="0 0 100 120" aria-hidden="true">
    <path d="M22 18 C48 0 78 6 84 28 C96 34 90 56 74 52 C80 72 58 86 44 70 C24 80 10 52 22 18 Z" fill="#fff4d6"/>
    <path d="M36 28 C52 18 70 30 64 46 C52 58 34 48 36 28 Z" fill="#ffe9b0"/>
    <path d="M40 62 Q38 90 42 108" stroke="#fff4d6" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M62 58 Q68 88 60 110" stroke="#f0d9a0" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M18 40 L8 36 L16 48 Z" fill="#c45c26"/>
    <path d="M78 22 L90 16 L84 30 Z" fill="#e8c98a"/>
  </svg>`,
  tomato: `<svg class="splat-svg" viewBox="0 0 100 120" aria-hidden="true">
    <path d="M30 26 C46 8 72 12 80 32 C94 38 88 62 70 60 C74 80 48 88 38 70 C16 68 16 40 30 26 Z" fill="#c41e1e"/>
    <path d="M48 36 C60 30 70 44 62 54 C50 62 40 50 48 36 Z" fill="#8b1010"/>
    <path d="M44 64 Q42 92 46 110" stroke="#a01818" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M64 66 Q70 94 62 112" stroke="#c41e1e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="36" cy="48" rx="3" ry="2" fill="#f4d6a0"/>
    <ellipse cx="58" cy="42" rx="2.5" ry="2" fill="#f4d6a0"/>
    <ellipse cx="70" cy="52" rx="2" ry="1.6" fill="#f4d6a0"/>
  </svg>`,
  water: `<svg class="splat-svg" viewBox="0 0 100 120" aria-hidden="true">
    <path d="M32 18 Q28 36 34 40 Q40 36 32 18 Z" fill="#5ee7ff" opacity="0.75"/>
    <path d="M58 12 Q52 38 60 44 Q68 36 58 12 Z" fill="#7ae7ff" opacity="0.7"/>
    <path d="M44 48 Q40 78 46 86 Q54 76 44 48 Z" fill="#3ec6e8" opacity="0.65"/>
    <path d="M70 42 Q66 72 72 80 Q80 70 70 42 Z" fill="#5ee7ff" opacity="0.7"/>
    <ellipse cx="38" cy="96" rx="7" ry="4" fill="#7ae7ff" opacity="0.5"/>
    <ellipse cx="64" cy="104" rx="6" ry="3.5" fill="#5ee7ff" opacity="0.45"/>
  </svg>`,
};

/** Splats sit on the face. WebGL hosts hide these and use 3D blobs instead. */
export const OVERLAY_LAYERS = `<div class="overlay-splat mud" data-fx="mud">${SPLAT_SVG.mud}</div>
<div class="overlay-splat cream" data-fx="cream">${SPLAT_SVG.cream}</div>
<div class="overlay-splat tomato" data-fx="tomato">${SPLAT_SVG.tomato}</div>
<div class="water-drops" data-fx="water">${SPLAT_SVG.water}</div>
<div class="hurt-marks bruise" data-fx="bruise"></div>
<div class="hurt-marks blood" data-fx="blood"></div>`;

export function expressionToMood(expression: Expression): Mood {
  switch (expression) {
    case "smirk":
      return "smug";
    case "frown":
      return "angry";
    case "wink":
      return "laughing";
    default:
      return "ready";
  }
}

export function renderChar(el: HTMLElement, data: CharData, mood: Mood): void {
  el.dataset.body = data.body || "avg";
  el.dataset.mood = mood;
  el.innerHTML = buildCharSVG(data, mood);
}

export function setMood(el: HTMLElement, data: CharData, mood: Mood): void {
  const overlays = {
    mud: el.querySelector('[data-fx="mud"]')?.classList.contains("on") ?? false,
    cream: el.querySelector('[data-fx="cream"]')?.classList.contains("on") ?? false,
    tomato: el.querySelector('[data-fx="tomato"]')?.classList.contains("on") ?? false,
    water: el.querySelector('[data-fx="water"]')?.classList.contains("on") ?? false,
    bruise: el.querySelector('[data-fx="bruise"]')?.classList.contains("on") ?? false,
    blood: el.querySelector('[data-fx="blood"]')?.classList.contains("on") ?? false,
  };
  const handL = el.querySelector('[data-hand="l"]')?.innerHTML ?? "";
  const handR = el.querySelector('[data-hand="r"]')?.innerHTML ?? "";
  renderChar(el, data, mood);
  (Object.keys(overlays) as Array<keyof typeof overlays>).forEach((k) => {
    if (overlays[k]) el.querySelector(`[data-fx="${k}"]`)?.classList.add("on");
  });
  const l = el.querySelector('[data-hand="l"]');
  const r = el.querySelector('[data-hand="r"]');
  if (l) l.innerHTML = handL;
  if (r) r.innerHTML = handR;
}

export type HandWeapon = "hammer" | "fryingpan" | "slipper" | "foambat" | null;

function weaponSvg(kind: Exclude<HandWeapon, null>, side: "l" | "r"): string {
  const x = side === "r" ? 98 : 26;
  const y = 162;
  const flip =
    side === "l"
      ? `transform="translate(${x}, ${y}) scale(-1,1) translate(${-x}, ${-y})"`
      : "";
  if (kind === "hammer") {
    return `<g class="weapon-hammer" ${flip} stroke="none">
      <rect x="${x - 3}" y="${y - 58}" width="6" height="52" rx="2" fill="#6b4423"/>
      <rect x="${x - 14}" y="${y - 66}" width="28" height="16" rx="3" fill="#4a4a4a"/>
      <rect x="${x - 12}" y="${y - 63}" width="24" height="10" rx="2" fill="#6a6a6a"/>
      <ellipse cx="${x - 6}" cy="${y - 60}" rx="4" ry="2" fill="#fff" opacity="0.2"/>
    </g>`;
  }
  if (kind === "fryingpan") {
    return `<g class="weapon-pan" ${flip} stroke="none">
      <rect x="${x - 3}" y="${y - 38}" width="6" height="34" rx="2" fill="#3a3a3a"/>
      <circle cx="${x}" cy="${y - 48}" r="18" fill="#555"/>
      <circle cx="${x}" cy="${y - 48}" r="13" fill="#2a2a2a"/>
      <circle cx="${x - 4}" cy="${y - 52}" r="3" fill="#777" opacity="0.5"/>
    </g>`;
  }
  if (kind === "slipper") {
    return `<g class="weapon-slipper" ${flip} stroke="none">
      <path d="M${x - 6} ${y - 8} Q${x - 18} ${y - 28} ${x - 4} ${y - 36} Q${x + 14} ${y - 38} ${x + 16} ${y - 20} Q${x + 14} ${y - 6} ${x - 6} ${y - 8} Z" fill="#e11d48"/>
      <ellipse cx="${x + 2}" cy="${y - 22}" rx="7" ry="3" fill="#ff6b8a" opacity="0.55"/>
    </g>`;
  }
  return `<g class="weapon-bat" ${flip} stroke="none">
    <rect x="${x - 4}" y="${y - 70}" width="8" height="62" rx="4" fill="#7dd3fc"/>
    <rect x="${x - 5}" y="${y - 16}" width="10" height="18" rx="3" fill="#0ea5e9"/>
    <circle cx="${x}" cy="${y - 72}" r="9" fill="#38bdf8"/>
  </g>`;
}

export function setHandWeapon(el: HTMLElement, kind: HandWeapon): void {
  const l = el.querySelector('[data-hand="l"]');
  const r = el.querySelector('[data-hand="r"]');
  if (l) l.innerHTML = "";
  if (r) r.innerHTML = "";
  if (!kind) return;
  if (kind === "slipper") {
    if (l) l.innerHTML = weaponSvg(kind, "l");
  } else if (r) {
    r.innerHTML = weaponSvg(kind, "r");
  }
}

export function applyHurtMarks(el: HTMLElement, kind: "bruise" | "blood" | "both"): void {
  // Blood marks disabled for now
  if (kind === "bruise" || kind === "both") {
    el.querySelector('[data-fx="bruise"]')?.classList.add("on");
  }
}

export function foeIdleMood(data: CharData): Mood {
  if (data.expression) return expressionToMood(data.expression);
  return data.vibe === "smug" ? "annoyed" : data.vibe;
}

export function youPreviewMood(data: CharData): Mood {
  return expressionToMood(data.expression || "calm");
}

export function defaultChar(overrides: Partial<CharData> = {}): CharData {
  return {
    name: "Me",
    skin: "#d4a574",
    hair: "#1c1410",
    shirt: "#2dd4a8",
    hairStyle: "short",
    body: "avg",
    vibe: "smug",
    face: "round",
    accessory: "none",
    shoes: "sneakers",
    expression: "calm",
    ...overrides,
  };
}
