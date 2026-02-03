// script.js (ES Module) — RMM STRUCTURES (GitHub Pages friendly)
// ✅ Visor 3D SIEMPRE funciona (Three.js + OrbitControls por CDN jsDelivr)
// ✅ Preview paramétrico: columnas + techo (plano / 1 agua / 2 aguas)
// ✅ Correas: SEGMENTADAS entre pórticos + siguiendo pendiente + separación real (m)
// ✅ BOM + reglas + versionado local + Supabase opcional
// ⚠️ IFC real: requiere bundling (Vite + ifc.js). En GH Pages sin bundler suele fallar.

const qs = (sel, parent = document) => parent.querySelector(sel);
const qsa = (sel, parent = document) => [...parent.querySelectorAll(sel)];

const state = {
  session: null,
  role: null,
  model: null,
  version: 0,

  // three viewer
  three: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  viewerReady: false,
  animId: null,

  wizardStep: 1,
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
    const rs = qs("#role-status");
    if (rs) rs.textContent = `Rol seleccionado: ${state.role}. Podés continuar con el asistente o la vista industrial.`;
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

    const st = qs("#auth-status");
    if (st) st.textContent = `Sesión demo activa: ${email} (${role})`;
    renderPermissions(role);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="logout"]');
    if (!btn) return;

    state.session = null;
    state.role = null;
    const st = qs("#auth-status");
    if (st) st.textContent = "Sin sesión activa.";
    const ul = qs("#auth-permissions");
    if (ul) ul.innerHTML = "";
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="magic-link"]');
    if (!btn) return;

    const status = qs("#auth-supabase-status");
    const url = qs("#supabase-url")?.value?.trim();
    const key = qs("#supabase-key")?.value?.trim();
    if (!status) return;

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
    if (!summary) return;

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
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    setIndustrialInputsFromWizard(data);

    generateModelFromIndustrial();
    renderBOMFromModel();
    refreshKPIs();
    runRules();

    await renderParametricPreview();

    const ifcStatus = qs("#ifc-status");
    if (ifcStatus) ifcStatus.textContent = "Modelo generado. Vista 3D actualizada.";

    const wz = qs("#wizard-status");
    if (wz) wz.textContent = "Modelo generado. Revisá la vista industrial.";
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
  const s = qs("#ind-span");
  const l = qs("#ind-length");
  const h = qs("#ind-height");
  const f = qs("#ind-frames");

  if (qs("#ind-span-value") && s) qs("#ind-span-value").textContent = s.value;
  if (qs("#ind-length-value") && l) qs("#ind-length-value").textContent = l.value;
  if (qs("#ind-height-value") && h) qs("#ind-height-value").textContent = h.value;
  if (qs("#ind-frames-value") && f) qs("#ind-frames-value").textContent = f.value;
}

