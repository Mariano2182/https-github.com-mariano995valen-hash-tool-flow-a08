// script.js (ES Module)

// ✅ Usa importmap del index.html
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const qs = (sel, parent = document) => parent.querySelector(sel);
const qsa = (sel, parent = document) => [...parent.querySelectorAll(sel)];

const state = {
  session: null,
  role: null,
  model: null, // modelo paramétrico (JSON)
  version: 0,

  // visor Three.js
  three: {
    ready: false,
    container: null,
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    animId: null,
    root: null, // Group con el modelo
  },
};

// -------------------- UTILIDADES --------------------
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function fmt(n) {
  try {
    return Number(n).toLocaleString("es-AR");
  } catch {
    return String(n);
  }
}
function nowISO() {
  return new Date().toISOString();
}
function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// -------------------- TOOLTIP ACCESSIBLE --------------------
function enhanceTooltips() {
  qsa("[data-tooltip]").forEach((el) => {
    if (!el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", el.getAttribute("data-tooltip"));
    }
  });
}

// -------------------- MODAL --------------------
function openModal(id) {
  const modal = qs(`#${id}`);
  if (!modal) return;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(modal) {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}
function bindModals() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    if (action === "open-demo") openModal("demo-modal");
    if (action === "close-modal" && btn.closest(".modal")) closeModal(btn.closest(".modal"));
  });

  qsa("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) closeModal(modal);
    });
  });

  qsa(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) closeModal(m);
    });
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="select-role"]');
    if (!btn) return;
    state.role = btn.getAttribute("data-role");
    qs("#role-status").textContent = `Rol seleccionado: ${state.role}. Podés continuar con el asistente o la vista industrial.`;
    closeModal(qs("#demo-modal"));
  });
}

// -------------------- NAV SCROLL --------------------
function bindScrollButtons() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="scroll"]');
    if (!btn) return;
    const target = btn.getAttribute("data-target");
    if (!target) return;
    const el = qs(target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// -------------------- AUTH (DEMO) --------------------
function rolePermissions(role) {
  const base = ["Ver proyecto", "Descargar BOM", "Ver validaciones"];
  if (role === "Cliente") return base;
  if (role === "Ingeniero") return [...base, "Editar parámetros", "Ejecutar validaciones"];
  if (role === "Fabricador") return [...base, "Exportar archivos", "Marcar estados de fabricación"];
  if (role === "Admin") return [...base, "Gestionar usuarios", "Gestionar catálogos", "Todo"];
  return base;
}
function renderPermissions(role) {
  const ul = qs("#auth-permissions");
  ul.innerHTML = "";
  rolePermissions(role).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `• ${p}`;
    ul.appendChild(li);
  });
}
function bindAuth() {
  const form = qs("#auth-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = qs("#auth-email").value.trim();
    const role = qs("#auth-role").value;
    state.session = { email, role, at: nowISO() };
    state.role = role;

    qs("#auth-status").textContent = `Sesión demo activa: ${email} (${role})`;
    renderPermissions(role);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="logout"]');
    if (!btn) return;
    state.session = null;
    state.role = null;
    qs("#auth-status").textContent = "Sin sesión activa.";
    qs("#auth-permissions").innerHTML = "";
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="magic-link"]');
    if (!btn) return;

    const status = qs("#auth-supabase-status");
    const url = qs("#supabase-url")?.value?.trim();
    const key = qs("#supabase-key")?.value?.trim();
    if (!url || !key || !window.supabase) {
      status.textContent = "Supabase Auth sin configurar (cargá URL y ANON KEY en Backend).";
      return;
    }

    try {
      const client = window.supabase.createClient(url, key);
      const email = qs("#auth-email").value.trim();
      const { error } = await client.auth.signInWithOtp({ email });
      status.textContent = error ? `Error: ${error.message}` : "Magic link enviado (revisá tu email).";
    } catch (err) {
      status.textContent = `Error: ${err?.message || err}`;
    }
  });
}

