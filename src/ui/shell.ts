import { CATEGORIES, MEMES, MOVES, SCENES } from "../data";

function chipRow(
  field: string,
  options: Array<{ v: string; label: string }>,
  active: string,
): string {
  return `
    <div class="chip-row" data-field="${field}">
      ${options
        .map(
          (o) =>
            `<button type="button" class="chip${o.v === active ? " on" : ""}" data-v="${o.v}">${o.label}</button>`,
        )
        .join("")}
    </div>`;
}

function lookFields(prefix: "you" | "foe"): string {
  return `
    <label>Face
      ${chipRow(
        "face",
        [
          { v: "round", label: "Round" },
          { v: "soft", label: "Soft" },
          { v: "square", label: "Square" },
        ],
        "round",
      )}
    </label>
    <label>Expression
      ${chipRow(
        "expression",
        [
          { v: "calm", label: "Calm" },
          { v: "smirk", label: "Smirk" },
          { v: "frown", label: "Frown" },
          { v: "wink", label: "Wink" },
        ],
        prefix === "foe" ? "smirk" : "calm",
      )}
    </label>
    <label>Accessory
      ${chipRow(
        "accessory",
        [
          { v: "none", label: "None" },
          { v: "glasses", label: "Glasses" },
          { v: "hat", label: "Hat" },
          { v: "headphones", label: "Headphones" },
        ],
        "none",
      )}
    </label>
    <label>Shoes
      ${chipRow(
        "shoes",
        [
          { v: "sneakers", label: "Sneakers" },
          { v: "boots", label: "Boots" },
          { v: "slippers", label: "Slippers" },
        ],
        "sneakers",
      )}
    </label>`;
}

