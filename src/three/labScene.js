import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* The finale cabin, drawn as an architectural cutaway of a business jet
   flying through cloud: the near wall and part of the ceiling are removed so
   the table reads from outside. Everything is procedural — veneer, carpet,
   leather and the screens are painted onto canvases at start-up — and lit
   physically (image-based environment, sun with soft shadows, warm cove
   light), so the materials behave like the things they stand for.

   Teams bring their own machines, so the four laptops on the table are
   deliberately mismatched. */

const L = 5.6; // cabin section length along x

/* ------------------------------------------------------------------ */
/* procedural textures                                                 */
/* ------------------------------------------------------------------ */

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 8;
  return t;
}

function walnutTexture() {
  const [c, ctx] = canvas(1024, 256);
  const r = rng(11);
  ctx.fillStyle = "#4a2f1d";
  ctx.fillRect(0, 0, c.width, c.height);
  // long flowing grain: many thin, slightly wavy strokes of varying tone
  for (let i = 0; i < 260; i++) {
    const y0 = r() * c.height;
    const amp = 2 + r() * 7;
    const freq = 0.004 + r() * 0.01;
    const phase = r() * 10;
    const tone = r();
    ctx.strokeStyle =
      tone > 0.55
        ? `rgba(120, 78, 46, ${0.12 + r() * 0.25})`
        : `rgba(28, 16, 9, ${0.12 + r() * 0.3})`;
    ctx.lineWidth = 0.6 + r() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= c.width; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // a couple of soft figure bands
  for (let i = 0; i < 6; i++) {
    const g = ctx.createLinearGradient(0, r() * c.height, 0, r() * c.height + 60);
    g.addColorStop(0, "rgba(160, 110, 70, 0)");
    g.addColorStop(0.5, "rgba(160, 110, 70, 0.12)");
    g.addColorStop(1, "rgba(160, 110, 70, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return tex(c);
}

function noiseTexture(size, base, spread, seed, { srgb = true, repeat = null } = {}) {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const r = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const n = (r() - 0.5) * spread;
    img.data[i * 4] = Math.max(0, Math.min(255, base[0] + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, base[1] + n));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, base[2] + n));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { srgb, repeat });
}

function carpetTexture() {
  const [c, ctx] = canvas(512, 512);
  const r = rng(5);
  ctx.fillStyle = "#6f665b";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) {
    const v = 90 + r() * 40;
    ctx.fillStyle = `rgba(${v + 12}, ${v + 4}, ${v - 8}, ${0.25 + r() * 0.35})`;
    ctx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  // faint woven diamond, like aircraft carpet
  ctx.strokeStyle = "rgba(40, 34, 28, 0.18)";
  ctx.lineWidth = 2;
  for (let k = -512; k < 1024; k += 64) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + 512, 512);
    ctx.moveTo(k + 512, 0);
    ctx.lineTo(k, 512);
    ctx.stroke();
  }
  return tex(c, { repeat: [4, 2] });
}

function keyboardTexture(dark) {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = dark ? "#1b1c1f" : "#2a2b2f";
  ctx.fillRect(0, 0, 512, 256);
  const rows = [14, 14, 13, 12, 10];
  const keyW = 32;
  rows.forEach((n, row) => {
    const y = 14 + row * 40;
    const offset = (512 - n * (keyW + 3)) / 2;
    for (let i = 0; i < n; i++) {
      const w = row === 4 && i === 4 ? keyW * 4 : keyW;
      const x = offset + i * (keyW + 3) + (row === 4 && i > 4 ? keyW * 3 : 0);
      ctx.fillStyle = dark ? "#0c0c0e" : "#141518";
      ctx.beginPath();
      ctx.roundRect(x, y, w, 34, 5);
      ctx.fill();
    }
  });
  return tex(c);
}

/* Editor / terminal / browser screens, drawn as the real thing: small
   monospace text with syntax colours, not coloured bars. */