// -------------------- WIZARD --------------------
function bindWizard() {
  const form = qs("#wizard-form");
  if (!form) return;

  const steps = qsa(".wizard-steps .step");
  const panels = qsa(".wizard-form .step-panel");

  function goStep(n) {
    const step = clamp(n, 1, 4);
    steps.forEach((b) => b.classList.toggle("active", b.dataset.step === String(step)));
    panels.forEach((p) => p.classList.toggle("active", p.dataset.step === String(step)));
    state.wizardStep = step;
  }

  steps.forEach((b) => {
    b.addEventListener("click", () => goStep(Number(b.dataset.step)));
  });

  document.addEventListener("click", (e) => {
    const next = e.target.closest('[data-action="next"]');
    const prev = e.target.closest('[data-action="prev"]');
    if (next) goStep((state.wizardStep || 1) + 1);
    if (prev) goStep((state.wizardStep || 1) - 1);
  });

  form.addEventListener("input", () => {
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    const summary = qs("#wizard-summary");
    if (summary) {
      summary.innerHTML = `
        <div><strong>Tipo:</strong> ${data.tipo || "-"}</div>
        <div><strong>Ubicación:</strong> ${data.ubicacion || "-"}</div>
        <div><strong>Ancho:</strong> ${data.ancho || "-"} m</div>
        <div><strong>Largo:</strong> ${data.largo || "-"} m</div>
        <div><strong>Altura:</strong> ${data.altura || "-"} m</div>
        <div><strong>Pórticos:</strong> ${data.porticos || "-"}</div>
        <div><strong>Pórtico:</strong> ${data.portico || "-"}</div>
        <div><strong>Perfil:</strong> ${data.perfil || "-"}</div>
        <div><strong>Cubierta:</strong> ${data.cubierta || "-"}</div>
        <div><strong>Cerramiento:</strong> ${data.cerramiento || "-"}</div>
      `;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    setIndustrialInputsFromWizard(data);

    // Generar modelo + BOM + KPIs + Preview 3D
    generateModelFromIndustrial();
    renderBOMFromModel();
    refreshKPIs();
    runRules();

    qs("#wizard-status").textContent = "Modelo generado. Revisá la vista industrial.";
    qs("#industrial")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setIndustrialInputsFromWizard(data) {
  const span = qs("#ind-span");
  const length = qs("#ind-length");
  const height = qs("#ind-height");
  const frames = qs("#ind-frames");

  if (span) span.value = clamp(Number(data.ancho || 24), 10, 60);
  if (length) length.value = clamp(Number(data.largo || 60), 20, 200);
  if (height) height.value = clamp(Number(data.altura || 8), 4, 16);
  if (frames) frames.value = clamp(Number(data.porticos || 10), 4, 24);

  updateIndustrialLabels();
}

// -------------------- INDUSTRIAL CONTROLS --------------------
function updateIndustrialLabels() {
  qs("#ind-span-value").textContent = qs("#ind-span").value;
  qs("#ind-length-value").textContent = qs("#ind-length").value;
  qs("#ind-height-value").textContent = qs("#ind-height").value;
  qs("#ind-frames-value").textContent = qs("#ind-frames").value;
}
function bindIndustrialControls() {
  ["#ind-span", "#ind-length", "#ind-height", "#ind-frames", "#ind-roof"].forEach((id) => {
    const el = qs(id);
    if (!el) return;
    el.addEventListener("input", () => {
      updateIndustrialLabels();
      // preview en vivo si ya hay modelo
      if (state.model) renderParametricPreview();
    });
  });

  updateIndustrialLabels();

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "generate-model") {
      generateModelFromIndustrial();
      renderBOMFromModel();
      refreshKPIs();
      runRules();
    }

    if (action === "export-bom") exportBOM();
    if (action === "export-json") exportJSON();
    if (action === "run-rules") runRules();
    if (action === "reset-viewer") resetViewer();

    if (action === "save-local") saveLocalVersion();
    if (action === "load-local") loadLocalVersion();
    if (action === "connect-supabase") connectSupabase();
    if (action === "save-remote") saveRemoteVersion();
    if (action === "load-remote") loadRemoteVersion();
  });

  const ifcInput = qs("#ifc-file");
  if (ifcInput) {
    ifcInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Por ahora dejamos mensaje (IFC real -> próxima etapa con bundler/ifc.js)
      qs("#ifc-status").textContent = `IFC (${file.name}) todavía no se parsea en GitHub Pages sin empaquetado. Usá el preview 3D.`;
    });
  }
}

