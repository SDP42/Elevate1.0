/* Procedural aviation soundscape. Nothing here is a recording — every sound is
   synthesised from filtered noise and oscillators, so there are no audio
   files to ship and nothing to license.

   Layers, each on its own gain so scroll position can mix them:
     cabin    – low airframe drone plus filtered air rush, the in-cabin hum
     wind     – brighter rush for the open-sky cloud flight
     engine   – approach turbofan whine that drops in pitch on descent
     reverse  – broadband roar of reverse thrust after touchdown
   One-shots:
     chime    – two-tone cabin call chime when sound is switched on
     chirp    – main-gear tyre contact, fired once at touchdown
     swoosh   – short pass-by for the FAQ jet reveal */

function noiseBuffer(ctx, seconds = 2) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // brown-ish noise: integrated white noise reads as rumble, not hiss
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

function whiteBuffer(ctx, seconds = 1) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function loopSource(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

export function createEngine() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const brown = noiseBuffer(ctx);
  const white = whiteBuffer(ctx);

  const layer = () => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    return g;
  };

  // ---- cabin: drone + muffled air ----
  const cabin = layer();
  const cabinAir = loopSource(ctx, brown);
  const cabinLp = ctx.createBiquadFilter();
  cabinLp.type = "lowpass";
  cabinLp.frequency.value = 380;
  cabinAir.connect(cabinLp).connect(cabin);

  const drone = ctx.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 96;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.18;
  drone.connect(droneGain).connect(cabin);

  const drone2 = ctx.createOscillator();
  drone2.type = "triangle";
  drone2.frequency.value = 48.5; // slight detune gives the airframe beat
  const drone2Gain = ctx.createGain();
  drone2Gain.gain.value = 0.12;
  drone2.connect(drone2Gain).connect(cabin);

  // ---- wind: open-sky rush ----
  const wind = layer();
  const windSrc = loopSource(ctx, brown);
  const windBp = ctx.createBiquadFilter();
  windBp.type = "bandpass";
  windBp.frequency.value = 700;
  windBp.Q.value = 0.5;
  windSrc.connect(windBp).connect(wind);

  // slow gusting on the wind filter
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.13;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 260;
  gust.connect(gustDepth).connect(windBp.frequency);

  // ---- engine: turbofan whine + core rumble ----
  const engine = layer();
  const whine = ctx.createOscillator();
  whine.type = "sawtooth";
  whine.frequency.value = 520;
  const whineLp = ctx.createBiquadFilter();
  whineLp.type = "lowpass";
  whineLp.frequency.value = 1400;
  const whineGain = ctx.createGain();
  whineGain.gain.value = 0.05;
  whine.connect(whineLp).connect(whineGain).connect(engine);

  const core = loopSource(ctx, brown);
  const coreBp = ctx.createBiquadFilter();
  coreBp.type = "bandpass";
  coreBp.frequency.value = 900;
  coreBp.Q.value = 0.7;
  core.connect(coreBp).connect(engine);

  // ---- reverse thrust: broadband roar ----
  const reverse = layer();
  const revSrc = loopSource(ctx, brown);
  const revLp = ctx.createBiquadFilter();
  revLp.type = "lowpass";
  revLp.frequency.value = 1600;
  revSrc.connect(revLp).connect(reverse);

  [cabinAir, drone, drone2, windSrc, gust, whine, core, revSrc].forEach((n) =>
    n.start()
  );

  const glide = (param, value, time = 0.25) =>
    param.setTargetAtTime(value, ctx.currentTime, time);

  function chime() {
    const now = ctx.currentTime;
    [
      [659.25, 0],
      [523.25, 0.42],
    ].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(0.22, now + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.3);
      osc.connect(g).connect(master);
      osc.start(now + delay);
      osc.stop(now + delay + 1.4);
    });
  }

  function chirp() {
    const now = ctx.currentTime;
    // two gear contacts a beat apart, each a short squeal plus a thump
    [0, 0.07].forEach((delay) => {
      const src = ctx.createBufferSource();
      src.buffer = white;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2300;
      bp.Q.value = 3.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(0.5, now + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.26);
      src.connect(bp).connect(g).connect(master);
      src.start(now + delay);
      src.stop(now + delay + 0.3);

      const thump = ctx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(90, now + delay);
      thump.frequency.exponentialRampToValueAtTime(38, now + delay + 0.18);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.55, now + delay);
      tg.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.22);
      thump.connect(tg).connect(master);
      thump.start(now + delay);
      thump.stop(now + delay + 0.25);
    });
  }

  function burst({ freq, q = 1, dur = 0.05, gain = 0.2, type = "bandpass", delay = 0 }) {
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = white;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f).connect(g).connect(master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  // hover tick: a very short, quiet click
  function tick() {
    burst({ freq: 3200, q: 6, dur: 0.025, gain: 0.05 });
  }

  // split-flap clatter: a quick run of plastic flaps
  function flap(count = 6) {
    for (let i = 0; i < count; i++) {
      burst({ freq: 1800 + Math.random() * 900, q: 4, dur: 0.03, gain: 0.07, delay: i * 0.045 });
    }
  }

  // rubber stamp: low thump with a papery slap on top
  function stamp() {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(50, now + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + 0.2);
    burst({ freq: 900, q: 0.8, dur: 0.09, gain: 0.25 });
  }

  // fly-over: a noise sweep that rises and falls past the listener
  function flyover() {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = brown;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(300, now);
    f.frequency.exponentialRampToValueAtTime(1600, now + 1.1);
    f.frequency.exponentialRampToValueAtTime(260, now + 2.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.7, now + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);
    src.connect(f).connect(g).connect(master);
    src.start(now);
    src.stop(now + 2.8);
  }

  // compact pass-by for the FAQ jet: aligned to its 1.3s screen crossing
  function swoosh() {
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = brown;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.15;
    f.frequency.setValueAtTime(240, now);
    f.frequency.exponentialRampToValueAtTime(1800, now + 0.56);
    f.frequency.exponentialRampToValueAtTime(330, now + 1.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.42, now + 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    src.connect(f).connect(g).connect(master);
    src.start(now);
    src.stop(now + 1.35);
  }

  return {
    tick,
    flap,
    stamp,
    flyover,
    swoosh,
    chime,
    async enable() {
      if (ctx.state === "suspended") await ctx.resume();
      glide(master.gain, 0.9, 0.4);
      chime();
      // a steady cabin hum plays throughout the site the whole time sound
      // is on — the toggle's whole point, not just its one-off chimes
      glide(cabin.gain, 0.42 * 0.5, 1.4);
      glide(wind.gain, 0.14 * 0.32, 1.4);
    },
    disable() {
      glide(master.gain, 0, 0.15);
    },
    /* levels are 0..1; pitch is 0..1 across the approach */
    mix({ cabin: c = 0, wind: w = 0, engine: e = 0, reverse: r = 0, pitch = 0 }) {
      glide(cabin.gain, c * 0.5);
      glide(wind.gain, w * 0.32);
      glide(engine.gain, e * 0.42);
      glide(reverse.gain, r * 0.55, 0.12);
      glide(whine.frequency, 620 - pitch * 240, 0.3);
      glide(coreBp.frequency, 1100 - pitch * 420, 0.3);
    },
    chirp,
  };
}