function screenTexture(kind) {
  const [c, ctx] = canvas(1024, 660);
  const mono = "22px Menlo, 'SF Mono', Consolas, monospace";

  if (kind === "terminal") {
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, 1024, 660);
    ctx.fillStyle = "#1c1f26";
    ctx.fillRect(0, 0, 1024, 40);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(26 + i * 26, 20, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    const lines = [
      ["#7ee787", "team-orbit@finale ~/elevate % npm run dev"],
      ["#c9d1d9", ""],
      ["#79c0ff", "  VITE v8.3.0  ready in 412 ms"],
      ["#c9d1d9", ""],
      ["#c9d1d9", "  ➜  Local:   http://localhost:5173/"],
      ["#8b949e", "  ➜  Network: use --host to expose"],
      ["#c9d1d9", ""],
      ["#7ee787", "team-orbit@finale ~/elevate % git commit -m \"wire queue retries\""],
      ["#c9d1d9", "[main 4f2a9c1] wire queue retries"],
      ["#8b949e", " 3 files changed, 118 insertions(+), 24 deletions(-)"],
      ["#7ee787", "team-orbit@finale ~/elevate % python train.py --epochs 12"],
      ["#e3b341", "epoch 07/12  loss 0.2381  acc 0.9142"],
      ["#e3b341", "epoch 08/12  loss 0.2104  acc 0.9227"],
      ["#c9d1d9", "▌"],
    ];
    ctx.font = mono;
    lines.forEach(([col, text], i) => {
      ctx.fillStyle = col;
      ctx.fillText(text, 24, 86 + i * 40);
    });
  } else if (kind === "browser") {
    ctx.fillStyle = "#f4f5f7";
    ctx.fillRect(0, 0, 1024, 660);
    ctx.fillStyle = "#dfe3e8";
    ctx.fillRect(0, 0, 1024, 56);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(150, 12, 720, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#5b6470";
    ctx.font = "18px -apple-system, Helvetica, Arial";
    ctx.fillText("localhost:5173/dashboard", 176, 34);
    ctx.fillStyle = "#1f2a37";
    ctx.fillRect(0, 56, 200, 604);
    ctx.fillStyle = "#9fb0c3";
    ["Overview", "Tickets", "Alerts", "Models", "Settings"].forEach((t, i) => {
      ctx.fillText(t, 28, 110 + i * 46);
    });
    ctx.fillStyle = "#111827";
    ctx.font = "600 30px -apple-system, Helvetica, Arial";
    ctx.fillText("Live incidents", 236, 112);
    [
      ["#2563eb", 0.8],
      ["#16a34a", 0.55],
      ["#f59e0b", 0.35],
    ].forEach(([col, v], i) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(236 + i * 258, 140, 240, 120, 12);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.fillRect(256 + i * 258, 230, 200 * v, 12);
      ctx.fillStyle = "#374151";
      ctx.font = "600 34px -apple-system, Helvetica, Arial";
      ctx.fillText(String(Math.round(v * 240)), 256 + i * 258, 200);
    });
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= 740; x += 20) {
      const y = 520 - Math.sin(x / 60) * 50 - x * 0.12;
      if (x === 0) ctx.moveTo(236 + x, y);
      else ctx.lineTo(236 + x, y);
    }
    ctx.stroke();
  } else {
    // code editor, dark theme
    ctx.fillStyle = "#1e1f24";
    ctx.fillRect(0, 0, 1024, 660);
    ctx.fillStyle = "#18191d";
    ctx.fillRect(0, 0, 210, 660);
    ctx.fillStyle = "#26272d";
    ctx.fillRect(210, 0, 814, 44);
    ctx.fillStyle = "#1e1f24";
    ctx.fillRect(210, 0, 180, 44);
    ctx.font = "17px -apple-system, Helvetica, Arial";
    ctx.fillStyle = "#d4d4d4";
    ctx.fillText(kind === "python" ? "pipeline.py" : "Queue.tsx", 232, 28);
    ctx.fillStyle = "#8b8d94";
    ["src", "  api", "  components", "  hooks", "  lib", "tests", "package.json", "README.md"].forEach((t, i) => {
      ctx.fillText(t, 20, 80 + i * 30);
    });

    const code =
      kind === "python"
        ? [
            [["#c586c0", "import "], ["#d4d4d4", "pandas "], ["#c586c0", "as "], ["#d4d4d4", "pd"]],
            [["#c586c0", "from "], ["#d4d4d4", "sklearn.ensemble "], ["#c586c0", "import "], ["#4ec9b0", "RandomForestClassifier"]],
            [],
            [["#c586c0", "def "], ["#dcdcaa", "load_events"], ["#d4d4d4", "(path: "], ["#4ec9b0", "str"], ["#d4d4d4", "):"]],
            [["#d4d4d4", "    df = pd."], ["#dcdcaa", "read_csv"], ["#d4d4d4", "(path, parse_dates=["], ["#ce9178", "\"ts\""], ["#d4d4d4", "])"]],
            [["#d4d4d4", "    df = df."], ["#dcdcaa", "dropna"], ["#d4d4d4", "(subset=["], ["#ce9178", "\"user_id\""], ["#d4d4d4", "])"]],
            [["#c586c0", "    return "], ["#d4d4d4", "df"]],
            [],
            [["#6a9955", "# features the judges asked about"]],
            [["#d4d4d4", "model = "], ["#4ec9b0", "RandomForestClassifier"], ["#d4d4d4", "(n_estimators="], ["#b5cea8", "300"], ["#d4d4d4", ")"]],
            [["#d4d4d4", "model."], ["#dcdcaa", "fit"], ["#d4d4d4", "(X_train, y_train)"]],
            [["#dcdcaa", "print"], ["#d4d4d4", "(model."], ["#dcdcaa", "score"], ["#d4d4d4", "(X_test, y_test))"]],
          ]
        : [
            [["#c586c0", "import "], ["#d4d4d4", "{ useEffect, useState } "], ["#c586c0", "from "], ["#ce9178", "\"react\""]],
            [["#c586c0", "import "], ["#d4d4d4", "{ retry } "], ["#c586c0", "from "], ["#ce9178", "\"../lib/queue\""]],
            [],
            [["#c586c0", "export function "], ["#dcdcaa", "Queue"], ["#d4d4d4", "({ jobs }) {"]],
            [["#569cd6", "  const "], ["#d4d4d4", "[done, setDone] = "], ["#dcdcaa", "useState"], ["#d4d4d4", "("], ["#b5cea8", "0"], ["#d4d4d4", ")"]],
            [["#dcdcaa", "  useEffect"], ["#d4d4d4", "(() => {"]],
            [["#d4d4d4", "    jobs."], ["#dcdcaa", "forEach"], ["#d4d4d4", "((job) =>"]],
            [["#dcdcaa", "      retry"], ["#d4d4d4", "(job, { backoff: "], ["#b5cea8", "250 "], ["#d4d4d4", "})"]],
            [["#d4d4d4", "        ."], ["#dcdcaa", "then"], ["#d4d4d4", "(() => "], ["#dcdcaa", "setDone"], ["#d4d4d4", "((n) => n + "], ["#b5cea8", "1"], ["#d4d4d4", "))"]],
            [["#d4d4d4", "    )"]],
            [["#d4d4d4", "  }, [jobs])"]],
            [["#c586c0", "  return "], ["#d4d4d4", "<"], ["#4ec9b0", "Progress "], ["#9cdcfe", "value"], ["#d4d4d4", "={done} />"]],
          ];

    ctx.font = mono;
    code.forEach((tokens, i) => {
      const y = 90 + i * 40;
      ctx.fillStyle = "#5a5d66";
      ctx.fillText(String(i + 1).padStart(2, " "), 226, y);
      let x = 280;
      tokens.forEach(([col, text]) => {
        ctx.fillStyle = col;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
      });
    });
    ctx.fillStyle = "#2f80ed";
    ctx.fillRect(0, 636, 1024, 24);
  }
  return tex(c);
}