// -------------------- MODELO PARAMÉTRICO (JSON) --------------------
function generateModelFromIndustrial() {
  const span = Number(qs("#ind-span")?.value || 24);
  const length = Number(qs("#ind-length")?.value || 60);
  const height = Number(qs("#ind-height")?.value || 8);
  const frames = Number(qs("#ind-frames")?.value || 10);
  const roof = qs("#ind-roof")?.value || "dos_aguas";

  state.version += 1;

  const model = {
    meta: { createdAt: nowISO(), version: state.version, unit: "m", source: "RMM Industrial UI" },
    building: { type: "nave", roof, span, length, height, frames },
    elements: [],
  };

  // Elementos simplificados para BOM (no cálculo real)
  for (let i = 0; i < frames; i++) {
    model.elements.push({ id: `COL-L-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `COL-R-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });

    // vigas / cabios depende del tipo de cubierta (BOM demo)
    if (roof === "plana") {
      model.elements.push({ id: `BEAM-${i + 1}`, type: "viga", qty: 1, length: span, weightKg: span * 55 });
    } else if (roof === "una_agua") {
      model.elements.push({ id: `RAFTER-${i + 1}`, type: "cabio", qty: 1, length: span * 1.05, weightKg: span * 48 });
    } else {
      model.elements.push({ id: `RAFTER-L-${i + 1}`, type: "cabio", qty: 1, length: (span / 2) * 1.08, weightKg: span * 28 });
      model.elements.push({ id: `RAFTER-R-${i + 1}`, type: "cabio", qty: 1, length: (span / 2) * 1.08, weightKg: span * 28 });
      model.elements.push({ id: `RIDGE-${i + 1}`, type: "cumbrera", qty: 1, length: 0.2, weightKg: 8 });
    }
  }

  // Correas (cantidad aproximada, por pendiente)
  const approxPurlinLines = Math.max(6, Math.round(span / 2.2));
  model.elements.push({
    id: `PURLINS`,
    type: "correas",
    qty: approxPurlinLines * Math.max(1, frames - 1), // por tramo entre pórticos
    length: Math.max(1, length / Math.max(1, frames - 1)),
    weightKg: approxPurlinLines * Math.max(1, frames - 1) * 12,
  });

  state.model = model;

  qs("#geometry-status").textContent = "Geometría calculada (modelo paramétrico).";
  qs("#kpi-version").textContent = String(state.version);

  qs("#ifc-status").textContent = "Modelo generado. Preview 3D actualizado.";
  qs("#viewer-status").textContent = "Preview activo";

  renderParametricPreview();
}

function computeTotals(model) {
  const elements = model?.elements || [];
  const count = elements.reduce((acc, e) => acc + (Number(e.qty) || 0), 0);
  const weight = elements.reduce((acc, e) => acc + (Number(e.weightKg) || 0), 0);
  return { count, weight };
}
function refreshKPIs() {
  const { count, weight } = computeTotals(state.model);
  qs("#kpi-elements").textContent = fmt(count);
  qs("#kpi-weight").textContent = fmt(Math.round(weight));
}

// -------------------- BOM TABLE --------------------
function renderBOMFromModel() {
  const tbody = qs("#materials-table");
  if (!tbody) return;

  if (!state.model) {
    tbody.innerHTML = `<tr><td colspan="4">Generá un modelo o cargá un IFC.</td></tr>`;
    return;
  }

  const map = new Map();
  for (const e of state.model.elements) {
    const k = e.type;
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0 };
    cur.qty += Number(e.qty) || 0;
    cur.weightKg += Number(e.weightKg) || 0;
    map.set(k, cur);
  }

  const rows = [...map.values()].sort((a, b) => a.type.localeCompare(b.type));
  tbody.innerHTML = rows
    .map((r) => {
      return `
      <tr>
        <td>${r.type}</td>
        <td>${fmt(r.qty)}</td>
        <td>${fmt(Math.round(r.weightKg))}</td>
        <td>OK</td>
      </tr>
    `;
    })
    .join("");
}

