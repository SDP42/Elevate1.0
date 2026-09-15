import * as THREE from "three";
import { codeScreenTexture } from "./textures";

/* A team of four at a shared table, mid-hackathon, inside the fuselage.
   Built entirely from primitive geometry. Scrolling through the section
   pans the camera from one end of the table to the other; dragging looks
   around freely on top of that. */

const SEAT_Z = [-0.72, 0.72];
const SEAT_X = [-0.82, 0.82];

/* Built in a canonical local frame: backrest always at -Z, the open seating
   side (where a person's knees go, under the table) always at +Z. Left/right
   placement is handled entirely by the caller's rotation.y, so this never
   needs to know which side of the table it's on — one shape, one meaning,
   impossible to mirror incorrectly. */
function buildChair() {
  const group = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.45, metalness: 0.35 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.7 });

  // seat pan, very slightly dished by stacking a thin rim under the cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.46), cushion);
  seat.position.y = 0.46;
  group.add(seat);
  const seatRim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.02, 0.48), frame);
  seatRim.position.y = 0.42;
  group.add(seatRim);

  // tall backrest, reclined slightly away from the seat — unmistakably the
  // back of the chair, opposite the open (table-facing) side
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.08), cushion);
  back.position.set(0, 0.76, -0.22);
  back.rotation.x = 0.1;
  group.add(back);
  const backFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.03), frame);
  backFrame.position.set(0, 0.76, -0.255);
  backFrame.rotation.x = 0.1;
  group.add(backFrame);

  // armrests bridge the seat front to the backrest, reinforcing which way
  // the chair opens
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.4), frame);
    arm.position.set(side * 0.245, 0.58, -0.02);
    group.add(arm);
    const armPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), frame);
    armPost.position.set(side * 0.245, 0.5, 0.14);
    group.add(armPost);
  }

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 10), frame);
  post.position.y = 0.23;
  group.add(post);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), frame);
  hub.position.y = 0.045;
  group.add(hub);

  // five-star base with casters
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.045), frame);
    leg.position.set(Math.cos(a) * 0.14, 0.03, Math.sin(a) * 0.14);
    leg.rotation.y = a;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), frame);
    wheel.position.set(Math.cos(a) * 0.27, 0.02, Math.sin(a) * 0.27);
    group.add(wheel);
  }

  return group;
}

function buildLaptop(codeTex) {
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xdad2bf, roughness: 0.35, metalness: 0.25 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.24), shell);
  base.position.y = 0.009;
  group.add(base);

  const keys = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.004, 0.16), new THREE.MeshStandardMaterial({ color: 0x2b2823, roughness: 0.8 }));
  keys.position.set(0, 0.02, 0.02);
  group.add(keys);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.01, -0.115);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.014), shell);
  lid.position.set(0, 0.12, -0.007);
  lidPivot.add(lid);
  lidPivot.rotation.x = -1.15;
  group.add(lidPivot);

  const screenMat = new THREE.MeshStandardMaterial({
    map: codeTex,
    emissive: 0xffffff,
    emissiveMap: codeTex,
    emissiveIntensity: 1.15,
    roughness: 0.4,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), screenMat);
  screen.position.set(0, 0, 0.008);
  lid.add(screen);

  group.userData.screenMat = screenMat;
  return group;
}

/* Coffee cup — a small prop next to each laptop. */
function buildCup() {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.35 });
  const coffee = new THREE.MeshStandardMaterial({ color: 0x3d2a1c, roughness: 0.3 });

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.045, 14), ceramic);
  cup.position.y = 0.0225;
  group.add(cup);
  const brew = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 14), coffee);
  brew.position.y = 0.046;
  group.add(brew);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 6, 12), ceramic);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.03, 0.022, 0);
  group.add(handle);

  return group;
}

/* A can — stands in for the energy drinks that keep a hackathon table
   running past 3am. */
function buildCan(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.1, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 })
  );
  body.position.y = 0.05;
  group.add(body);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.028, 0.006, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.3, metalness: 0.8 })
  );
  top.position.y = 0.103;
  group.add(top);
  return group;
}

