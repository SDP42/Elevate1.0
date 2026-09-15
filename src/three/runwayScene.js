import * as THREE from "three";
import { range } from "../hooks/useScrollProgress";
import { TOUCHDOWN } from "../landing";
import { cloudSpriteTexture } from "./textures";

/* Three aircraft on final approach, built from primitive geometry so they
   read as real 3D shapes — not a flat top-view icon — from any angle. The
   camera itself is the "front view / back view" the flat version couldn't
   give: low and looking down the runway as they come in, then rising and
   swinging round to an elevated view over their tails once they've landed
   and the podium lights come up. */

const LANES = [
  { key: "second", x: -1.55, size: 0.86, metal: 0xc7cdd6 },
  { key: "first", x: 0, size: 1, metal: 0xe8c877 },
  { key: "third", x: 1.55, size: 0.86, metal: 0xcf9a6b },
];

/* Deterministic pseudo-random so the weathering is stable across renders
   without needing to store the texture. */
function makeRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function runwayTexture(designator, seed) {
  const w = 128;
  const h = 1024;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const rand = makeRand(seed);

  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#0d0e10");
  g.addColorStop(0.12, "#282b2f");
  g.addColorStop(0.5, "#34383d");
  g.addColorStop(0.88, "#24272b");
  g.addColorStop(1, "#0d0e10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // resurfacing patches and asphalt grain — real runway asphalt is never a
  // flat tone
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(${20 + rand() * 20},${20 + rand() * 20},${22 + rand() * 20},${0.15 + rand() * 0.2})`;
    const pw = 14 + rand() * 40;
    const ph = 30 + rand() * 90;
    ctx.fillRect(rand() * (w - pw), rand() * h, pw, ph);
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.12})`;
    ctx.fillRect(rand() * w, rand() * h, 1, 1);
  }

  // tyre rubber deposits in the touchdown zone (near, high-y end)
  ctx.fillStyle = "rgba(6,7,8,0.4)";
  ctx.beginPath();
  ctx.ellipse(38, h - 380, 10, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w - 38, h - 380, 10, 130, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(216,220,224,0.5)";
  ctx.fillRect(6, 0, 3, h);
  ctx.fillRect(w - 9, 0, 3, h);
  for (let y = 20; y < h - 40; y += 46) {
    ctx.fillRect(w / 2 - 2, y, 4, 24);
  }
  // touchdown zone bars near the bottom (camera-near) end
  ctx.fillStyle = "rgba(236,239,242,0.6)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(18, h - 90 - i * 50, 9, 30);
    ctx.fillRect(w - 27, h - 90 - i * 50, 9, 30);
  }
  ctx.save();
  ctx.translate(w / 2, h - 160);
  ctx.rotate(Math.PI);
  ctx.fillStyle = "rgba(236,239,242,0.7)";
  ctx.font = "700 46px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(designator, 0, 0);
  ctx.restore();

  // length-wise wear: darkest at the touchdown zone, fading toward the
  // far end where it dissolves into haze
  const wear = ctx.createLinearGradient(0, 0, 0, h);
  wear.addColorStop(0, "rgba(0,0,0,0.3)");
  wear.addColorStop(0.55, "rgba(0,0,0,0)");
  wear.addColorStop(0.82, "rgba(0,0,0,0)");
  wear.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function grassTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, "#556b41");
  g.addColorStop(1, "#3c4d2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const rand = makeRand(11);
  for (let i = 0; i < 2200; i++) {
    const shade = rand() * 40 - 20;
    ctx.fillStyle = `rgba(${74 + shade},${94 + shade},${58 + shade},${0.25 + rand() * 0.35})`;
    const x = rand() * s;
    const y = rand() * s;
    ctx.fillRect(x, y, 1.4, 4 + rand() * 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildPlane(metalColor) {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.3, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.4, metalness: 0.3 });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.15, 6, 12), body);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 12), body);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = 0.72;
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), dark);
  cockpit.rotation.x = Math.PI;
  cockpit.position.set(0, 0.08, 0.48);
  group.add(cockpit);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 0.42), body);
  wing.position.set(0, -0.02, -0.05);
  group.add(wing);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.3), body);
  tailFin.position.set(0, 0.22, -0.55);
  tailFin.rotation.z = 0.1;
  group.add(tailFin);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.22), body);
  tailWing.position.set(0, 0.03, -0.56);
  group.add(tailWing);

  const engineGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.28, 12);
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(engineGeo, dark);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.52, -0.16, -0.02);
    group.add(engine);
  }

  // cabin windows: a row of small dark ovals along each side, the detail
  // that reads as "real aircraft" rather than a toy silhouette
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x10171c, roughness: 0.25, metalness: 0.1 });
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), windowMat);
      win.position.set(side * 0.158, 0.05, 0.32 - i * 0.13);
      win.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(win);
    }
  }

  // anti-collision beacon on top of the fuselage
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 2.4 })
  );
  beacon.position.set(0, 0.17, -0.1);
  group.add(beacon);
  group.userData.beacon = beacon.material;

  // gear, only meaningful near the ground — cheap enough to always draw
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x100e0c, roughness: 0.6 });
  for (const [x, z] of [[0, 0.35], [-0.14, -0.2], [0.14, -0.2]]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 6), strutMat);
    strut.position.set(x, -0.24, z);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.02, 6, 10), strutMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, -0.33, z);
    group.add(wheel);
  }

  const nav = (color, x) => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 }));
    light.position.set(x, -0.01, -0.05);
    group.add(light);
  };
  nav(0xff4d4d, -0.86);
  nav(0x3dff8c, 0.86);

  return group;
}