// -------------------- EXPORTS --------------------
function exportJSON() {
  if (!state.model) {
    qs("#ifc-status").textContent = "No hay modelo para exportar.";
    return;
  }
  downloadText(`rmm_model_v${state.version}.json`, JSON.stringify(state.model, null, 2), "application/json");
}
function exportBOM() {
  if (!state.model) {
    qs("#ifc-status").textContent = "No hay modelo para exportar.";
    return;
  }

  const map = new Map();
  for (const e of state.model.elements) {
    const k = e.type;
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0 };
    cur.qty += Number(e.qty) || 0;
    cur.weightKg += Number(e.weightKg) || 0;
    map.set(k, cur);
  }

  const rows = [...map.values()];
  const header = "Elemento,Cantidad,Peso_kg,Version\n";
  const lines = rows.map((r) => `${r.type},${r.qty},${Math.round(r.weightKg)},${state.version}`).join("\n");
  downloadText(`rmm_bom_v${state.version}.csv`, header + lines, "text/csv");
}

// -------------------- REGLAS (VALIDACIONES) --------------------
function rule(id, name, ok, msg) {
  return { id, name, ok: Boolean(ok), msg: msg || "" };
}
function runRules() {
  const summary = qs("#rules-summary");
  const list = qs("#rules-list");
  if (!summary || !list) return;

  if (!state.model) {
    summary.textContent = "No hay modelo para validar.";
    list.innerHTML = "";
    return;
  }

  const b = state.model.building;
  const results = [];

  results.push(rule("R1", "Dimensiones mínimas", b.span >= 10 && b.length >= 20 && b.height >= 4, "Ancho/Largo/Altura fuera de rango mínimo."));
  results.push(rule("R2", "Cantidad de pórticos", b.frames >= 4 && b.frames <= 24, "Cantidad de pórticos fuera de rango."));
  results.push(rule("R3", "Relación esbeltez (demo)", b.height / b.span <= 1.0, "Altura muy grande respecto a la luz (revisar)."));
  results.push(rule("R4", "Elementos generados", (state.model.elements?.length || 0) > 0, "No se generaron elementos."));

  const ok = results.filter((r) => r.ok).length;
  summary.textContent = `Validaciones: ${ok}/${results.length} OK`;

  list.innerHTML = results
    .map(
      (r) => `
      <div class="rule-item">
        <strong>${r.id} — ${r.name}</strong>
        <div>${r.ok ? "✅ OK" : "⚠️ Revisar"}</div>
        ${r.ok ? "" : `<div class="helper">${r.msg}</div>`}
      </div>
    `
    )
    .join("");
}