function bulkheadScreenTexture() {
  const [c, ctx] = canvas(1024, 576);
  const g = ctx.createLinearGradient(0, 0, 1024, 576);
  g.addColorStop(0, "#0d2233");
  g.addColorStop(1, "#153a55");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 576);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 28px Helvetica, Arial";
  ctx.fillText("ELEVATE 1.0  ·  FLIGHT EL 100", 70, 100);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 150px Helvetica, Arial";
  ctx.fillText("24:00", 70, 300);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "32px Helvetica, Arial";
  ctx.fillText("Hours to landing", 76, 360);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(70, 460);
  ctx.lineTo(954, 460);
  ctx.stroke();
  ctx.fillStyle = "#f2c85b";
  ctx.beginPath();
  ctx.arc(300, 460, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "24px Helvetica, Arial";
  ctx.fillText("TAKE-OFF 11:00", 70, 510);
  ctx.fillText("LANDING 11:00", 790, 510);
  return tex(c);
}

function windowViewTexture() {
  const [c, ctx] = canvas(256, 384);
  const g = ctx.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, "#5f9fd6");
  g.addColorStop(0.55, "#b9d8ee");
  g.addColorStop(0.62, "#f3f1f2");
  g.addColorStop(1, "#dfe8f1");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 384);
  const r = rng(3);
  for (let i = 0; i < 40; i++) {
    const x = r() * 256;
    const y = 220 + r() * 170;
    const rad = 20 + r() * 40;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, "rgba(255,255,255,0.9)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  return tex(c);
}

/* Soft volumetric-looking cloud billboard: value-noise density shaped by a
   radial falloff, brighter on top where the sun catches it. */
