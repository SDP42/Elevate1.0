import * as THREE from "three";
import { codeScreenTexture } from "./textures";

/* A team of four at a shared table, mid-hackathon, inside the fuselage.
   Built entirely from primitive geometry. Scrolling through the section
   pans the camera from one end of the table to the other; dragging looks
   around freely on top of that. */

const SEAT_Z = [-0.72, 0.72];
const SEAT_X = [-0.82, 0.82];

function buildChair(facing) {
  const group = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.55, metalness: 0.25 });
  const cushion = new THREE.MeshStandardMaterial({ color: 0x3a2f22, roughness: 0.75 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.44), cushion);
  seat.position.y = 0.46;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.07), cushion);
  back.position.set(0, 0.73, -0.19 * facing);
  group.add(back);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), frame);
  post.position.y = 0.24;
  group.add(post);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 5), frame);
  base.position.y = 0.03;
  group.add(base);

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

  const shellMat = new THREE.MeshStandardMaterial({ color: 0xdccdae, roughness: 0.92, side: THREE.BackSide });
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 8, 32, 1, true, Math.PI * 0.1, Math.PI * 1.8),
    shellMat
  );
  shell.rotation.z = Math.PI / 2;
  group.add(shell);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.7, metalness: 0.05 });
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0x14120f, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 40);

  scene.add(new THREE.HemisphereLight(0xbfe0f4, 0x3a2f1c, 0.85));
  const warm = new THREE.PointLight(0xffdca0, 9, 12, 2);
  warm.position.set(0, 2.4, 0);
  scene.add(warm);
  const key = new THREE.DirectionalLight(0xfff6e6, 0.7);
  key.position.set(2, 3, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ea, 0.35);
  rim.position.set(-2, 1.5, -3);
  scene.add(rim);

  scene.add(buildShell());
  scene.add(buildTable());

  const laptopMats = [];
  SEAT_Z.forEach((z) => {
    SEAT_X.forEach((x) => {
      const facing = x < 0 ? 1 : -1;
      const chair = buildChair(facing);
      chair.position.set(x * 1.55, 0, z);
      chair.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(chair);

      const laptop = buildLaptop(codeScreenTexture());
      laptop.position.set(x * 0.66, 0.745, z);
      laptop.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(laptop);
      laptopMats.push(laptop.userData.screenMat);
    });
  });

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