// -------------------- THREE VIEWER --------------------
function ensureThreeViewer() {
  if (state.three.ready) return;

  const container = qs("#ifc-viewer");
  if (!container) return;

  state.three.container = container;

  // limpiar por si hay texto previo
  container.innerHTML = "";
  container.style.position = "relative";

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 2000);
  camera.position.set(30, 22, 50);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 6, 20);

  // grid + axes
  const grid = new THREE.GridHelper(300, 60, 0x334155, 0x1f2937);
  grid.position.y = 0;
  scene.add(grid);

  const axes = new THREE.AxesHelper(6);
  axes.position.set(0, 0.01, 0);
  scene.add(axes);

  // lights
  const amb = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 0.95);
  dir.position.set(80, 120, 40);
  scene.add(dir);

  state.three.renderer = renderer;
  state.three.scene = scene;
  state.three.camera = camera;
  state.three.controls = controls;

  // root group
  state.three.root = new THREE.Group();
  state.three.root.name = "RMM_ROOT";
  scene.add(state.three.root);

  const onResize = () => {
    if (!state.three.container) return;
    const w = state.three.container.clientWidth;
    const h = state.three.container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  window.addEventListener("resize", onResize);

  const animate = () => {
    state.three.animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  state.three.ready = true;
}

function resetViewer() {
  // limpia solo el modelo (mantiene visor)
  ensureThreeViewer();
  if (!state.three.root) return;

  // borrar hijos
  while (state.three.root.children.length) state.three.root.remove(state.three.root.children[0]);

  qs("#viewer-status").textContent = "Listo";
  qs("#ifc-status").textContent = "Visor reiniciado. Generá un modelo para ver el 3D.";
}

// -------------------- GEOMETRÍA: MIEMBROS + CORREAS --------------------
function addMember(group, start, end, size, material) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (len < 1e-6) return;

  const geo = new THREE.BoxGeometry(size, size, len);
  const mesh = new THREE.Mesh(geo, material);

  // orientar: Box está “en Z”, entonces rotamos para apuntar a dir
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(mid);

  const zAxis = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(zAxis, dir.clone().normalize());
  mesh.setRotationFromQuaternion(q);

  group.add(mesh);
}