function cloudTexture(seed) {
  const size = 256;
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const r = rng(seed);
  const grid = 8;
  const lattice = Array.from({ length: (grid + 1) * (grid + 1) }, () => r());
  const vnoise = (x, y, f) => {
    const gx = x * f;
    const gy = y * f;
    const ix = Math.floor(gx) % grid;
    const iy = Math.floor(gy) % grid;
    const fx = gx - Math.floor(gx);
    const fy = gy - Math.floor(gy);
    const at = (a, b) => lattice[(b % grid) * (grid + 1) + (a % grid)];
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
    const bot = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
    return top * (1 - sy) + bot * sy;
  };
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const v = py / size;
      let n = 0;
      let amp = 0.5;
      let f = 1;
      for (let o = 0; o < 4; o++) {
        n += vnoise(u, v, f) * amp;
        amp *= 0.5;
        f *= 2;
      }
      const dx = (u - 0.5) * 2;
      const dy = (v - 0.58) * 2.4;
      const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const d = Math.max(0, Math.min(1, (n * fall * 1.9 - 0.18) * 1.6));
      const light = 1 - v * 0.28;
      const i = (py * size + px) * 4;
      img.data[i] = 255 * light;
      img.data[i + 1] = 255 * (light * 0.99);
      img.data[i + 2] = 255 * Math.min(1, light * 1.02);
      img.data[i + 3] = 255 * Math.pow(d, 1.2);
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/* Sweeps a 2D cross-section (points in z,y) along the cabin's length. */
function sweep(profile, length, segX = 1) {
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const uv = [];
  const idx = [];
  let acc = 0;
  const dist = [0];
  for (let i = 1; i < profile.length; i++) {
    acc += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]);
    dist.push(acc);
  }
  for (let s = 0; s <= segX; s++) {
    const x = -length / 2 + (length * s) / segX;
    profile.forEach(([z, y], i) => {
      pos.push(x, y, z);
      uv.push(s / segX, dist[i] / acc);
    });
  }
  const n = profile.length;
  for (let s = 0; s < segX; s++) {
    for (let i = 0; i < n - 1; i++) {
      const a = s * n + i;
      const b = (s + 1) * n + i;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function arc(cz, cy, r, a0, a1, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

const rbox = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));

/* ------------------------------------------------------------------ */
/* the cabin                                                           */
/* ------------------------------------------------------------------ */

function buildFuselage(mats) {
  const group = new THREE.Group();

  // interior lining: from the far floor edge, up the far wall, over into a
  // ceiling that stops short of the cut (points are z, y)
  const inner = [
    ...arc(0, 0.78, 1.3, Math.PI * 1.2, Math.PI * 0.64, 18),
    [-0.2, 1.93],
    [0.42, 1.93],
  ];
  const lining = new THREE.Mesh(sweep(inner, L, 1), mats.lining);
  group.add(lining);

  // outer skin: from the top of the cut, over the crown and far side, round
  // the belly, up to floor level on the near side
  const deg = Math.PI / 180;
  const skinProfile = arc(0, 0.72, 1.52, 73 * deg, 332 * deg, 48);
  const skin = new THREE.Mesh(sweep(skinProfile, L, 1), mats.skin);
  group.add(skin);

  // cutaway caps at both ends: the band of structure between skin and lining,
  // closed along the floor line
  const cap = new THREE.Shape();
  skinProfile.forEach(([z, y], i) => (i === 0 ? cap.moveTo(z, y) : cap.lineTo(z, y)));
  inner.forEach(([z, y]) => cap.lineTo(z, y));
  cap.closePath();
  const capGeo = new THREE.ShapeGeometry(cap);
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(capGeo, mats.structure);
    // shape x → world z, shape y → world y
    m.rotation.y = -Math.PI / 2;
    m.position.x = (side * L) / 2;
    group.add(m);
  }

  // cut edge along the top: a thin rib strip so the section reads as solid
  const topEdge = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.05), mats.structure);
  topEdge.position.set(0, 1.95, 0.44);
  group.add(topEdge);

  // floor: carpeted deck with a visible slab edge at the cut
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 2.5), mats.carpet);
  floor.position.set(0, -0.04, 0.12);
  floor.receiveShadow = true;
  group.add(floor);
  const slabEdge = new THREE.Mesh(new THREE.BoxGeometry(L, 0.1, 0.03), mats.structure);
  slabEdge.position.set(0, -0.05, 1.38);
  group.add(slabEdge);

  // side ledge along the far wall, veneered top, like a business-jet dado
  const ledge = new THREE.Mesh(rbox(L - 0.2, 0.05, 0.3, 0.015), mats.walnut);
  ledge.position.set(0, 0.62, -1.02);
  group.add(ledge);
  const ledgeBody = new THREE.Mesh(new THREE.BoxGeometry(L - 0.2, 0.58, 0.26), mats.panel);
  ledgeBody.position.set(0, 0.3, -1.05);
  group.add(ledgeBody);

  // windows: recessed oval reveals with the view outside
  const view = new THREE.MeshBasicMaterial({ map: windowViewTexture(), toneMapped: false });
  const revealShape = new THREE.Shape();
  revealShape.absellipse(0, 0, 0.2, 0.27, 0, Math.PI * 2);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 0.15, 0.21, 0, Math.PI * 2);
  revealShape.holes.push(hole);
  const revealGeo = new THREE.ExtrudeGeometry(revealShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 3,
    curveSegments: 32,
  });
  const glassShape = new THREE.Shape();
  glassShape.absellipse(0, 0, 0.152, 0.212, 0, Math.PI * 2);
  const glassGeo = new THREE.ShapeGeometry(glassShape, 32);

  for (let i = 0; i < 6; i++) {
    const x = -2.3 + i * 0.92;
    const win = new THREE.Group();
    const reveal = new THREE.Mesh(revealGeo, mats.bezel);
    win.add(reveal);
    const glass = new THREE.Mesh(glassGeo, view);
    glass.position.z = -0.01;
    win.add(glass);
    // a couple of shades drawn part-way, as they would be mid-flight
    if (i === 1 || i === 4) {
      const shade = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), mats.shade);
      shade.position.set(0, 0.1, 0.005);
      win.add(shade);
    }
    win.position.set(x, 1.12, -1.2);
    win.rotation.x = 0.22; // follows the wall as it curves in overhead
    group.add(win);
  }

  // ceiling: cove light strip along the far edge and recessed downlights
  const cove = new THREE.Mesh(new THREE.BoxGeometry(L - 0.3, 0.02, 0.06), mats.coveLight);
  cove.position.set(0, 1.86, -0.62);
  group.add(cove);
  for (let i = 0; i < 5; i++) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), mats.coveLight);
    spot.rotation.x = Math.PI / 2;
    spot.position.set(-2 + i, 1.925, 0.05);
    group.add(spot);
  }

  // forward bulkhead: veneer panel with the flight display
  const bulk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.88, 2.3), mats.walnut);
  bulk.position.set(-L / 2 + 0.03, 0.94, -0.05);
  group.add(bulk);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.62),
    new THREE.MeshBasicMaterial({ map: bulkheadScreenTexture(), toneMapped: false })
  );
  display.rotation.y = Math.PI / 2;
  display.position.set(-L / 2 + 0.078, 1.2, -0.25);
  group.add(display);
  const displayFrame = new THREE.Mesh(rbox(0.03, 0.66, 1.14, 0.01), mats.blackGloss);
  displayFrame.position.set(-L / 2 + 0.055, 1.2, -0.25);
  group.add(displayFrame);

  return group;
}

