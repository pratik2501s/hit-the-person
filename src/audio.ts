type OscType = OscillatorType;

let audioCtx: AudioContext | null = null;

function ensureAudio(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function tone(
  freq: number,
  dur: number,
  type: OscType = "square",
  gain = 0.08,
  slide = 0,
): void {
  const ctx = ensureAudio();
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  }
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur = 0.12, gain = 0.1): void {
  const ctx = ensureAudio();
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 800;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  n.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  n.start();
}

export const SFX = {
  ensure: ensureAudio,
  punch() {
    tone(90, 0.1, "square", 0.12, -40);
    noiseBurst(0.08, 0.12);
  },
  slap() {
    noiseBurst(0.06, 0.15);
    tone(220, 0.06, "sawtooth", 0.06, -100);
  },
  kick() {
    tone(70, 0.16, "sine", 0.15, -30);
    noiseBurst(0.1, 0.1);
  },
  mud() {
    noiseBurst(0.15, 0.1);
    tone(120, 0.12, "triangle", 0.05, -60);
  },
  water() {
    noiseBurst(0.25, 0.12);
    tone(180, 0.2, "sine", 0.05, 80);
    tone(90, 0.3, "sine", 0.04);
  },
  pie() {
    noiseBurst(0.12, 0.1);
    tone(300, 0.08, "triangle", 0.06, -150);
  },
  shake() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => tone(140 + i * 20, 0.04, "square", 0.04), i * 80);
    }
  },
  tomato() {
    noiseBurst(0.1, 0.11);
    tone(160, 0.1, "sawtooth", 0.05, -80);
  },
  uppercut() {
    tone(60, 0.08, "sine", 0.12);
    tone(180, 0.2, "square", 0.08, 220);
    noiseBurst(0.12, 0.1);
  },
  taunt() {
    tone(400, 0.08, "square", 0.05);
    tone(500, 0.1, "square", 0.05);
  },
  headbutt() {
    tone(55, 0.12, "sine", 0.14, -20);
    noiseBurst(0.1, 0.14);
    tone(180, 0.08, "square", 0.06);
  },
  push() {
    noiseBurst(0.12, 0.1);
    tone(100, 0.14, "sawtooth", 0.08, -50);
  },
  hammer() {
    tone(40, 0.08, "sine", 0.16);
    noiseBurst(0.16, 0.16);
    tone(90, 0.2, "square", 0.1, -30);
  },
  ultimate() {
    tone(40, 0.1, "sine", 0.14);
    tone(80, 0.2, "square", 0.12, 120);
    tone(220, 0.25, "sawtooth", 0.08, 300);
    noiseBurst(0.28, 0.18);
  },
  whoosh() {
    noiseBurst(0.1, 0.05);
    tone(400, 0.1, "sine", 0.03, -200);
  },
  ui() {
    tone(520, 0.05, "sine", 0.04);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => tone(f, 0.18, "triangle", 0.07), i * 90),
    );
  },
  fail() {
    tone(200, 0.15, "sawtooth", 0.08, -80);
    tone(120, 0.25, "triangle", 0.06, -40);
  },
};