function renderParametricPreview() {
  if (!state.model) return;

  ensureThreeViewer();
  const root = state.three.root;
  if (!root) return;

  // limpiar anterior
  while (root.children.length) root.remove(root.children[0]);

  const b = state.model.building;
  const { span, length, height, frames, roof } = b;

  // materiales
  const matCol = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.2, roughness: 0.6 });
  const matRafter = new THREE.MeshStandardMaterial({ color: 0xf9b64c, metalness: 0.2, roughness: 0.55 });
  const matPurlin = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.1, roughness: 0.75 });

  const group = new THREE.Group();
  group.name = "RMM_PREVIEW";
  root.add(group);

  const halfSpan = span / 2;
  const stepZ = frames > 1 ? length / (frames - 1) : length;

  // tamaños visuales (no perfiles reales)
  const colSize = Math.max(0.12, span * 0.006);
  const rafterSize = Math.max(0.10, span * 0.005);
  const purlinSize = Math.max(0.07, span * 0.0038);

  // pendiente: tomamos una pendiente “típica” visual (10% a 20%)
  // (la normativa la define por clima/uso, esto es para preview)
  const slope = 0.15; // rise/run
  const riseAtHalf = halfSpan * slope; // para dos aguas
  const riseAtFull = span * slope; // para una agua

  // helper: altura del techo en una posición X
  function roofY(x) {
    if (roof === "plana") return height;
    if (roof === "una_agua") {
      // sube desde -halfSpan (bajo) a +halfSpan (alto)
      const t = (x + halfSpan) / span; // 0..1
      return height + t * riseAtFull;
    }
    // dos aguas: sube hasta cumbrera en x=0
    const ax = Math.abs(x);
    const t = 1 - ax / halfSpan; // 0 en alero, 1 en cumbrera
    return height + t * riseAtHalf;
  }

  // 1) PORTICOS
  for (let i = 0; i < frames; i++) {
    const z = i * stepZ;

    const baseL = new THREE.Vector3(-halfSpan, 0, z);
    const topL = new THREE.Vector3(-halfSpan, height, z);

    const baseR = new THREE.Vector3(halfSpan, 0, z);
    const topR = new THREE.Vector3(halfSpan, height, z);

    // columnas
    addMember(group, baseL, topL, colSize, matCol);
    addMember(group, baseR, topR, colSize, matCol);

    // cubierta por tipo
    if (roof === "plana") {
      const beamL = new THREE.Vector3(-halfSpan, height, z);
      const beamR = new THREE.Vector3(halfSpan, height, z);
      addMember(group, beamL, beamR, rafterSize, matRafter);
    } else if (roof === "una_agua") {
      const yL = roofY(-halfSpan);
      const yR = roofY(halfSpan);
      const eaveL = new THREE.Vector3(-halfSpan, yL, z);
      const eaveR = new THREE.Vector3(halfSpan, yR, z);
      addMember(group, eaveL, eaveR, rafterSize, matRafter);
    } else {
      // dos aguas: dos cabios hasta cumbrera
      const ridge = new THREE.Vector3(0, roofY(0), z);
      const eaveL = new THREE.Vector3(-halfSpan, roofY(-halfSpan), z);
      const eaveR = new THREE.Vector3(halfSpan, roofY(halfSpan), z);
      addMember(group, eaveL, ridge, rafterSize, matRafter);
      addMember(group, ridge, eaveR, rafterSize, matRafter);
    }
  }

  // 2) CORREAS: POR TRAMO ENTRE PORTICOS (no continuas)
  // criterio: varias “líneas” de correa a lo largo de la pendiente, y cada una se dibuja entre z_i y z_{i+1}
  const maxLinesPerSlope = Math.max(5, Math.round(span / 3.0));
  const lines = clamp(maxLinesPerSlope, 5, 16);

  // posiciones X donde van las líneas de correas
  let xLines = [];
  if (roof === "plana") {
    // correas distribuidas sobre todo el ancho
    for (let k = 0; k <= lines; k++) {
      const t = k / lines; // 0..1
      xLines.push(-halfSpan + t * span);
    }
  } else if (roof === "una_agua") {
    for (let k = 0; k <= lines; k++) {
      const t = k / lines;
      xLines.push(-halfSpan + t * span);
    }
  } else {
    // dos aguas: correas por cada faldón (sin duplicar cerca de cumbrera)
    const perSide = Math.max(3, Math.floor(lines / 2));
    for (let k = 0; k <= perSide; k++) {
      const t = k / perSide; // 0..1 desde alero a cumbrera
      const x = -halfSpan + t * (halfSpan);
      xLines.push(x);
    }
    for (let k = 0; k <= perSide; k++) {
      const t = k / perSide;
      const x = halfSpan - t * (halfSpan);
      xLines.push(x);
    }
    // opcional: línea exacta en cumbrera
    xLines.push(0);
    // limpiar duplicados casi iguales
    xLines = [...new Set(xLines.map((v) => v.toFixed(4)))].map(Number).sort((a, b) => a - b);
  }

  // dibujar correas por tramo entre pórticos
  for (let i = 0; i < frames - 1; i++) {
    const z0 = i * stepZ;
    const z1 = (i + 1) * stepZ;

    for (const x of xLines) {
      const y = roofY(x);

      const p0 = new THREE.Vector3(x, y, z0);
      const p1 = new THREE.Vector3(x, y, z1);

      addMember(group, p0, p1, purlinSize, matPurlin);
    }
  }

  // encuadre cámara
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.2;

  state.three.controls.target.copy(center);
  state.three.camera.position.set(center.x + dist, center.y + dist * 0.6, center.z + dist);
  state.three.camera.lookAt(center);

  qs("#viewer-status").textContent = "Preview activo";
  qs("#ifc-status").textContent = `Preview 3D: ${roof.replace("_", " ")} | pórticos: ${frames} | correas por tramo.`;
}

// -------------------- VERSIONADO LOCAL --------------------
function localKey() {
  const name = qs("#project-name")?.value?.trim() || "rmm_project";
  return `rmm_versions_${name}`;
}

function saveLocalVersion() {
  if (!state.model) {
    qs("#persistence-status").textContent = "No hay modelo para guardar.";
    return;
  }

  const key = localKey();
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  const entry = { savedAt: nowISO(), version: state.version, model: state.model };
  current.unshift(entry);
  localStorage.setItem(key, JSON.stringify(current.slice(0, 50)));

  qs("#persistence-status").textContent = `Versión guardada localmente (v${state.version}).`;
  renderLocalVersions();
}

