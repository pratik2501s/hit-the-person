# VENTHIT

Cartoon rage-room game.

**Phases shipped:** P0 loop → P1 combat → P2 identity → **P3 share & challenge**

## Phase 3

- Shareable challenge links (`#c=…`) encode foe + score — no backend
- Web Share / Copy link / WhatsApp from the result screen
- Daily Rage Challenge (date-seeded meme enemy)
- Incoming challenge banner + beat-score compare

## Stack

- **TypeScript** + **Vite**
- Minimal `index.html` shell; UI and game logic live under `src/`

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Project layout

```
src/
  main.ts          # mounts UI, starts game
  game.ts          # screens, combat, share loop
  share.ts         # challenge encode/decode, daily seed
  character.ts     # SVG characters
  audio.ts         # procedural SFX
  data.ts          # categories, scenes, lines
  types.ts
  ui/shell.ts      # DOM markup (TypeScript)
  styles.css
```