/* Pizza box, lid propped half-open the way it always ends up by hour six. */
function buildPizzaBox() {
  const group = new THREE.Group();
  const card = new THREE.MeshStandardMaterial({ color: 0xcf9a56, roughness: 0.9 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.34), card);
  base.position.y = 0.0125;
  group.add(base);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.17, 0.02, 0);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.34), card);
  lid.position.set(0.17, 0, 0);
  lidPivot.add(lid);
  lidPivot.rotation.z = 0.75;
  group.add(lidPivot);

  // a couple of slices left, dark pepperoni specks on pale cheese
  const sliceMat = new THREE.MeshStandardMaterial({ color: 0xe8c878, roughness: 0.8 });
  for (const [x, z] of [[-0.06, -0.06], [0.07, 0.08]]) {
    const slice = new THREE.Mesh(new THREE.CircleGeometry(0.08, 3), sliceMat);
    slice.rotation.x = -Math.PI / 2;
    slice.rotation.z = Math.random() * Math.PI;
    slice.position.set(x, 0.027, z);
    group.add(slice);
  }

  return group;
}

/* Freestanding whiteboard: the problem statement, sketched out. Built as a
   flat panel on two legs rather than wall-mounted, since the fuselage shell
   is a continuous curve with nowhere flat to hang it. */
function buildWhiteboard() {
  const group = new THREE.Group();

  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#2a6f97";
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 140, 70);
  ctx.strokeRect(230, 30, 150, 60);
  ctx.beginPath();
  ctx.moveTo(164, 58);
  ctx.lineTo(226, 58);
  ctx.lineTo(214, 50);
  ctx.moveTo(226, 58);
  ctx.lineTo(214, 66);
  ctx.stroke();
  ctx.strokeStyle = "#c1442d";
  ctx.beginPath();
  ctx.moveTo(90, 94);
  ctx.lineTo(90, 150);
  ctx.lineTo(305, 150);
  ctx.stroke();
  ctx.fillStyle = "#333";
  ctx.font = "700 26px Arial";
  ctx.fillText("PS-07 · Elevate 1.0", 28, 200);
  ctx.font = "16px Arial";
  ctx.fillStyle = "#555";
  ctx.fillText("api -> queue -> worker -> db", 28, 232);
  ctx.fillText("edge cases: retry, backoff, dedupe", 28, 258);
  ctx.strokeStyle = "#2a9d5c";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(360 + i * 30, 220, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), boardMat);
  board.position.y = 1.1;
  group.add(board);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb9ad96, roughness: 0.6, metalness: 0.2 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.76, 0.03), frameMat);
  frame.position.y = 1.1;
  frame.position.z = -0.02;
  group.add(frame);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a7f6a, roughness: 0.5, metalness: 0.3 });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 8), legMat);
    leg.position.set(side * 0.48, 0.68, 0);
    leg.rotation.z = side * 0.06;
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 8), legMat);
    foot.position.set(side * 0.56, 0.01, 0);
    group.add(foot);
  }

  return group;
}

function buildTable() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.5, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2722, roughness: 0.4, metalness: 0.6 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 2.5), wood);
  top.position.y = 0.72;
  group.add(top);

  const edge = new THREE.Mesh(new THREE.BoxGeometry(1.19, 0.03, 2.54), metal);
  edge.position.y = 0.695;
  group.add(edge);

  for (const [x, z] of [
    [-0.5, -1.1],
    [0.5, -1.1],
    [-0.5, 1.1],
    [0.5, 1.1],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 10), metal);
    leg.position.set(x, 0.35, z);
    group.add(leg);
  }

  return group;
}

function buildShell() {
  const group = new THREE.Group();

  const shellMat = new THREE.MeshStandardMaterial({ color: 0xece1c8, roughness: 0.9, side: THREE.BackSide });
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 8, 32, 1, true, Math.PI * 0.1, Math.PI * 1.8),
    shellMat
  );
  shell.rotation.z = Math.PI / 2;
  group.add(shell);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x9c8f74, roughness: 0.7, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  group.add(floor);

  // portholes down both sides, evenly spaced, facing inward
  const winMat = new THREE.MeshStandardMaterial({ color: 0xcfe7f5, emissive: 0x8fc7ea, emissiveIntensity: 0.7, roughness: 0.3 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xcbb98e, roughness: 0.4, metalness: 0.4 });
  for (let i = -1; i <= 1; i++) {
    for (const side of [-1, 1]) {
      const cx = i * 1.6;
      const cz = side * 3.55;
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), winMat);
      win.position.set(cx, 1.35, cz);
      win.rotation.y = side < 0 ? 0 : Math.PI;
      group.add(win);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 24), ringMat);
      ring.position.set(cx, 1.35, cz + side * -0.01);
      ring.rotation.y = side < 0 ? 0 : Math.PI;
      group.add(ring);
    }
  }

  // ceiling strip lights above the table
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xfff3d6, emissiveIntensity: 1.2 });
  for (let i = -1; i <= 1; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 1.4), lightMat);
    strip.position.set(i * 1.1, 2.7, 0);
    group.add(strip);
  }

  return group;
}