function loadLocalVersion() {
  const key = localKey();
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  if (!current.length) {
    qs("#persistence-status").textContent = "No hay versiones guardadas.";
    return;
  }
  const latest = current[0];
  state.model = latest.model;
  state.version = latest.version || state.version;

  qs("#persistence-status").textContent = `Versión cargada (v${state.version}).`;
  renderBOMFromModel();
  refreshKPIs();
  runRules();
  renderLocalVersions();
  renderParametricPreview();
}

function renderLocalVersions() {
  const box = qs("#version-list");
  if (!box) return;

  const key = localKey();
  const current = JSON.parse(localStorage.getItem(key) || "[]");

  if (!current.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = current
    .slice(0, 8)
    .map(
      (v) => `
      <div class="rule-item">
        <strong>v${v.version} — ${new Date(v.savedAt).toLocaleString("es-AR")}</strong>
        <div class="button-row">
          <button class="ghost" data-action="load-local" data-tooltip="Cargar la última versión local (demo)">Cargar última</button>
          <button class="ghost" data-action="export-json" data-tooltip="Descargar el modelo actual en JSON">Exportar JSON</button>
        </div>
      </div>
    `
    )
    .join("");
}

// -------------------- SUPABASE (opcional) --------------------
let supa = null;

function connectSupabase() {
  const url = qs("#supabase-url")?.value?.trim();
  const key = qs("#supabase-key")?.value?.trim();
  const status = qs("#supabase-status");
  if (!status) return;

  if (!url || !key || !window.supabase) {
    status.textContent = "Falta Supabase URL o ANON KEY.";
    return;
  }

  try {
    supa = window.supabase.createClient(url, key);
    status.textContent = "Conectado. (Ahora podés guardar/cargar).";
  } catch (err) {
    status.textContent = `Error conectando: ${err?.message || err}`;
  }
}

async function saveRemoteVersion() {
  const status = qs("#supabase-status");
  if (!status) return;
  if (!supa) {
    status.textContent = "No estás conectado a Supabase.";
    return;
  }
  if (!state.model) {
    status.textContent = "No hay modelo para guardar.";
    return;
  }

  const { data: auth } = await supa.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    status.textContent = "Necesitás iniciar sesión real en Supabase Auth para guardar.";
    return;
  }

  try {
    const projectName = qs("#project-name")?.value?.trim() || "Proyecto";
    const clientName = qs("#project-client")?.value?.trim() || null;

    const payload = {
      owner_id: userId,
      project_name: projectName,
      client_name: clientName,
      bim_json: state.model,
    };

    const { error } = await supa.from("project_versions").insert(payload);
    status.textContent = error ? `Error: ${error.message}` : "Versión guardada en Supabase.";
  } catch (err) {
    status.textContent = `Error: ${err?.message || err}`;
  }
}

async function loadRemoteVersion() {
  const status = qs("#supabase-status");
  if (!status) return;
  if (!supa) {
    status.textContent = "No estás conectado a Supabase.";
    return;
  }

  const { data: auth } = await supa.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    status.textContent = "Necesitás iniciar sesión real en Supabase Auth para cargar.";
    return;
  }

  try {
    const { data, error } = await supa.from("project_versions").select("*").order("created_at", { ascending: false }).limit(1);

    if (error) {
      status.textContent = `Error: ${error.message}`;
      return;
    }

    if (!data?.length) {
      status.textContent = "No hay versiones en Supabase.";
      return;
    }

    const latest = data[0];
    state.model = latest.bim_json;
    state.version = state.model?.meta?.version || state.version;

    status.textContent = "Versión cargada desde Supabase.";
    renderBOMFromModel();
    refreshKPIs();
    runRules();
    renderParametricPreview();
  } catch (err) {
    status.textContent = `Error: ${err?.message || err}`;
  }
}

// -------------------- INIT --------------------
function init() {
  enhanceTooltips();
  bindModals();
  bindScrollButtons();
  bindAuth();
  bindWizard();
  bindIndustrialControls();

  ensureThreeViewer(); // deja el visor listo
  renderPermissions(null);
  renderBOMFromModel();
  refreshKPIs();
  runRules();
  renderLocalVersions();
}

window.addEventListener("DOMContentLoaded", init);