function flightPath(t) {
  if (t <= TOUCHDOWN) {
    const u = t / TOUCHDOWN;
    return {
      z: THREE.MathUtils.lerp(-16, -1.5, u),
      alt: 3.4 * (1 - u) * (1 - u),
      flare: range(u, 0.7, 1) * (1 - range(u, 0.97, 1)),
      air: 1 - u,
    };
  }
  const u = (t - TOUCHDOWN) / (1 - TOUCHDOWN);
  const ease = 1 - (1 - u) * (1 - u);
  return {
    z: THREE.MathUtils.lerp(-1.5, 0.7, ease),
    alt: 0,
    flare: 0,
    air: 0,
  };
}

export function createRunwayScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9fb894, 10, 34);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);

  scene.add(new THREE.HemisphereLight(0xbfe0f4, 0x2a3a24, 1.0));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.1);
  sun.position.set(-4, 6, 3);
  scene.add(sun);

  const groundMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const lanes = LANES.map((lane) => {
    const g = new THREE.Group();
    g.position.x = lane.x;
    scene.add(g);

    const designator = lane.key === "first" ? "24C" : lane.key === "second" ? "24L" : "24R";
    const rwMat = new THREE.MeshStandardMaterial({ map: runwayTexture(designator, Math.abs(lane.x * 1000) + 7), roughness: 0.9 });
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 18), rwMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0, -8);
    g.add(runway);

    // edge lights
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffd27a, emissiveIntensity: 0 });
    const lamps = [];
    for (let i = 0; i < 10; i++) {
      for (const side of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), lampMat.clone());
        lamp.position.set(side * 0.47, 0.03, -1 - i * 1.7);
        g.add(lamp);
        lamps.push(lamp);
      }
    }

    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5 * lane.size, 24), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    g.add(shadow);

    const plane = buildPlane(lane.metal);
    plane.scale.setScalar(lane.size);
    g.add(plane);

    const podiumMat = new THREE.MeshBasicMaterial({ color: lane.metal, transparent: true, opacity: 0 });
    const podium = new THREE.Mesh(new THREE.CircleGeometry(0.9 * lane.size, 32), podiumMat);
    podium.rotation.x = -Math.PI / 2;
    podium.position.set(0, 0.01, 0.55);
    g.add(podium);

    const puffMat = new THREE.SpriteMaterial({ map: cloudSpriteTexture(128), color: 0xe8e8e8, transparent: true, opacity: 0, depthWrite: false });
    const puff = new THREE.Sprite(puffMat);
    puff.position.set(0, 0.15, -1.2);
    puff.scale.setScalar(0.9);
    g.add(puff);

    return { plane, lamps, podiumMat, puffMat, shadow, shadowMat, size: lane.size };
  });

  let state = { t: 0 };
  function setState(next) {
    state = { ...state, ...next };
  }

  let raf = null;
  let running = true;
  const clock = new THREE.Clock();
  let camPos = new THREE.Vector3(0, 1.3, 4.2);
  let camTarget = new THREE.Vector3(0, 1, -6);

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    const t = state.t ?? 0;
    const f = flightPath(t);
    const roll = f.air * 6 * Math.sin(t * 16);
    const settle = range(t, TOUCHDOWN + 0.06, 0.96);
    const puffT = range(t, TOUCHDOWN - 0.01, TOUCHDOWN + 0.05) * (1 - range(t, TOUCHDOWN + 0.05, TOUCHDOWN + 0.22));
    const lit = settle;

    const beaconOn = Math.sin(clock.elapsedTime * 6) > 0.3 ? 2.4 : 0.2;

    lanes.forEach(({ plane, lamps, podiumMat, puffMat, shadow, shadowMat, size }) => {
      plane.position.set(0, f.alt * size, f.z);
      plane.rotation.z = THREE.MathUtils.degToRad(roll);
      plane.rotation.x = THREE.MathUtils.degToRad(-f.flare * 7);
      plane.userData.beacon && (plane.userData.beacon.emissiveIntensity = beaconOn);

      shadow.position.set(0, 0.005, f.z);
      shadowMat.opacity = THREE.MathUtils.lerp(0.4, 0.05, Math.min(f.alt / 3.4, 1)) * size;

      lamps.forEach((lamp, i) => {
        const start = (i / lamps.length) * 0.7;
        const on = 0.2 + 0.8 * range(lit, start, start + 0.3);
        lamp.material.emissiveIntensity = on * 1.4;
      });

      podiumMat.opacity = settle * 0.75;
      puffMat.opacity = puffT * 0.8;
      puffMat.rotation += dt * 0.15;
    });

    // camera: low, front-on to the incoming traffic while airborne; rises
    // and swings to an elevated view over the tails once everyone's down
    // both camera positions stay on the same side of the aircraft (the
    // threshold/near side) so a lane's left-right screen position never
    // flips — the DOM place labels below are in fixed left/centre/right
    // order and must keep matching whichever plane is actually there
    const frontPos = new THREE.Vector3(0.3, 1.15, 4.4);
    const frontTarget = new THREE.Vector3(0, 1, -8);
    const rearPos = new THREE.Vector3(0, 4.4, 5.8);
    const rearTarget = new THREE.Vector3(0, 0.25, -1.2);
    const blend = THREE.MathUtils.smoothstep(settle, 0, 1);
    const desiredPos = frontPos.clone().lerp(rearPos, blend);
    const desiredTarget = frontTarget.clone().lerp(rearTarget, blend);

    camPos.lerp(desiredPos, Math.min(dt * 1.6, 1));
    camTarget.lerp(desiredTarget, Math.min(dt * 1.6, 1));
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    renderer.render(scene, camera);
  }

  function resize(w, h) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setRunning(v) {
    if (v && !running) {
      running = true;
      clock.getDelta();
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
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    renderer.dispose();
  }

  return { resize, setState, setRunning, dispose };
}