function bindIndustrialControls() {
  ["#ind-span", "#ind-length", "#ind-height", "#ind-frames", "#ind-roof"].forEach((id) => {
    const el = qs(id);
    if (!el) return;
    el.addEventListener("input", updateIndustrialLabels);
    el.addEventListener("change", updateIndustrialLabels);
  });

  updateIndustrialLabels();

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "generate-model") {
      generateModelFromIndustrial();
      renderBOMFromModel();
      refreshKPIs();
      runRules();
      await renderParametricPreview();
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

  // IFC input (en GH Pages sin bundler no lo cargamos: aviso)
  const ifcInput = qs("#ifc-file");
  if (ifcInput) {
    ifcInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const ifcStatus = qs("#ifc-status");
      const viewerStatus = qs("#viewer-status");
      if (ifcStatus) {
        ifcStatus.textContent =
          "Carga IFC: en GitHub Pages sin empaquetado suele fallar. Para IFC real: Vite + ifc.js. (Preview paramétrico OK).";
      }
      if (viewerStatus) viewerStatus.textContent = "Preview 3D";
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

  // ✅ para correas: separación real (m) (si no existe el input en el HTML, usa 1.50m)
  const purlinSpacing = Number(qs("#ind-purlin-spacing")?.value) || 1.5;

  state.version += 1;

  const model = {
    meta: { createdAt: nowISO(), version: state.version, unit: "m", source: "RMM Industrial UI" },
    building: { type: "nave", roof, span, length, height, frames, purlinSpacing },
    elements: [],
  };

  // BOM demo
  for (let i = 0; i < frames; i++) {
    model.elements.push({ id: `COL-L-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `COL-R-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });

    if (roof === "dos_aguas") {
      model.elements.push({ id: `RAF-L-${i + 1}`, type: "viga", qty: 1, length: span / 2, weightKg: (span / 2) * 55 });
      model.elements.push({ id: `RAF-R-${i + 1}`, type: "viga", qty: 1, length: span / 2, weightKg: (span / 2) * 55 });
    } else {
      model.elements.push({ id: `BEAM-${i + 1}`, type: "viga", qty: 1, length: span, weightKg: span * 55 });
    }
  }

  // correas BOM demo (segmentadas entre pórticos)
  const stepZ = frames > 1 ? length / (frames - 1) : length;
  const roofLineLen = roof === "dos_aguas" ? span / 2 : span;
  const purlinsPerSlope = Math.max(2, Math.ceil(roofLineLen / purlinSpacing));
  const runs = roof === "dos_aguas" ? 2 : 1;
  const totalSegments = Math.max(0, frames - 1) * purlinsPerSlope * runs;

  model.elements.push({
    id: `PURLINS`,
    type: "correas",
    qty: totalSegments,
    length: stepZ,
    weightKg: totalSegments * 6,
  });

  state.model = model;

  const kv = qs("#kpi-version");
  if (kv) kv.textContent = String(state.version);

  const gs = qs("#geometry-status");
  if (gs) gs.textContent = "Geometría calculada (modelo paramétrico).";

  const is = qs("#ifc-status");
  if (is) is.textContent = "Modelo generado. Vista 3D actualizada.";
}

function computeTotals(model) {
  const elements = model?.elements || [];
  const count = elements.reduce((acc, e) => acc + (Number(e.qty) || 0), 0);
  const weight = elements.reduce((acc, e) => acc + (Number(e.weightKg) || 0), 0);
  return { count, weight };
}

function refreshKPIs() {
  const { count, weight } = computeTotals(state.model);
  const ke = qs("#kpi-elements");
  const kw = qs("#kpi-weight");
  if (ke) ke.textContent = fmt(count);
  if (kw) kw.textContent = fmt(Math.round(weight));
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
    .map(
      (r) => `
      <tr>
        <td>${r.type}</td>
        <td>${fmt(r.qty)}</td>
        <td>${fmt(Math.round(r.weightKg))}</td>
        <td>OK</td>
      </tr>
    `
    )
    .join("");
}

// -------------------- EXPORTS --------------------
function exportJSON() {
  if (!state.model) {
    const st = qs("#ifc-status");
    if (st) st.textContent = "No hay modelo para exportar.";
    return;
  }
  downloadText(`rmm_model_v${state.version}.json`, JSON.stringify(state.model, null, 2), "application/json");
}

function exportBOM() {
  if (!state.model) {
    const st = qs("#ifc-status");
    if (st) st.textContent = "No hay modelo para exportar.";
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
  results.push(rule("R5", "Separación correas (demo)", b.purlinSpacing >= 0.9 && b.purlinSpacing <= 2.5, "Separación de correas fuera de rango (demo)."));

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

// -------------------- THREE VIEWER (GitHub Pages robusto) --------------------
async function ensureThreeViewer() {
  if (state.viewerReady) return true;

  const container = qs("#ifc-viewer");
  const status = qs("#viewer-status");
  if (!container) return false;

  try {
    const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js");
    const { OrbitControls } = await import(
      "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js"
    );

    // limpiar container
    container.innerHTML = "";
    container.style.position = "relative";

    const w = container.clientWidth || 900;
    const h = Math.max(420, container.clientHeight || 520);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 2000);
    camera.position.set(25, 18, 35);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // luces
    const amb = new THREE.AmbientLight(0xffffff, 0.65);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(30, 40, 25);
    scene.add(amb, dir);

    // grilla
    const grid = new THREE.GridHelper(200, 40, 0x334155, 0x1f2937);
    grid.position.y = 0;
    scene.add(grid);

    // ejes
    const axes = new THREE.AxesHelper(8);
    scene.add(axes);

    state.three = THREE;
    state.scene = scene;
    state.camera = camera;
    state.renderer = renderer;
    state.controls = controls;
    state.viewerReady = true;

    if (status) status.textContent = "Preview 3D";

    // resize observer
    const ro = new ResizeObserver(() => {
      if (!state.viewerReady) return;
      const cw = container.clientWidth || 900;
      const ch = Math.max(420, container.clientHeight || 520);
      state.camera.aspect = cw / ch;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(cw, ch);
    });
    ro.observe(container);

    // loop
    const animate = () => {
      state.animId = requestAnimationFrame(animate);
      state.controls.update();
      state.renderer.render(state.scene, state.camera);
    };
    animate();

    return true;
  } catch (err) {
    container.innerHTML = `
      <div style="padding:16px;color:#e2e8f0;font-weight:700;">
        No se pudo cargar Three.js desde CDN.<br/>
        <span style="font-weight:400;color:#94a3b8;">
          Motivo: ${String(err?.message || err)}
        </span>
      </div>
    `;
    if (status) status.textContent = "Error";
    return false;
  }
}

function resetViewer() {
  if (state.scene && state.three) {
    const old = state.scene.getObjectByName("RMM_PREVIEW");
    if (old) state.scene.remove(old);
  }
  const vs = qs("#viewer-status");
  const is = qs("#ifc-status");
  if (vs) vs.textContent = "Preview 3D";
  if (is) is.textContent = "Visor reiniciado. Podés generar un modelo (preview 3D).";
}

// -------------------- PREVIEW PARAMÉTRICO 3D --------------------
function clearPreviewGroup() {
  if (!state.scene) return;
  const old = state.scene.getObjectByName("RMM_PREVIEW");
  if (old) state.scene.remove(old);
}

function addOrientedBox(T, group, p0, p1, thickness, material) {
  const dir = new T.Vector3().subVectors(p1, p0);
  const len = dir.length();
  if (len <= 1e-6) return;

  const geo = new T.BoxGeometry(len, thickness, thickness);
  const mesh = new T.Mesh(geo, material);

  const mid = new T.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  mesh.position.copy(mid);

  const axisX = new T.Vector3(1, 0, 0);
  const q = new T.Quaternion().setFromUnitVectors(axisX, dir.clone().normalize());
  mesh.setRotationFromQuaternion(q);

  group.add(mesh);
}

function fitCameraToObject(obj) {
  const T = state.three;
  if (!T || !state.camera || !state.controls) return;

  const box = new T.Box3().setFromObject(obj);
  const size = box.getSize(new T.Vector3());
  const center = box.getCenter(new T.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.6 + 10;

  state.camera.position.set(center.x + dist, center.y + dist * 0.55, center.z + dist);
  state.controls.target.copy(center);
  state.controls.update();
}

async function renderParametricPreview() {
  if (!state.model) return;

  const ok = await ensureThreeViewer();
  if (!ok) return;

  const T = state.three;
  const scene = state.scene;

  clearPreviewGroup();

  const group = new T.Group();
  group.name = "RMM_PREVIEW";

  const { span, length, height, frames, roof, purlinSpacing } = state.model.building;

  const halfSpan = span / 2;
  const stepZ = frames > 1 ? length / (frames - 1) : length;

  const colSize = Math.max(0.14, span * 0.006);
  const beamSize = Math.max(0.12, span * 0.005);

  const matCol = new T.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.2, roughness: 0.6 });
  const matBeam = new T.MeshStandardMaterial({ color: 0xf9b64c, metalness: 0.2, roughness: 0.6 });

  const colGeo = new T.BoxGeometry(colSize, height, colSize);

  const ridgeHeight = height + span * 0.25; // dos aguas (visual)
  const topHeight = height + span * 0.2;    // una agua (visual)

  // ---- PÓRTICOS ----
  for (let i = 0; i < frames; i++) {
    const z = i * stepZ;

    const colL = new T.Mesh(colGeo, matCol);
    colL.position.set(-halfSpan, height / 2, z);
    group.add(colL);

    const colR = new T.Mesh(colGeo, matCol);
    colR.position.set(+halfSpan, height / 2, z);
    group.add(colR);

    if (roof === "dos_aguas") {
      const pL = new T.Vector3(-halfSpan, height, z);
      const pR = new T.Vector3(+halfSpan, height, z);
      const pC = new T.Vector3(0, ridgeHeight, z);

      addOrientedBox(T, group, pL, pC, beamSize, matBeam);
      addOrientedBox(T, group, pC, pR, beamSize, matBeam);

      const node = new T.Mesh(new T.SphereGeometry(Math.max(0.12, beamSize * 0.55), 12, 12), matBeam);
      node.position.set(0, ridgeHeight, z);
      group.add(node);

    } else if (roof === "una_agua") {
      const p0 = new T.Vector3(-halfSpan, height, z);
      const p1 = new T.Vector3(+halfSpan, topHeight, z);
      addOrientedBox(T, group, p0, p1, beamSize, matBeam);

    } else {
      const p0 = new T.Vector3(-halfSpan, height, z);
      const p1 = new T.Vector3(+halfSpan, height, z);
      addOrientedBox(T, group, p0, p1, beamSize, matBeam);
    }
  }

  // ---- CORREAS segmentadas entre pórticos + siguiendo pendiente ----
  const matPurlin = new T.MeshStandardMaterial({ color: 0x8bc1ff, metalness: 0.2, roughness: 0.6 });
  const purlinSize = Math.max(0.06, span * 0.003);
  const segGeo = new T.BoxGeometry(purlinSize, purlinSize, stepZ);

  const spacing = Number(purlinSpacing) || 1.5;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function addPurlinSegment(x, y, z0, z1) {
    const seg = new T.Mesh(segGeo, matPurlin);
    seg.position.set(x, y, (z0 + z1) / 2);
    group.add(seg);
  }

  if (roof === "dos_aguas") {
    const slopeLen = Math.sqrt(halfSpan ** 2 + (ridgeHeight - height) ** 2);
    const count = Math.max(2, Math.ceil(slopeLen / spacing));

    for (let i = 0; i < frames - 1; i++) {
      const z0 = i * stepZ;
      const z1 = (i + 1) * stepZ;

      // faldón izquierdo
      for (let k = 0; k < count; k++) {
        const t = k / (count - 1);
        const x = lerp(-halfSpan, 0, t);
        const y = lerp(height, ridgeHeight, t);
        addPurlinSegment(x, y, z0, z1);
      }
      // faldón derecho
      for (let k = 0; k < count; k++) {
        const t = k / (count - 1);
        const x = lerp(0, halfSpan, t);
        const y = lerp(ridgeHeight, height, t);
        addPurlinSegment(x, y, z0, z1);
      }
    }

  } else if (roof === "una_agua") {
    const slopeLen = Math.sqrt(span ** 2 + (topHeight - height) ** 2);
    const count = Math.max(2, Math.ceil(slopeLen / spacing));

    for (let i = 0; i < frames - 1; i++) {
      const z0 = i * stepZ;
      const z1 = (i + 1) * stepZ;

      for (let k = 0; k < count; k++) {
        const t = k / (count - 1);
        const x = lerp(-halfSpan, halfSpan, t);
        const y = lerp(height, topHeight, t);
        addPurlinSegment(x, y, z0, z1);
      }
    }

  } else {
    const count = Math.max(2, Math.ceil(span / spacing));

    for (let i = 0; i < frames - 1; i++) {
      const z0 = i * stepZ;
      const z1 = (i + 1) * stepZ;

      for (let k = 0; k < count; k++) {
        const t = k / (count - 1);
        const x = lerp(-halfSpan, halfSpan, t);
        const y = height;
        addPurlinSegment(x, y, z0, z1);
      }
    }
  }

  scene.add(group);

  const vs = qs("#viewer-status");
  const is = qs("#ifc-status");
  if (vs) vs.textContent = "Preview 3D";
  if (is) is.textContent = `Preview 3D actualizado (${roof}). Correas: sep ${spacing} m (tramo entre pórticos).`;

  fitCameraToObject(group);
}

// -------------------- VERSIONADO LOCAL --------------------
function localKey() {
  const name = qs("#project-name")?.value?.trim() || "rmm_project";
  return `rmm_versions_${name}`;
}

function saveLocalVersion() {
  const st = qs("#persistence-status");
  if (!state.model) {
    if (st) st.textContent = "No hay modelo para guardar.";
    return;
  }

  const key = localKey();
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  const entry = { savedAt: nowISO(), version: state.version, model: state.model };
  current.unshift(entry);
  localStorage.setItem(key, JSON.stringify(current.slice(0, 50)));

  if (st) st.textContent = `Versión guardada localmente (v${state.version}).`;
  renderLocalVersions();
}

function loadLocalVersion() {
  const st = qs("#persistence-status");
  const key = localKey();
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  if (!current.length) {
    if (st) st.textContent = "No hay versiones guardadas.";
    return;
  }

  const latest = current[0];
  state.model = latest.model;
  state.version = latest.version || state.version;

  if (st) st.textContent = `Versión cargada (v${state.version}).`;
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

  await ensureThreeViewer();

  renderPermissions(null);
  renderBOMFromModel();
  refreshKPIs();
  runRules();
  renderLocalVersions();
}

window.addEventListener("DOMContentLoaded", () => {
  init();
});