function buildSeat(mats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.04, 32), mats.metalDark);
  base.position.y = 0.02;
  g.add(base);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 24), mats.metal);
  column.position.y = 0.14;
  g.add(column);

  const shroud = new THREE.Mesh(rbox(0.56, 0.16, 0.54, 0.05), mats.leatherDark);
  shroud.position.y = 0.3;
  g.add(shroud);
  const pan = new THREE.Mesh(rbox(0.54, 0.12, 0.52, 0.055), mats.leather);
  pan.position.set(0, 0.43, 0.01);
  g.add(pan);

  // backrest reclined a touch, with a separate headrest pillow
  const back = new THREE.Group();
  back.position.set(0, 0.46, -0.22);
  back.rotation.x = -0.2;
  const backCushion = new THREE.Mesh(rbox(0.52, 0.66, 0.15, 0.06), mats.leather);
  backCushion.position.y = 0.34;
  back.add(backCushion);
  const backShell = new THREE.Mesh(rbox(0.56, 0.7, 0.06, 0.03), mats.leatherDark);
  backShell.position.set(0, 0.34, -0.09);
  back.add(backShell);
  const head = new THREE.Mesh(rbox(0.36, 0.15, 0.1, 0.05), mats.leather);
  head.position.set(0, 0.73, 0.02);
  back.add(head);
  g.add(back);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(rbox(0.09, 0.09, 0.5, 0.04), mats.leatherDark);
    arm.position.set(side * 0.31, 0.56, -0.02);
    g.add(arm);
    const armTop = new THREE.Mesh(rbox(0.08, 0.02, 0.36, 0.008), mats.walnut);
    armTop.position.set(side * 0.31, 0.61, 0.02);
    g.add(armTop);
  }
  return g;
}

