import * as THREE from "three";

/* Small canvas-drawn textures so the 3D scenes need no external image
   assets — everything is generated at runtime and cached on the GPU. */

export function radialGlowTexture(size = 128, inner = "#ffffff", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/* Puffy-cloud alpha sprite: a handful of overlapping soft blobs so a single
   billboard reads as a cloud rather than a perfect circle. */
export function cloudSpriteTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const blobs = [
    [0.5, 0.55, 0.34],
    [0.32, 0.6, 0.24],
    [0.68, 0.6, 0.24],
    [0.4, 0.42, 0.22],
    [0.62, 0.44, 0.2],
  ];
  for (const [bx, by, br] of blobs) {
    const g = ctx.createRadialGradient(
      bx * size,
      by * size,
      0,
      bx * size,
      by * size,
      br * size
    );
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.7, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx * size, by * size, br * size, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/* A little syntax-highlighted-looking code block for laptop screens in the
   coding-room scene — rows of coloured bars standing in for text. */
export function codeScreenTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size * 0.62;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0d1b26";
  ctx.fillRect(0, 0, c.width, c.height);

  const palette = ["#8ff0a8", "#7fd0ea", "#f2c85b", "#e888c2", "#efe7d8"];
  let y = 22;
  let seedLocal = 7;
  const rand = () => {
    seedLocal = (seedLocal * 9301 + 49297) % 233280;
    return seedLocal / 233280;
  };
  while (y < c.height - 16) {
    const indent = Math.floor(rand() * 4) * 16;
    const width = 40 + rand() * (c.width - indent - 80);
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.85;
    ctx.fillRect(18 + indent, y, width, 10);
    y += 20;
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* Laptop screen decal: brand name resolving out of a typed command line. */
export function screenTexture({ w = 512, h = 320, showName = true, line1 = "", line2 = "", caret = "" } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#274a63");
  g.addColorStop(1, "#0f2536");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (showName) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 56px Orbitron, sans-serif";
    ctx.fillText("ELEVATE 1.0", w / 2, h / 2 - 6);
    ctx.fillStyle = "rgba(223,240,251,0.8)";
    ctx.font = "400 22px Orbitron, sans-serif";
    ctx.letterSpacing = "4px";
    ctx.fillText("24-HOUR HACKATHON", w / 2, h / 2 + 40);
  } else {
    ctx.textAlign = "left";
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "26px 'SF Mono', Menlo, Consolas, monospace";
    ctx.fillText(line1 + (line2 ? "" : caret), 26, h / 2 - 14);
    ctx.fillStyle = "#8ff0a8";
    ctx.fillText(line2 + (line2 ? caret : ""), 26, h / 2 + 24);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* Fasten-seatbelt icon on a dark tile, lit from within when the sign is on. */
export function seatbeltIconTexture(size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2c85b";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#1a1710";
  ctx.lineWidth = size * 0.075;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(size * 0.38, size * 0.34, size * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.24, size * 0.66);
  ctx.lineTo(size * 0.24, size * 0.52);
  ctx.arc(size * 0.38, size * 0.52, size * 0.14, Math.PI, 0);
  ctx.lineTo(size * 0.52, size * 0.66);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.58);
  ctx.lineTo(size * 0.56, size * 0.58);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.72, size * 0.34, size * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.58, size * 0.66);
  ctx.lineTo(size * 0.58, size * 0.52);
  ctx.arc(size * 0.72, size * 0.52, size * 0.14, Math.PI, 0);
  ctx.lineTo(size * 0.86, size * 0.66);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