export function buildAppShell(): string {
  const catChips = CATEGORIES.map(
    (c, i) =>
      `<button type="button" class="chip${i === 0 ? " on" : ""}" data-v="${c.id}">${c.label}</button>`,
  ).join("");

  const memeCards = `
    <button type="button" class="meme-card on" data-meme="none">
      <strong>Custom</strong>
      <span>Build your own</span>
    </button>
    ${MEMES.map(
      (m) => `
      <button type="button" class="meme-card" data-meme="${m.id}">
        <strong>${m.label}</strong>
        <span>${m.blurb}</span>
      </button>`,
    ).join("")}`;

  const sceneCards = SCENES.map(
    (s, i) => `
      <button type="button" class="scene-card${i === 0 ? " on" : ""}" data-scene="${s.id}">
        <span class="scene-thumb scene-thumb-${s.id}" aria-hidden="true"></span>
        <strong>${s.label}</strong>
        <span>${s.blurb}</span>
      </button>`,
  ).join("");

  const moves = MOVES.map(
    (m) => `
      <button class="move" data-act="${m.act}" data-unlock="${m.unlockAt}" type="button">
        <span class="move-ico">${m.ico}</span>
        <span class="move-name">${m.name}</span>
        <span class="move-key">${m.key}</span>
        <span class="move-lock" hidden>Locked</span>
      </button>`,
  ).join("");

  return `
  <div class="grain" aria-hidden="true"></div>
  <div id="flash" aria-hidden="true"></div>
  <div id="fx-layer" aria-hidden="true"></div>

  <section id="screen-landing" class="screen active">
    <canvas id="landing-canvas" aria-hidden="true"></canvas>
    <div class="landing-content">
      <p class="eyebrow">private rage room · nobody gets hurt</p>
      <h1 class="brand">VENTHIT</h1>
      <p class="tagline">Build the person who ruins your day.<br />Then take it out — safely, loudly, cartoonishly.</p>
      <button class="btn btn-fire" id="btn-start">
        <span>Enter the Room</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
      <button class="btn btn-ghost" id="btn-daily" type="button">Daily Rage Challenge</button>
      <p class="fineprint">Fiction only. Real people deserve real conversations.</p>
      <p class="session-pill" id="session-pill"></p>
      <div class="incoming-banner" id="incoming-banner" hidden>
        <p class="incoming-title" id="incoming-title">Challenge loaded</p>
        <p class="incoming-copy" id="incoming-copy"></p>
        <button type="button" class="btn btn-fire btn-sm" id="btn-accept-challenge">Accept challenge</button>
      </div>
    </div>
    <div class="landing-orb" aria-hidden="true"></div>
  </section>

  <section id="screen-setup" class="screen">
    <header class="topbar">
      <div class="logo">VENTHIT</div>
      <div class="steps" role="tablist">
        <button class="step on" data-go="you" type="button"><i>01</i> You</button>
        <button class="step" data-go="foe" type="button"><i>02</i> Target</button>
        <button class="step" data-go="scene" type="button"><i>03</i> Scene</button>
      </div>
    </header>

    <div class="setup-wrap">
      <div class="panel on" id="panel-you">
        <div class="panel-copy">
          <h2>Create your avatar</h2>
          <p>Shape the face, light, and fit — preview updates live.</p>
        </div>
        <div class="builder">
          <div class="stage-preview">
            <div class="spot"></div>
            <div class="char" id="char-you-preview" data-mood="smug"></div>
          </div>
          <form class="form" id="form-you" autocomplete="off">
            <label>Your name
              <input type="text" name="name" maxlength="18" value="Me" />
            </label>
            <div class="row-3">
              <label>Skin<input type="color" name="skin" value="#d4a574" /></label>
              <label>Hair<input type="color" name="hair" value="#1c1410" /></label>
              <label>Outfit<input type="color" name="shirt" value="#2dd4a8" /></label>
            </div>
            <label>Hair style
              ${chipRow(
                "hairStyle",
                [
                  { v: "short", label: "Short" },
                  { v: "messy", label: "Messy" },
                  { v: "long", label: "Long" },
                  { v: "buzz", label: "Buzz" },
                  { v: "bun", label: "Bun" },
                ],
                "short",
              )}
            </label>
            <label>Body
              ${chipRow(
                "body",
                [
                  { v: "avg", label: "Average" },
                  { v: "slim", label: "Slim" },
                  { v: "stocky", label: "Stocky" },
                ],
                "avg",
              )}
            </label>
            ${lookFields("you")}
            <button type="button" class="btn btn-fire" id="btn-next-foe">Next — build your target →</button>
          </form>
        </div>
      </div>

      <div class="panel" id="panel-foe">
        <div class="panel-copy">
          <h2>Who's getting it?</h2>
          <p>Pick a meme or sculpt a target. Private — just you and the screen.</p>
        </div>
        <div class="builder">
          <div class="stage-preview foe-glow">
            <div class="spot red"></div>
            <div class="char" id="char-foe-preview" data-mood="annoyed"></div>
          </div>
          <form class="form" id="form-foe" autocomplete="off">
            <label>Meme mode
              <div class="meme-grid" id="meme-grid">${memeCards}</div>
            </label>
            <label>Category
              <div class="chip-row cat-row" id="cat-row">${catChips}</div>
            </label>
            <label>Their name
              <input type="text" name="name" maxlength="18" value="Boss" placeholder="Boss / Ex / That guy…" />
            </label>
            <div class="row-3">
              <label>Skin<input type="color" name="skin" value="#c9956c" /></label>
              <label>Hair<input type="color" name="hair" value="#111111" /></label>
              <label>Outfit<input type="color" name="shirt" value="#c0392b" /></label>
            </div>
            <label>Hair style
              ${chipRow(
                "hairStyle",
                [
                  { v: "short", label: "Short" },
                  { v: "messy", label: "Messy" },
                  { v: "long", label: "Long" },
                  { v: "buzz", label: "Buzz" },
                  { v: "bun", label: "Bun" },
                ],
                "short",
              )}
            </label>
            <label>Body
              ${chipRow(
                "body",
                [
                  { v: "avg", label: "Average" },
                  { v: "slim", label: "Slim" },
                  { v: "stocky", label: "Stocky" },
                ],
                "avg",
              )}
            </label>
            <label>Vibe
              ${chipRow(
                "vibe",
                [
                  { v: "smug", label: "Smug" },
                  { v: "angry", label: "Angry" },
                  { v: "nerdy", label: "Nerdy" },
                  { v: "fancy", label: "Fancy" },
                ],
                "smug",
              )}
            </label>
            ${lookFields("foe")}
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="btn-back-you">← Back</button>
              <button type="button" class="btn btn-fire" id="btn-next-scene">Next — pick a scene →</button>
            </div>
          </form>
        </div>
      </div>

      <div class="panel" id="panel-scene">
        <div class="panel-copy">
          <h2>Where's this going down?</h2>
          <p>Pick the vibe. Your arena changes with the scene.</p>
        </div>
        <div class="scene-grid" id="scene-grid" role="listbox" aria-label="Scene">
          ${sceneCards}
        </div>
        <div class="challenge-pick">
          <p class="challenge-prompt" id="challenge-prompt">Go as long as you want — hit Done when you feel better.</p>
          <div class="chip-row" id="mode-row">
            <button type="button" class="chip on" data-mode="free">Free vent</button>
            <button type="button" class="chip" data-mode="challenge">Soft challenge</button>
          </div>
        </div>
        <div class="form-actions scene-actions">
          <button type="button" class="btn btn-ghost" id="btn-back-foe">← Back</button>
          <button type="button" class="btn btn-danger" id="btn-arena">Open the door</button>
        </div>
      </div>
    </div>
  </section>

  <section id="screen-arena" class="screen">
    <header class="arena-top">
      <div class="logo">VENTHIT</div>
      <div class="meters">
        <div class="meter">
          <div class="meter-head">
            <span>Rage</span>
            <strong><span id="rage-level">Calm</span> · <span id="rage-pct">0%</span></strong>
          </div>
          <div class="meter-track"><div class="meter-fill" id="rage-fill"></div></div>
        </div>
        <div class="combo" id="combo-box" hidden>
          <span class="combo-num" id="combo-num">0</span>
          <span class="combo-label">HIT COMBO</span>
        </div>
        <div class="challenge-clock" id="challenge-clock" hidden>
          <span class="clock-num" id="challenge-left">20</span>
          <span class="clock-label">LEFT</span>
        </div>
      </div>
      <div class="arena-actions">
        <button class="btn btn-ghost btn-sm" id="btn-done" type="button">Done</button>
        <button class="btn btn-ghost btn-sm" id="btn-reset" type="button">Rebuild</button>
      </div>
    </header>
    <div class="arena-challenge-bar" id="arena-challenge-bar" hidden>
      <span id="arena-challenge-copy">Beat the score</span>
    </div>

    <div class="arena" id="arena" data-scene="office" data-rage-level="calm">
      <div class="arena-bg">
        <div class="wall"></div>
        <div class="pipes"></div>
        <div class="lights"></div>
        <div class="floor"></div>
        <div class="scene-props" aria-hidden="true"></div>
      </div>
      <div class="pool-rig" id="pool" hidden>
        <div class="tub"><div class="tub-water" id="tub-water"></div></div>
      </div>
      <div class="fighter you-side" id="fighter-you">
        <div class="char" id="char-you" data-mood="ready"></div>
        <div class="nametag you" id="tag-you">Me</div>
      </div>
      <div class="fighter foe-side" id="fighter-foe">
        <div class="char" id="char-foe" data-mood="annoyed"></div>
        <div class="nametag foe" id="tag-foe">Boss</div>
        <div class="status-fx" id="status-fx"></div>
      </div>
      <div class="speech" id="speech" hidden></div>
      <div class="bam" id="bam"></div>
      <div class="toast" id="toast"></div>
    </div>

    <div class="dock">
      <div class="dock-top">
        <p class="dock-hint" id="hint">Pick a move. Make it count.</p>
        <button type="button" class="btn-ultimate" id="btn-ultimate" disabled>
          <span class="ult-label">ULTIMATE</span>
          <span class="ult-charge"><i id="ult-fill"></i></span>
          <span class="ult-key">U</span>
        </button>
      </div>
      <div class="moves" id="moves">${moves}</div>
    </div>
  </section>

  <section id="screen-result" class="screen">
    <div class="result-wrap">
      <p class="result-brand">VENTHIT</p>
      <p class="result-badge" id="result-badge" hidden></p>
      <div class="result-card" id="result-card">
        <p class="result-match" id="result-match">Me vs Boss</p>
        <div class="result-stats">
          <div class="result-stat"><strong id="result-time">0.0s</strong><span>Time</span></div>
          <div class="result-stat"><strong id="result-hits">0</strong><span>Hits</span></div>
          <div class="result-stat"><strong id="result-combo">0</strong><span>Max combo</span></div>
          <div class="result-stat"><strong id="result-rage">0%</strong><span>Rage</span></div>
        </div>
        <p class="result-level" id="result-level">RAGE LEVEL: Calm</p>
        <p class="unlock-note" id="unlock-note" hidden></p>
      </div>
      <div class="feeling" id="feeling-block">
        <h2>Feeling better?</h2>
        <div class="feeling-actions">
          <button type="button" class="btn btn-fire" id="btn-feel-yes">Yes</button>
          <button type="button" class="btn btn-danger" id="btn-feel-no">Not yet</button>
        </div>
      </div>
      <div class="challenge-block" id="challenge-block" hidden>
        <h2>Challenge a friend</h2>
        <p class="challenge-copy" id="challenge-copy"></p>
        <p class="share-link-wrap">
          <input type="text" id="share-link" readonly aria-label="Challenge link" />
        </p>
        <div class="feeling-actions share-actions">
          <button type="button" class="btn btn-fire" id="btn-share-native">Share</button>
          <button type="button" class="btn btn-fire" id="btn-copy-link">Copy link</button>
          <button type="button" class="btn btn-ghost" id="btn-whatsapp">WhatsApp</button>
          <button type="button" class="btn btn-ghost" id="btn-copy-challenge">Copy text</button>
          <button type="button" class="btn btn-ghost" id="btn-new-session">New session</button>
        </div>
        <p class="beat-note" id="beat-note" hidden></p>
      </div>
    </div>
  </section>`;
}