function buildTable(mats) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(rbox(1.5, 0.045, 0.86, 0.02, 4), mats.walnutGloss);
  top.position.y = 0.72;
  g.add(top);
  const trim = new THREE.Mesh(rbox(1.52, 0.012, 0.88, 0.006), mats.metal);
  trim.position.y = 0.692;
  g.add(trim);
  for (const x of [-0.45, 0.45]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.68, 32), mats.metal);
    col.position.set(x, 0.35, 0);
    g.add(col);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.025, 40), mats.metal);
    foot.position.set(x, 0.013, 0);
    g.add(foot);
  }
  return g;
}

/* Laptops brought from home: sizes, finishes and screens all differ. */
const LAPTOPS = [
  { w: 0.31, d: 0.215, shell: 0xc9ccd1, rough: 0.32, screen: "editor", keysDark: false, angle: 0.3 },
  { w: 0.33, d: 0.225, shell: 0x3a3b3f, rough: 0.38, screen: "terminal", keysDark: true, angle: 0.24 },
  { w: 0.35, d: 0.24, shell: 0x1b1b1d, rough: 0.7, screen: "python", keysDark: true, angle: 0.34, matte: true },
  { w: 0.3, d: 0.21, shell: 0xd8d2c8, rough: 0.34, screen: "browser", keysDark: false, angle: 0.28 },
];

function buildLaptop(spec, mats) {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: spec.shell,
    metalness: spec.matte ? 0.1 : 0.9,
    roughness: spec.rough,
    clearcoat: spec.matte ? 0 : 0.2,
  });
  const t = 0.014;
  const base = new THREE.Mesh(rbox(spec.w, t, spec.d, 0.006), shellMat);
  base.position.y = t / 2;
  g.add(base);

  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.w * 0.88, spec.d * 0.46),
    new THREE.MeshStandardMaterial({ map: keyboardTexture(spec.keysDark), roughness: 0.8 })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, t + 0.0006, -spec.d * 0.14);
  g.add(deck);
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.w * 0.36, spec.d * 0.26),
    new THREE.MeshStandardMaterial({ color: spec.shell, roughness: 0.25, metalness: spec.matte ? 0 : 0.6 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, t + 0.0007, spec.d * 0.3);
  g.add(pad);

  const hinge = new THREE.Group();
  hinge.position.set(0, t, -spec.d / 2 + 0.004);
  hinge.rotation.x = -spec.angle;
  const lidH = spec.d * 0.96;
  const lid = new THREE.Mesh(rbox(spec.w, lidH, 0.007, 0.004), shellMat);
  lid.position.set(0, lidH / 2, -0.0035);
  hinge.add(lid);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * 0.97, lidH * 0.97), mats.blackGloss);
  bezel.position.set(0, lidH / 2, 0.0002);
  hinge.add(bezel);
  const screenTex = screenTexture(spec.screen);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * 0.9, lidH * 0.84), screenMat);
  screen.position.set(0, lidH / 2 + lidH * 0.02, 0.0005);
  hinge.add(screen);
  g.add(hinge);

  g.userData.screenMat = screenMat;
  return g;
}

function buildProps(mats) {
  const g = new THREE.Group();

  const bottle = (x, z, col) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.21, 32),
      new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.4, roughness: 0.35, clearcoat: 0.6 })
    );
    body.position.y = 0.105;
    b.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.035, 24), mats.metalDark);
    cap.position.y = 0.228;
    b.add(cap);
    b.position.set(x, 0.745, z);
    return b;
  };
  g.add(bottle(0.66, -0.3, 0x3d6b58));
  g.add(bottle(-0.62, 0.3, 0xb9bec6));

  const cup = new THREE.Group();
  const paper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.032, 0.11, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.85, side: THREE.DoubleSide })
  );
  paper.position.y = 0.055;
  cup.add(paper);
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0415, 0.037, 0.045, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9, side: THREE.DoubleSide })
  );
  sleeve.position.y = 0.055;
  cup.add(sleeve);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.043, 0.012, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  lid.position.y = 0.114;
  cup.add(lid);
  cup.position.set(-0.05, 0.745, -0.2);
  g.add(cup);

  const phone = new THREE.Mesh(rbox(0.074, 0.008, 0.152, 0.004), mats.blackGloss);
  phone.position.set(0.12, 0.749, 0.26);
  phone.rotation.y = 0.4;
  g.add(phone);

  const notebook = new THREE.Mesh(rbox(0.15, 0.012, 0.21, 0.003), new THREE.MeshStandardMaterial({ color: 0x2f3a47, roughness: 0.8 }));
  notebook.position.set(-0.16, 0.752, 0.24);
  notebook.rotation.y = -0.25;
  g.add(notebook);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 12), mats.metal);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  pen.position.set(-0.1, 0.762, 0.2);
  g.add(pen);

  // charging cables running from two laptops off the table edge to the ledge sockets
  const cable = (points) =>
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 60, 0.004, 8, false),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 })
    );
  g.add(cable([[0.3, 0.752, -0.38], [0.2, 0.75, -0.43], [0.16, 0.55, -0.46], [0.1, 0.12, -0.72], [0.05, 0.45, -0.92], [0.02, 0.64, -0.96]]));
  g.add(cable([[-0.3, 0.752, -0.38], [-0.2, 0.75, -0.43], [-0.15, 0.55, -0.46], [-0.1, 0.12, -0.72], [-0.06, 0.45, -0.92], [-0.03, 0.64, -0.96]]));

  return g;
}

