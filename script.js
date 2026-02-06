// script.js (ES Module) — GitHub Pages friendly (imports por URL completa)

const qs = (sel, parent = document) => parent.querySelector(sel);
const qsa = (sel, parent = document) => [...parent.querySelectorAll(sel)];

const state = {
  session: null,
  role: null,
  model: null,
  version: 0,

  // Preview 3D (Three.js)
  preview: {
    ready: false,
    THREE: null,
    OrbitControls: null,
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    animId: null,
    groupName: "RMM_PREVIEW",
    ro: null,
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

function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function nowISO() {
  return new Date().toISOString();
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
    qs("#role-status").textContent =
      `Rol seleccionado: ${state.role}. Podés continuar con el asistente o la vista industrial.`;
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
  if (!ul) return;
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

  // Magic link (opcional)
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

  steps.forEach((b) => b.addEventListener("click", () => goStep(Number(b.dataset.step))));

  document.addEventListener("click", (e) => {
    const next = e.target.closest('[data-action="next"]');
    const prev = e.target.closest('[data-action="prev"]');
    if (next) goStep(state.wizardStep + 1);
    if (prev) goStep(state.wizardStep - 1);
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
    generateModelFromIndustrial();
    qs("#wizard-status").textContent = "Modelo generado. Revisá la vista industrial.";
    qs("#industrial")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  goStep(1);
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
  const a = qs("#ind-span"); const b = qs("#ind-length"); const c = qs("#ind-height"); const d = qs("#ind-frames");
  if (a) qs("#ind-span-value").textContent = a.value;
  if (b) qs("#ind-length-value").textContent = b.value;
  if (c) qs("#ind-height-value").textContent = c.value;
  if (d) qs("#ind-frames-value").textContent = d.value;

  const slopeEl = qs("#ind-slope");
  const slopeVal = qs("#ind-slope-value");
  if (slopeEl && slopeVal) slopeVal.textContent = slopeEl.value;
}

function bindIndustrialControls() {
  ["#ind-span", "#ind-length", "#ind-height", "#ind-frames", "#ind-slope"].forEach((id) => {
    const el = qs(id);
    if (!el) return;
    el.addEventListener("input", updateIndustrialLabels);
  });

  updateIndustrialLabels();

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "generate-model") generateModelFromIndustrial();
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
      qs("#ifc-status").textContent =
        "Carga IFC: pendiente de integrar IFC.js empaquetado. (Preview 3D funciona igual).";
      qs("#viewer-status").textContent = "Preview activo";
      e.target.value = "";
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

  const slopePct = Number(qs("#ind-slope")?.value || 10);
  const slope = clamp(slopePct / 100, 0.02, 0.25);

  state.version += 1;

  const model = {
    meta: { createdAt: nowISO(), version: state.version, unit: "m", source: "RMM Industrial UI" },
    building: { type: "nave", roof, span, length, height, frames, slope },
    elements: [],
  };

  for (let i = 0; i < frames; i++) {
    model.elements.push({ id: `COL-L-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `COL-R-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `BEAM-${i + 1}`, type: "viga", qty: 1, length: span, weightKg: span * 55 });
  }

  const purlins = Math.max(6, Math.round(length / 4));
  model.elements.push({ id: `PURLINS`, type: "correas", qty: purlins, length: span, weightKg: purlins * span * 8 });

  const girts = Math.max(6, Math.round(length / 5)) * 2;
  model.elements.push({ id: `GIRTS`, type: "correas_columna", qty: girts, length: length, weightKg: girts * 6 });

  state.model = model;

  qs("#geometry-status").textContent = "Geometría calculada (modelo paramétrico).";
  qs("#kpi-version").textContent = String(state.version);

  renderBOMFromModel();
  refreshKPIs();
  runRules();

  qs("#ifc-status").textContent = "Modelo generado. Preview 3D actualizado.";

  // ✅ SIEMPRE render después de generar modelo
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
  results.push(rule("R3", "Pendiente razonable", b.slope >= 0.02 && b.slope <= 0.25, "Pendiente fuera de rango típico."));
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

function rule(id, name, ok, msg) {
  return { id, name, ok: Boolean(ok), msg: msg || "" };
}

// -------------------- PREVIEW 3D (Three.js) --------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForContainerSize(container, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const r = container.getBoundingClientRect();
    if (r.width > 50 && r.height > 50) return { w: r.width, h: r.height };
    await sleep(120);
  }
  const r = container.getBoundingClientRect();
  return { w: Math.max(r.width, 300), h: Math.max(r.height, 300) };
}

async function ensurePreview3D() {
  if (state.preview.ready) return true;

  const container = qs("#ifc-viewer");
  if (!container) return false;

  try {
    // Espera a que el contenedor tenga tamaño real
    const { w, h } = await waitForContainerSize(container);

    // Import Three + OrbitControls por URL absoluta (GitHub Pages OK)
    const THREE = await import("https://unpkg.com/three@0.158.0/build/three.module.js");
    const oc = await import("https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js");

    state.preview.THREE = THREE;
    state.preview.OrbitControls = oc.OrbitControls;

    const {
      WebGLRenderer,
      Scene,
      PerspectiveCamera,
      Color,
      Fog,
      AxesHelper,
      GridHelper,
      AmbientLight,
      DirectionalLight
    } = THREE;

    container.innerHTML = "";

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = new Color(0x071226);
    scene.fog = new Fog(0x071226, 80, 500);

    const camera = new PerspectiveCamera(55, w / h, 0.1, 4000);
    camera.position.set(35, 18, 60);

    const controls = new state.preview.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 6, 20);

    // grid + axes
    const grid = new GridHelper(300, 120);
    grid.position.y = 0;
    scene.add(grid);

    const axes = new AxesHelper(8);
    scene.add(axes);

    // lights
    const amb = new AmbientLight(0xffffff, 0.55);
    scene.add(amb);

    const dir = new DirectionalLight(0xffffff, 0.9);
    dir.position.set(40, 60, 20);
    scene.add(dir);

    state.preview.renderer = renderer;
    state.preview.scene = scene;
    state.preview.camera = camera;
    state.preview.controls = controls;

    // ResizeObserver + fallback resize
    if (state.preview.ro) {
      try { state.preview.ro.disconnect(); } catch {}
    }

    const ro = new ResizeObserver(() => {
      if (!state.preview.renderer || !state.preview.camera) return;
      const r = container.getBoundingClientRect();
      const W = Math.max(1, r.width);
      const H = Math.max(1, r.height);
      state.preview.renderer.setSize(W, H);
      state.preview.camera.aspect = W / H;
      state.preview.camera.updateProjectionMatrix();
    });
    ro.observe(container);
    state.preview.ro = ro;

    window.addEventListener("resize", () => {
      if (!state.preview.renderer || !state.preview.camera) return;
      const r = container.getBoundingClientRect();
      const W = Math.max(1, r.width);
      const H = Math.max(1, r.height);
      state.preview.renderer.setSize(W, H);
      state.preview.camera.aspect = W / H;
      state.preview.camera.updateProjectionMatrix();
    });

    // animation loop
    const tick = () => {
      state.preview.animId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    state.preview.ready = true;
    qs("#viewer-status").textContent = "Preview activo";
    qs("#ifc-status").textContent = "Preview 3D listo (sin IFC). Generá un modelo para ver estructura.";

    return true;
  } catch (err) {
    const containerEl = qs("#ifc-viewer");
    if (containerEl) {
      containerEl.innerHTML = `
        <div style="padding:16px;color:#e2e8f0;font-weight:700;">
          No se pudo cargar Three.js desde CDN.<br/>
          <span style="font-weight:400;color:#94a3b8;">
            Motivo: ${String(err?.message || err)}
          </span>
        </div>
      `;
    }
    qs("#viewer-status").textContent = "Error 3D";
    return false;
  }
}

function resetViewer() {
  const container = qs("#ifc-viewer");
  if (!container) return;

  if (state.preview.animId) cancelAnimationFrame(state.preview.animId);
  if (state.preview.ro) {
    try { state.preview.ro.disconnect(); } catch {}
    state.preview.ro = null;
  }

  state.preview.ready = false;
  state.preview.THREE = null;
  state.preview.OrbitControls = null;
  state.preview.renderer = null;
  state.preview.scene = null;
  state.preview.camera = null;
  state.preview.controls = null;
  state.preview.animId = null;

  container.innerHTML = "";
  qs("#viewer-status").textContent = "Sin archivo";
  qs("#ifc-status").textContent = "Visor reiniciado. Preview se reinicia al generar modelo.";
}

function addMember(THREE, parent, a, b, thickness, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len <= 0.0001) return;

  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

  const geom = new THREE.BoxGeometry(thickness, thickness, len);
  const mesh = new THREE.Mesh(geom, material);

  mesh.position.copy(mid);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(zAxis, dir.normalize());
  mesh.quaternion.copy(q);

  parent.add(mesh);
}

function fitToGroup(THREE, camera, controls, group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = Math.max(15, maxDim * 1.6);

  camera.position.set(center.x + dist, center.y + dist * 0.55, center.z + dist);
  controls.target.copy(center);
  controls.update();
}

// ✅ Preview paramétrico: pórticos + correas techo (por vano) + correas columnas (por vano)
async function renderParametricPreview() {
  if (!state.model) return;

  const ok = await ensurePreview3D();
  if (!ok) return;

  const THREE = state.preview.THREE;
  const scene = state.preview.scene;

  const old = scene.getObjectByName(state.preview.groupName);
  if (old) scene.remove(old);

  const group = new THREE.Group();
  group.name = state.preview.groupName;

  const { span, length, height, frames, roof, slope } = state.model.building;

  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  const matCol = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.2, roughness: 0.6 });
  const matRafter = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.2, roughness: 0.55 });
  const matPurlin = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.1, roughness: 0.7 });
  const matGirt = new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.1, roughness: 0.75 });

  const colSize = Math.max(0.12, span * 0.006);
  const rafterSize = Math.max(0.10, span * 0.005);
  const purlinSize = Math.max(0.06, span * 0.0035);
  const girtSize = Math.max(0.05, span * 0.003);

  function roofY(x) {
    if (roof === "plana") return height;

    if (roof === "una_agua") {
      const t = (x + halfSpan) / span; // 0..1
      return height + t * (span * slope);
    }

    // dos aguas
    const t = Math.abs(x) / halfSpan; // 0..1
    return height + (1 - t) * (halfSpan * slope);
  }

  // -------------------- PÓRTICOS --------------------
  for (let i = 0; i < frames; i++) {
    const z = i * step;

    let topL = new THREE.Vector3(-halfSpan, height, z);
    let topR = new THREE.Vector3(halfSpan, height, z);

    if (roof === "una_agua") {
      const lowEaveY = height;
      const highEaveY = height + span * slope;
      topL = new THREE.Vector3(-halfSpan, lowEaveY, z);
      topR = new THREE.Vector3(halfSpan, highEaveY, z);
    }

    const baseL = new THREE.Vector3(-halfSpan, 0, z);
    const baseR = new THREE.Vector3(halfSpan, 0, z);

    addMember(THREE, group, baseL, topL, colSize, matCol);
    addMember(THREE, group, baseR, topR, colSize, matCol);

    if (roof === "plana") {
      const a = new THREE.Vector3(-halfSpan, roofY(-halfSpan), z);
      const b = new THREE.Vector3(halfSpan, roofY(halfSpan), z);
      addMember(THREE, group, a, b, rafterSize, matRafter);
    } else if (roof === "una_agua") {
      addMember(THREE, group, topL, topR, rafterSize, matRafter);
    } else {
      const eaveL = new THREE.Vector3(-halfSpan, height, z);
      const eaveR = new THREE.Vector3(halfSpan, height, z);
      const ridge = new THREE.Vector3(0, height + halfSpan * slope, z);

      addMember(THREE, group, eaveL, ridge, rafterSize, matRafter);
      addMember(THREE, group, ridge, eaveR, rafterSize, matRafter);
    }
  }

  // -------------------- CORREAS DE TECHO (POR VANO) --------------------
  const purlinSpacing = 1.5;
  const purlinCount = Math.max(2, Math.floor(span / purlinSpacing));

  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    if (roof === "dos_aguas") {
      const halfCount = Math.max(1, Math.floor(purlinCount / 2));

      for (let k = 0; k <= halfCount; k++) {
        const t = k / halfCount;

        const xL = -halfSpan + t * halfSpan; // -halfSpan..0
        const aL = new THREE.Vector3(xL, roofY(xL), z0);
        const bL = new THREE.Vector3(xL, roofY(xL), z1);
        addMember(THREE, group, aL, bL, purlinSize, matPurlin);

        if (k > 0) {
          const xR = t * halfSpan; // 0..halfSpan
          const aR = new THREE.Vector3(xR, roofY(xR), z0);
          const bR = new THREE.Vector3(xR, roofY(xR), z1);
          addMember(THREE, group, aR, bR, purlinSize, matPurlin);
        }
      }

      const ridgeA = new THREE.Vector3(0, roofY(0), z0);
      const ridgeB = new THREE.Vector3(0, roofY(0), z1);
      addMember(THREE, group, ridgeA, ridgeB, purlinSize, matPurlin);
    } else {
      for (let k = 0; k <= purlinCount; k++) {
        const x = -halfSpan + (k / purlinCount) * span;
        const a = new THREE.Vector3(x, roofY(x), z0);
        const b = new THREE.Vector3(x, roofY(x), z1);
        addMember(THREE, group, a, b, purlinSize, matPurlin);
      }
    }
  }

  // -------------------- CORREAS EN COLUMNAS (POR VANO) --------------------
  const levels = [0.4, 0.6, 0.8];

  function colHeightLeft() { return height; }
  function colHeightRight() { return roof === "una_agua" ? height + span * slope : height; }

  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const hL = colHeightLeft();
    const hR = colHeightRight();

    for (const r of levels) {
      const yL = Math.min(hL - 0.25, hL * r);
      const yR = Math.min(hR - 0.25, hR * r);

      const aL = new THREE.Vector3(-halfSpan, yL, z0);
      const bL = new THREE.Vector3(-halfSpan, yL, z1);
      addMember(THREE, group, aL, bL, girtSize, matGirt);

      const aR = new THREE.Vector3(halfSpan, yR, z0);
      const bR = new THREE.Vector3(halfSpan, yR, z1);
      addMember(THREE, group, aR, bR, girtSize, matGirt);
    }
  }

  scene.add(group);

  fitToGroup(THREE, state.preview.camera, state.preview.controls, group);

  qs("#viewer-status").textContent = "Preview activo";
  qs("#ifc-status").textContent = `Preview 3D: ${roof} — pendiente ${(slope * 100).toFixed(1)}%`;
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

  if (state.model?.building?.slope != null && qs("#ind-slope")) {
    qs("#ind-slope").value = String(Math.round(state.model.building.slope * 100));
    updateIndustrialLabels();
  }

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

    const payload = { owner_id: userId, project_name: projectName, client_name: clientName, bim_json: state.model };
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
    const { data, error } = await supa
      .from("project_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

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

    if (state.model?.building?.slope != null && qs("#ind-slope")) {
      qs("#ind-slope").value = String(Math.round(state.model.building.slope * 100));
      updateIndustrialLabels();
    }

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
async function init() {
  enhanceTooltips();
  bindModals();
  bindScrollButtons();
  bindAuth();
  bindWizard();
  bindIndustrialControls();

  renderPermissions(null);
  renderBOMFromModel();
  refreshKPIs();
  runRules();
  renderLocalVersions();

  // Inicializa preview
  await ensurePreview3D();

  // ✅ PARA QUE NUNCA QUEDE VACÍO: generamos un modelo inicial
  // (si preferís que arranque vacío, comentá estas 2 líneas)
  generateModelFromIndustrial();
}

window.addEventListener("DOMContentLoaded", () => {
  init();
});
