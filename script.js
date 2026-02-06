// script.js — GitHub Pages + Import Map compatible

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const qs = (s) => document.querySelector(s);

const state = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  group: null,
  version: 0
};

/* ---------------- INIT VISOR ---------------- */
function initViewer() {
  const container = qs("#ifc-viewer");
  container.innerHTML = "";

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071226);

  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  camera.position.set(40, 20, 60);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 6, 20);
  controls.enableDamping = true;

  scene.add(new THREE.GridHelper(300, 120));
  scene.add(new THREE.AxesHelper(5));

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(40, 80, 20);
  scene.add(dir);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  state.controls = controls;

  qs("#viewer-status").textContent = "Preview activo";
}

/* ---------------- GEOMETRÍA ---------------- */
function addMember(a, b, size, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

  const geo = new THREE.BoxGeometry(size, size, len);
  const mesh = new THREE.Mesh(geo, mat);

  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    dir.normalize()
  );

  state.group.add(mesh);
}

function generateModel() {
  if (!state.scene) initViewer();

  if (state.group) state.scene.remove(state.group);
  state.group = new THREE.Group();
  state.scene.add(state.group);

  const span = +qs("#ind-span").value;
  const length = +qs("#ind-length").value;
  const height = +qs("#ind-height").value;
  const frames = +qs("#ind-frames").value;
  const slope = +qs("#ind-slope").value / 100;
  const roof = qs("#ind-roof").value;

  const half = span / 2;
  const step = length / (frames - 1);

  const matCol = new THREE.MeshStandardMaterial({ color: 0x2563eb });
  const matRoof = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
  const matPurlin = new THREE.MeshStandardMaterial({ color: 0xfbbf24 });

  function roofY(x) {
    if (roof === "plana") return height;
    if (roof === "una_agua") return height + ((x + half) / span) * span * slope;
    return height + (1 - Math.abs(x) / half) * half * slope;
  }

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const baseL = new THREE.Vector3(-half, 0, z);
    const baseR = new THREE.Vector3(half, 0, z);
    const topL = new THREE.Vector3(-half, roof === "una_agua" ? height : height, z);
    const topR = new THREE.Vector3(half, roof === "una_agua" ? height + span * slope : height, z);

    addMember(baseL, topL, 0.18, matCol);
    addMember(baseR, topR, 0.18, matCol);

    if (roof === "dos_aguas") {
      const ridge = new THREE.Vector3(0, height + half * slope, z);
      addMember(new THREE.Vector3(-half, height, z), ridge, 0.14, matRoof);
      addMember(ridge, new THREE.Vector3(half, height, z), 0.14, matRoof);
    } else {
      addMember(topL, topR, 0.14, matRoof);
    }
  }

  // correas entre pórticos
  for (let i = 0; i < frames - 1; i++) {
    const z0 = i * step;
    const z1 = (i + 1) * step;

    for (let k = 0; k <= 8; k++) {
      const x = -half + (k / 8) * span;
      addMember(
        new THREE.Vector3(x, roofY(x), z0),
        new THREE.Vector3(x, roofY(x), z1),
        0.08,
        matPurlin
      );
    }
  }

  state.version++;
  qs("#kpi-elements").textContent = state.group.children.length;
  qs("#kpi-version").textContent = state.version;
  qs("#kpi-weight").textContent = Math.round(state.group.children.length * 250);
}

/* ---------------- EVENTS ---------------- */
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-action='generate-model']")) {
    generateModel();
  }
});

/* ---------------- START ---------------- */
window.addEventListener("DOMContentLoaded", () => {
  initViewer();
});