/* ------------------------------------------------------------------ */
/* scene                                                               */
/* ------------------------------------------------------------------ */

export function createLabScene(canvasEl) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  // transparent: the section's own sky shows behind the cabin and clouds
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb3d0e8, 9, 30);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);

  // daylight above the clouds: a strong sun, sky fill from above, warm cloud bounce from below
  scene.add(new THREE.HemisphereLight(0xcfe4f6, 0xf1e6d6, 0.9));
  const sun = new THREE.DirectionalLight(0xfff4e2, 3.2);
  sun.position.set(3.5, 6.5, 5.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -3.5;
  sun.shadow.camera.right = 3.5;
  sun.shadow.camera.top = 3;
  sun.shadow.camera.bottom = -3;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);
  const cabinGlow = new THREE.PointLight(0xffe2b8, 1.4, 5, 2);
  cabinGlow.position.set(0, 1.75, -0.4);
  scene.add(cabinGlow);

  const walnutMap = walnutTexture();
  const leatherBump = noiseTexture(256, [128, 128, 128], 60, 21, { srgb: false, repeat: [3, 3] });
  const mats = {
    lining: new THREE.MeshStandardMaterial({ color: 0xefe9df, roughness: 0.85, side: THREE.DoubleSide }),
    panel: new THREE.MeshStandardMaterial({ color: 0xe4dccf, roughness: 0.7 }),
    skin: new THREE.MeshPhysicalMaterial({ color: 0xf6f7f8, roughness: 0.28, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
    structure: new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.9, side: THREE.DoubleSide }),
    carpet: new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 }),
    walnut: new THREE.MeshStandardMaterial({ map: walnutMap, roughness: 0.45 }),
    walnutGloss: new THREE.MeshPhysicalMaterial({ map: walnutMap, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }),
    leather: new THREE.MeshPhysicalMaterial({ color: 0xd9ccb6, roughness: 0.62, sheen: 0.6, sheenColor: 0xfff6e8, sheenRoughness: 0.5, bumpMap: leatherBump, bumpScale: 0.6 }),
    leatherDark: new THREE.MeshPhysicalMaterial({ color: 0x8f7c63, roughness: 0.6, sheen: 0.4, bumpMap: leatherBump, bumpScale: 0.4 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc9c5bd, metalness: 1, roughness: 0.28 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x3b3a38, metalness: 0.9, roughness: 0.4 }),
    bezel: new THREE.MeshStandardMaterial({ color: 0xf2eee7, roughness: 0.45 }),
    shade: new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.8 }),
    blackGloss: new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.15, clearcoat: 1 }),
    coveLight: new THREE.MeshBasicMaterial({ color: 0xffe9c7 }),
  };

  // cabin rides in its own group so it can bob gently in the air
  const cabin = new THREE.Group();
  cabin.add(buildFuselage(mats));
  cabin.add(buildTable(mats));

  const screens = [];
  // two along the far side, one at each end: the near side stays open so the
  // table and screens read through the cutaway
  const places = [
    { x: -0.38, z: -0.78, face: 0, lx: -0.38, lz: -0.29 },
    { x: 0.38, z: -0.78, face: 0, lx: 0.38, lz: -0.29 },
    { x: -1.08, z: 0.02, face: Math.PI / 2, lx: -0.5, lz: 0.06 },
    { x: 1.08, z: 0.02, face: -Math.PI / 2, lx: 0.5, lz: -0.02 },
  ];
  places.forEach((p, i) => {
    const seat = buildSeat(mats);
    seat.position.set(p.x, 0, p.z);
    seat.rotation.y = p.face + (i % 2 ? 0.06 : -0.05);
    cabin.add(seat);

    const laptop = buildLaptop(LAPTOPS[i], mats);
    laptop.position.set(p.lx, 0.742, p.lz);
    // screen looks back at its owner, so it faces away from the seat's front
    laptop.rotation.y = p.face + Math.PI + (i % 2 ? -0.1 : 0.12);
    cabin.add(laptop);
    screens.push(laptop.userData.screenMat);
  });
  cabin.add(buildProps(mats));

  cabin.traverse((o) => {
    if (o.isMesh && !(o.material instanceof THREE.MeshBasicMaterial)) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(cabin);

  // clouds: a deck below, banks behind, a few passing in the foreground
  const cloudTextures = [cloudTexture(4), cloudTexture(9), cloudTexture(17)];
  const clouds = [];
  const r = rng(42);
  const addCloud = (x, y, z, s, opacity = 0.95) => {
    const m = new THREE.SpriteMaterial({
      map: cloudTextures[Math.floor(r() * cloudTextures.length)],
      transparent: true,
      depthWrite: false,
      opacity,
      fog: true,
    });
    const sp = new THREE.Sprite(m);
    sp.position.set(x, y, z);
    sp.scale.set(s * (1.4 + r() * 0.6), s, 1);
    sp.userData.speed = 0.12 + r() * 0.2;
    scene.add(sp);
    clouds.push(sp);
  };
  for (let i = 0; i < 26; i++) addCloud(-16 + r() * 32, -2.2 - r() * 2.2, -8 + r() * 14, 3 + r() * 3.5);
  for (let i = 0; i < 12; i++) addCloud(-18 + r() * 36, -0.5 + r() * 3.5, -9 - r() * 6, 4 + r() * 4, 0.85);
  for (let i = 0; i < 5; i++) addCloud(-12 + r() * 24, -1.6 + r() * 0.8, 3.5 + r() * 2.5, 1.8 + r() * 1.6, 0.7);

  // camera: an elevated three-quarter view into the cutaway; scroll pans
  // along the table, drag adds a little on top
  let yaw = -0.3;
  let scrollT = 0;
  let dragging = false;
  let lastX = 0;
  let dragOffset = 0;
  let targetDragOffset = 0;

  const onDown = (e) => {
    dragging = true;
    lastX = e.touches ? e.touches[0].clientX : e.clientX;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    targetDragOffset = THREE.MathUtils.clamp(targetDragOffset + (x - lastX) * 0.003, -0.35, 0.35);
    lastX = x;
  };
  const onUp = () => {
    dragging = false;
  };
  canvasEl.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  function setState({ scrollT: t }) {
    if (typeof t === "number") scrollT = t;
  }

  let viewRadius = 8.4;
  let raf = null;
  let running = true;
  let last = performance.now();
  let elapsed = 0;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;

    const targetYaw = THREE.MathUtils.lerp(-0.38, 0.38, scrollT);
    yaw += (targetYaw - yaw) * Math.min(dt * 2.5, 1);
    dragOffset += (targetDragOffset - dragOffset) * Math.min(dt * 4, 1);
    const a = yaw + dragOffset;
    const radius = viewRadius;
    camera.position.set(Math.sin(a) * radius, 3.1 + Math.sin(elapsed * 0.3) * 0.03, Math.cos(a) * radius + 0.3);
    camera.lookAt(0, 0.55, -0.2);

    // light turbulence: the whole section breathes up and down
    cabin.position.y = Math.sin(elapsed * 0.8) * 0.012;
    cabin.rotation.x = Math.sin(elapsed * 0.55) * 0.003;
    cabin.rotation.z = Math.sin(elapsed * 0.43) * 0.004;

    clouds.forEach((c) => {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 20) c.position.x = -20;
    });

    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole section in frame on narrow screens
    const aspect = w / h;
    camera.fov = aspect < 1.3 ? 40 : 30;
    // back the camera off on narrow stages so both ends of the cabin stay in frame
    viewRadius = aspect < 1.3 ? THREE.MathUtils.clamp(8.4 * (1.22 / Math.max(aspect, 0.6)), 8.4, 13) : 8.4;
    camera.updateProjectionMatrix();
  }

  function setRunning(v) {
    if (v && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!v && running) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    }
  }

  raf = requestAnimationFrame(frame);

  function dispose() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    canvasEl.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const list = Array.isArray(o.material) ? o.material : [o.material];
        list.forEach((m) => {
          ["map", "bumpMap", "emissiveMap"].forEach((k) => m[k]?.dispose());
          m.dispose();
        });
      }
    });
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  }

  return { resize, setRunning, setState, dispose };
}