export function createLabScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  // bright, daylit cabin to match the Hero window — this is the same plane,
  // just later in the flight, not a moody night scene
  // transparent: the section's sky shows around the cabin shell
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 40);

  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x8a7a5c, 1.5));
  const warm = new THREE.PointLight(0xfff0d2, 11, 14, 2);
  warm.position.set(0, 2.4, 0);
  scene.add(warm);
  const key = new THREE.DirectionalLight(0xfffaf0, 1.3);
  key.position.set(2, 3.5, 2.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe7f5, 0.6);
  rim.position.set(-2, 1.5, -3);
  scene.add(rim);

  scene.add(buildShell());
  scene.add(buildTable());

  const laptopMats = [];
  SEAT_Z.forEach((z) => {
    SEAT_X.forEach((x) => {
      // chair's local +Z (the open, seating side) rotates to face the
      // table centre on both sides — see buildChair's canonical frame
      const facingRotation = x < 0 ? Math.PI / 2 : -Math.PI / 2;

      const chair = buildChair();
      chair.position.set(x * 1.28, 0, z);
      chair.rotation.y = facingRotation;
      scene.add(chair);

      // the laptop shares the chair's position on the table's radius, but
      // faces the OPPOSITE way: a laptop's screen looks back at whoever's
      // sitting behind its keyboard, not out toward the table centre, so
      // it needs the reverse of the chair's own facing
      const laptop = buildLaptop(codeScreenTexture());
      laptop.position.set(x * 0.66, 0.745, z);
      laptop.rotation.y = facingRotation + Math.PI;
      scene.add(laptop);
      laptopMats.push(laptop.userData.screenMat);

      const cup = buildCup();
      cup.position.set(x * 0.66, 0.745, z + (z < 0 ? -0.14 : 0.14));
      scene.add(cup);
    });
  });

  // a can at two of the four spots, snacks at the middle of the table —
  // the table is empty there since the seats and laptops sit further out
  const canColors = [0xd6473c, 0x2f8f5b];
  [-0.72, 0.72].forEach((z, i) => {
    const can = buildCan(canColors[i]);
    can.position.set(0.16, 0.745, z);
    scene.add(can);
  });

  const pizza = buildPizzaBox();
  pizza.position.set(-0.15, 0.745, 0);
  pizza.rotation.y = 0.3;
  scene.add(pizza);

  const whiteboard = buildWhiteboard();
  whiteboard.position.set(0, 0, -1.55);
  scene.add(whiteboard);

  // camera: starts near one end of the table at a 3/4 elevated angle so the
  // whole team-of-four layout reads in one shot; scroll pans it down the
  // table's length, drag nudges it further
  let yaw = -0.35;
  let targetYaw = -0.35;
  let scrollT = 0;
  let dragging = false;
  let lastX = 0;
  let dragOffset = 0;
  let targetDragOffset = 0;

  function onDown(e) {
    dragging = true;
    lastX = e.touches ? e.touches[0].clientX : e.clientX;
  }
  function onMove(e) {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - lastX;
    lastX = x;
    targetDragOffset = THREE.MathUtils.clamp(targetDragOffset + dx * 0.003, -0.3, 0.3);
  }
  function onUp() {
    dragging = false;
  }
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  function setState({ scrollT: t }) {
    if (typeof t === "number") scrollT = t;
  }

  let raf = null;
  let running = true;
  const clock = new THREE.Clock();

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    targetYaw = THREE.MathUtils.lerp(-0.5, 0.5, scrollT);
    yaw += (targetYaw - yaw) * Math.min(dt * 2.5, 1);
    dragOffset += (targetDragOffset - dragOffset) * Math.min(dt * 4, 1);

    const totalYaw = yaw + dragOffset;
    const radius = 3.4;
    camera.position.set(Math.sin(totalYaw) * radius, 1.55, Math.cos(totalYaw) * radius);
    camera.lookAt(0, 0.55, 0);

    laptopMats.forEach((m, i) => {
      m.emissiveIntensity = 1.05 + Math.sin(clock.elapsedTime * 1.3 + i * 1.7) * 0.15;
    });

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
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          if (m.emissiveMap) m.emissiveMap.dispose();
          m.dispose();
        });
      }
    });
    renderer.dispose();
  }

  return { resize, setRunning, setState, dispose };
}
