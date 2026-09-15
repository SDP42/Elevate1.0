/* Paints the intro's sky plates once, on the GPU, then hands them back as
   blob URLs so the page can use them like ordinary images. Three plates:

   hero   — open sky over a sea of cloud, seen through the cabin window
   strip  — a horizontally tileable band of wisps that drifts as a marquee
   about  — deep blue with diagonal cirrus, behind the brief

   Rendering once (instead of per frame) keeps scrolling cheap: the scroll
   timeline only ever moves and scales finished bitmaps. */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform int uMode;
uniform float uSeed;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed * 0.013);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// value noise; per > 0 wraps the lattice in x so the result tiles
float noise(vec2 p, float per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 i1 = i + vec2(1.0, 0.0);
  vec2 i2 = i + vec2(0.0, 1.0);
  vec2 i3 = i + vec2(1.0, 1.0);
  if (per > 0.0) {
    i.x = mod(i.x, per);
    i1.x = mod(i1.x, per);
    i2.x = mod(i2.x, per);
    i3.x = mod(i3.x, per);
  }
  float a = hash(i);
  float b = hash(i1);
  float c = hash(i2);
  float d = hash(i3);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, float per) {
  float s = 0.0;
  float amp = 0.5;
  for (int k = 0; k < 7; k++) {
    s += amp * noise(p, per);
    p = p * 2.0 + vec2(17.0, 9.1);   // whole-number x shift keeps tiling
    if (per > 0.0) per *= 2.0;
    amp *= 0.5;
  }
  return s;
}

vec3 heroSky(vec2 uv) {
  float a = uRes.x / uRes.y;
  float h = 0.34;                       // horizon, as a share of the plate
  vec3 top = vec3(0.34, 0.60, 0.86);
  vec3 low = vec3(0.80, 0.87, 0.95);
  vec3 haze = vec3(0.93, 0.89, 0.94);

  if (uv.y < h) {
    float t = uv.y / h;
    vec3 col = mix(top, low, pow(t, 1.5));
    vec2 q = vec2(uv.x * a * 2.4, uv.y * 4.2);
    float warp = fbm(q + vec2(3.1, 7.7), 0.0);
    float n = fbm(q * vec2(1.0, 2.2) * 1.6 + warp * 1.1, 0.0);
    float wisp = smoothstep(0.46, 0.86, n) * (0.25 + 0.75 * (1.0 - t));
    col = mix(col, vec3(0.98, 0.99, 1.0), wisp * 0.9);
    col = mix(col, haze, exp(-pow((h - uv.y) / 0.05, 2.0)) * 0.85);
    return col;
  }

  // below the horizon: a cloud deck projected onto a ground plane
  float d = uv.y - h;
  float z = 0.05 / (d + 0.004);
  vec2 wp = vec2((uv.x - 0.5) * a * z * 22.0, z * 15.0);
  vec2 off = vec2(11.0, 5.0);
  float far = exp(-d * 9.0);
  // far off the lattice is finer than a pixel: let detail melt into haze
  float detailW = 0.3 * (1.0 - smoothstep(0.25, 0.8, far));
  float base = fbm(wp + off, 0.0);
  float det = fbm(wp * 3.7 + off * 1.7, 0.0);
  float c = mix(base, det, detailW);
  // same field one step toward the horizon: lit faces are the ones rising
  vec2 wl = wp + vec2(0.0, 0.22);
  float cl = mix(fbm(wl + off, 0.0), fbm(wl * 3.7 + off * 1.7, 0.0), detailW);
  float cover = smoothstep(0.33, 0.52, c);
  float lit = clamp((c - cl) * 6.0 + 0.62, 0.0, 1.0);
  float body = smoothstep(0.40, 0.75, c);

  vec3 litCol = mix(vec3(1.0, 0.975, 0.975), vec3(0.99, 0.88, 0.93), far * 0.85);
  vec3 shadowCol = mix(vec3(0.50, 0.64, 0.86), vec3(0.80, 0.78, 0.91), far);
  vec3 gap = mix(vec3(0.20, 0.45, 0.78), vec3(0.74, 0.76, 0.91), far);

  vec3 cloud = mix(shadowCol, litCol, lit * (0.55 + 0.45 * body));
  vec3 col = mix(gap, cloud, cover);
  col = mix(col, haze, exp(-d * 34.0) * 0.9);
  // the lower plate deepens toward the blue the next section starts on
  col = mix(col, vec3(0.13, 0.40, 0.72), smoothstep(0.55, 1.0, uv.y) * 0.45);
  return col;
}

vec4 cloudStrip(vec2 uv) {
  float a = uRes.x / uRes.y;
  float per = 5.0;
  vec2 q = vec2(uv.x * per, uv.y * per / a * 2.2);
  // warp only in y: shifting x by a non-integer would break the tiling
  float warp = fbm(q + vec2(0.0, 4.0), per);
  float n = fbm(q + vec2(0.0, warp * 0.9), per);
  // soft, denser toward the lower middle of the band, where it veils the window
  float band = smoothstep(0.0, 0.45, uv.y) * smoothstep(1.0, 0.62, uv.y);
  float alpha = smoothstep(0.36, 0.72, n) * band;
  vec3 col = mix(vec3(0.84, 0.90, 0.97), vec3(1.0), smoothstep(0.45, 0.7, n));
  alpha *= 0.8;
  return vec4(col * alpha, alpha);
}

vec3 aboutSky(vec2 uv) {
  float a = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * a, uv.y);
  float ang = 0.52;                       // streaks fall left to right
  mat2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 s = r * p;
  float warp = fbm(s * vec2(2.0, 5.0) + vec2(4.0, 1.0), 0.0);
  float n = fbm(vec2(s.x * 1.6 + warp * 0.6, s.y * 11.0 + warp * 1.4), 0.0);
  float streak = smoothstep(0.5, 0.9, n);
  float veil = smoothstep(0.35, 0.8, fbm(s * 3.0 + vec2(9.0), 0.0));
  vec3 base = mix(vec3(0.16, 0.45, 0.80), vec3(0.42, 0.68, 0.91), clamp(uv.x * 0.5 + (1.0 - uv.y) * 0.25, 0.0, 1.0));
  vec3 col = mix(base, vec3(0.86, 0.92, 0.98), veil * 0.28);
  col = mix(col, vec3(0.97, 0.98, 1.0), streak * 0.85);
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  if (uMode == 0) gl_FragColor = vec4(heroSky(uv), 1.0);
  else if (uMode == 1) gl_FragColor = cloudStrip(uv);
  else gl_FragColor = vec4(aboutSky(uv), 1.0);
}
`;

const MODES = { hero: 0, strip: 1, about: 2 };

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log || "shader compile failed");
  }
  return sh;
}

function toBlobUrl(canvas, type) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : ""), type, 0.9);
  });
}

/* plates: { name: { mode: "hero" | "strip" | "about", width, height } } */
export async function paintSky(plates) {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return {};

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uMode = gl.getUniformLocation(prog, "uMode");
  const uSeed = gl.getUniformLocation(prog, "uSeed");
  const max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);

  const out = {};
  for (const [name, plate] of Object.entries(plates)) {
    const w = Math.max(2, Math.min(max, Math.round(plate.width)));
    const h = Math.max(2, Math.min(max, Math.round(plate.height)));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, w, h);
    gl.uniform1i(uMode, MODES[plate.mode]);
    gl.uniform1f(uSeed, plate.seed ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    out[name] = await toBlobUrl(canvas, plate.mode === "strip" ? "image/png" : "image/jpeg");
  }

  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return out;
}
