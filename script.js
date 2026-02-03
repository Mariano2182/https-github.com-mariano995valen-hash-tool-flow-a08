// script.js (ES Module)

const qs = (sel, parent = document) => parent.querySelector(sel);
const qsa = (sel, parent = document) => [...parent.querySelectorAll(sel)];

const state = {
  session: null,
  role: null,
  model: null, // modelo paramétrico (JSON) = fuente de verdad
  version: 0,
  wizardStep: 1,

  // IFC (opcional)
  ifcViewer: null,
  ifcLoaded: false,
};

// =====================================================
// UTILIDADES
// =====================================================
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

// =====================================================
// TOOLTIP ACCESSIBLE (extra)
// =====================================================
// Ya los tooltips se muestran por CSS con data-tooltip.
// Esto solo agrega aria-label si falta (mejora accesibilidad).
function enhanceTooltips() {
  qsa("[data-tooltip]").forEach((el) => {
    if (!el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", el.getAttribute("data-tooltip"));
    }
  });
}

// =====================================================
// MODAL
// =====================================================
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
  // open by action
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    if (action === "open-demo") openModal("demo-modal");
    if (action === "close-modal" && btn.closest(".modal")) closeModal(btn.closest(".modal"));
  });

  // close buttons
  qsa("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal");
      if (modal) closeModal(modal);
    });
  });

  // close when click outside
  qsa(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) closeModal(m);
    });
  });

  // role selection
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="select-role"]');
    if (!btn) return;
    state.role = btn.getAttribute("data-role");
    qs("#role-status").textContent = `Rol seleccionado: ${state.role}. Podés continuar con el asistente o la vista industrial.`;
    closeModal(qs("#demo-modal"));
  });
}

// =====================================================
// NAV SCROLL
// =====================================================
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

// =====================================================
// AUTH (DEMO)
// =====================================================
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

// =====================================================
// THREE.JS VIEWER (PREVIEW PARAMÉTRICO) - GRATIS / ESTABLE
// =====================================================
let three = null;

async function ensureThreeViewer() {
  if (three) return three;

  // Import UMD desde unpkg (funciona bien en GitHub Pages)
  // Nota: OrbitControls.js define THREE.OrbitControls globalmente.
  try {
    await import("https://unpkg.com/three@0.158.0/build/three.min.js");
    await import("https://unpkg.com/three@0.158.0/examples/js/controls/OrbitControls.js");
  } catch (err) {
    console.error("Error cargando Three.js:", err);
    const container = qs("#ifc-viewer");
    if (container) {
      container.innerHTML = `
        <div style="padding:16px;color:#e2e8f0;font-weight:700;">
          No se pudo cargar Three.js desde CDN.<br/>
          <span style="font-weight:400;color:#94a3b8;">
            Motivo: ${String(err?.message || err)}
          </span>
        </div>
      `;
    }
    return null;
  }

  const container = qs("#ifc-viewer");
  if (!container) return null;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    2000
  );
  camera.position.set(30, 25, 30);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Luces
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(20, 40, 20);
  scene.add(dir);

  // Grilla + ejes
  scene.add(new THREE.GridHelper(200, 200));
  scene.add(new THREE.AxesHelper(5));

  // Loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  three = { scene, camera, renderer, controls };

  const vs = qs("#viewer-status");
  if (vs) vs.textContent = "Visor activo";

  return three;
}

// Helper: fit a box (para encuadre)
function fitToBox(controls, camera, box) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.4;

  camera.position.set(center.x + cameraZ, center.y + cameraZ * 0.65, center.z + cameraZ);
  controls.target.set(center.x, center.y, center.z);
  controls.update();
}

// Render del modelo paramétrico en Three.js
async function renderParametricPreview() {
  if (!state.model) return;

  const v = await ensureThreeViewer();
  if (!v) return;

  const { scene, camera, controls } = v;

  // limpiar preview anterior
  const old = scene.getObjectByName("RMM_PREVIEW");
  if (old) scene.remove(old);

  const group = new THREE.Group();
  group.name = "RMM_PREVIEW";

  const { span, length, height, frames } = state.model.building;

  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  const matCol = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.25,
    roughness: 0.6,
  });

  const matBeam = new THREE.MeshStandardMaterial({
    color: 0xf9b64c,
    metalness: 0.25,
    roughness: 0.55,
  });

  const colSize = Math.max(0.18, span * 0.007);
  const beamSize = Math.max(0.15, span * 0.006);

  const colGeo = new THREE.BoxGeometry(colSize, height, colSize);
  const beamGeo = new THREE.BoxGeometry(span, beamSize, beamSize);

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const colL = new THREE.Mesh(colGeo, matCol);
    colL.position.set(-halfSpan, height / 2, z);
    group.add(colL);

    const colR = new THREE.Mesh(colGeo, matCol);
    colR.position.set(halfSpan, height / 2, z);
    group.add(colR);

    const beam = new THREE.Mesh(beamGeo, matBeam);
    beam.position.set(0, height, z);
    group.add(beam);
  }

  scene.add(group);

  // encuadre
  const box = new THREE.Box3().setFromObject(group);
  fitToBox(controls, camera, box);

  const s = qs("#ifc-status");
  if (s) s.textContent = "Preview 3D generado (modelo paramétrico).";
}

// =====================================================
// WIZARD
// =====================================================
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    // 1) llevar wizard -> industrial inputs
    setIndustrialInputsFromWizard(data);

    // 2) generar modelo paramétrico
    generateModelFromIndustrial();

    // 3) ver resultados
    renderBOMFromModel();
    refreshKPIs();
    runRules();

    // 4) dibujar preview 3D
    await renderParametricPreview();

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

// =====================================================
// INDUSTRIAL CONTROLS
// =====================================================
function updateIndustrialLabels() {
  const a = qs("#ind-span-value");
  const b = qs("#ind-length-value");
  const c = qs("#ind-height-value");
  const d = qs("#ind-frames-value");
  if (a && qs("#ind-span")) a.textContent = qs("#ind-span").value;
  if (b && qs("#ind-length")) b.textContent = qs("#ind-length").value;
  if (c && qs("#ind-height")) c.textContent = qs("#ind-height").value;
  if (d && qs("#ind-frames")) d.textContent = qs("#ind-frames").value;
}

function bindIndustrialControls() {
  ["#ind-span", "#ind-length", "#ind-height", "#ind-frames"].forEach((id) => {
    const el = qs(id);
    if (!el) return;
    el.addEventListener("input", updateIndustrialLabels);
  });

  updateIndustrialLabels();

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "generate-model") {
      generateModelFromIndustrial();
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

  const ifcInput = qs("#ifc-file");
  if (ifcInput) {
    ifcInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await loadIFCFile(file);
    });
  }
}

// =====================================================
// MODELO PARAMÉTRICO (JSON)
// =====================================================
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

  // Generación simple (BOM + reglas)
  for (let i = 0; i < frames; i++) {
    model.elements.push({ id: `COL-L-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `COL-R-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `BEAM-${i + 1}`, type: "viga", qty: 1, length: span, weightKg: span * 55 });
  }

  const purlins = Math.max(6, Math.round(length / 4));
  model.elements.push({ id: `PURLINS`, type: "correas", qty: purlins, length: span, weightKg: purlins * span * 8 });

  state.model = model;

  const gs = qs("#geometry-status");
  if (gs) gs.textContent = "Geometría calculada (modelo paramétrico).";

  const kv = qs("#kpi-version");
  if (kv) kv.textContent = String(state.version);

  renderBOMFromModel();
  refreshKPIs();

  const s = qs("#ifc-status");
  if (s) s.textContent = "Modelo generado (preview). Próximo: IFC real con backend.";
}

function computeTotals(model) {
  const elements = model?.elements || [];
  const count = elements.reduce((acc, e) => acc + (Number(e.qty) || 0), 0);
  const weight = elements.reduce((acc, e) => acc + (Number(e.weightKg) || 0), 0);
  return { count, weight };
}

function refreshKPIs() {
  const { count, weight } = computeTotals(state.model);
  const a = qs("#kpi-elements");
  const b = qs("#kpi-weight");
  if (a) a.textContent = fmt(count);
  if (b) b.textContent = fmt(weight);
}

// =====================================================
// BOM TABLE
// =====================================================
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

// =====================================================
// EXPORTS
// =====================================================
function exportJSON() {
  if (!state.model) {
    const s = qs("#ifc-status");
    if (s) s.textContent = "No hay modelo para exportar.";
    return;
  }
  downloadText(`rmm_model_v${state.version}.json`, JSON.stringify(state.model, null, 2), "application/json");
}

function exportBOM() {
  if (!state.model) {
    const s = qs("#ifc-status");
    if (s) s.textContent = "No hay modelo para exportar.";
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

// =====================================================
// REGLAS (VALIDACIONES)
// =====================================================
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

function rule(id, name, ok, msg) {
  return { id, name, ok: Boolean(ok), msg: msg || "" };
}

// =====================================================
// IFC VIEWER (IFC.js) - OPCIONAL (solo si cargas un IFC)
// =====================================================

// Loader con fallback de CDN + versión fija (GitHub Pages friendly)
async function loadIfcViewerModule() {
  const urls = [
    "https://esm.sh/web-ifc-viewer@1.0.218",
    "https://cdn.jsdelivr.net/npm/web-ifc-viewer@1.0.218/dist/ifc-viewer.es.js",
    "https://unpkg.com/web-ifc-viewer@1.0.218/dist/ifc-viewer.es.js",
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      return await import(url);
    } catch (e) {
      lastErr = e;
      console.warn("[IFC] Falló CDN:", url, e);
    }
  }
  throw lastErr || new Error("No se pudo cargar IFC Viewer");
}

async function ensureIfcViewer() {
  if (state.ifcViewer) return state.ifcViewer;

  const container = qs("#ifc-viewer");
  const status = qs("#viewer-status");
  if (!container) return null;

  try {
    const mod = await loadIfcViewerModule();
    const IfcViewerAPI = mod?.IfcViewerAPI || mod?.default?.IfcViewerAPI;
    if (!IfcViewerAPI) throw new Error("No se encontró IfcViewerAPI en el módulo.");

    // IMPORTANTE: IFC.js va a reutilizar el mismo contenedor
    // y va a reemplazar el canvas actual.
    container.innerHTML = "";

    const viewer = new IfcViewerAPI({
      container,
      backgroundColor: { r: 0.04, g: 0.07, b: 0.13, a: 1 },
    });

    viewer.grid.setGrid();
    viewer.axes.setAxes();
    viewer.context.renderer.postProduction.active = true;

    state.ifcViewer = viewer;
    if (status) status.textContent = "IFC listo";
    return viewer;
  } catch (err) {
    container.innerHTML = `
      <div style="padding:16px;color:#e2e8f0;font-weight:700;">
        No se pudo cargar IFC.js desde CDN.<br/>
        <span style="font-weight:400;color:#94a3b8;">
          Motivo: ${String(err?.message || err)}<br/>
          Solución industrial: instalar IFC.js por npm (Vite) y empaquetar.
        </span>
      </div>
    `;
    if (status) status.textContent = "Error IFC";
    return null;
  }
}

async function loadIFCFile(file) {
  const viewer = await ensureIfcViewer();
  if (!viewer) return;

  qs("#ifc-status").textContent = `Cargando IFC: ${file.name}...`;

  try {
    const url = URL.createObjectURL(file);
    await viewer.IFC.loadIfcUrl(url);
    URL.revokeObjectURL(url);

    state.ifcLoaded = true;
    qs("#viewer-status").textContent = "IFC cargado";
    qs("#ifc-status").textContent = `IFC cargado: ${file.name}`;
  } catch (err) {
    qs("#ifc-status").textContent = `Error cargando IFC: ${err?.message || err}`;
    qs("#viewer-status").textContent = "Error";
  }
}

async function resetViewer() {
  const container = qs("#ifc-viewer");
  if (!container) return;

  // reset: vuelve al visor paramétrico (Three.js)
  container.innerHTML = "";
  state.ifcViewer = null;
  state.ifcLoaded = false;

  qs("#viewer-status").textContent = "Visor activo";
  qs("#ifc-status").textContent = "Visor reiniciado (modo preview).";

  // recrea el viewer three y vuelve a dibujar el modelo si existe
  three = null;
  await ensureThreeViewer();
  if (state.model) await renderParametricPreview();
}

// =====================================================
// VERSIONADO LOCAL
// =====================================================
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
  const entry = {
    savedAt: nowISO(),
    version: state.version,
    model: state.model,
  };
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

  // redibuja preview
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

// =====================================================
// SUPABASE (opcional)
// =====================================================
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

    // redibuja preview
    await resetViewer();
  } catch (err) {
    status.textContent = `Error: ${err?.message || err}`;
  }
}

// =====================================================
// INIT
// =====================================================
async function init() {
  enhanceTooltips();
  bindModals();
  bindScrollButtons();
  bindAuth();
  bindWizard();
  bindIndustrialControls();

  // ✅ Inicializa el visor PREVIEW (Three.js) siempre (así no queda vacío)
  await ensureThreeViewer();

  renderPermissions(null);
  renderBOMFromModel();
  refreshKPIs();
  runRules();
  renderLocalVersions();

  // Si ya tenés modelo por alguna carga previa (raro), dibujalo
  if (state.model) await renderParametricPreview();
}

window.addEventListener("DOMContentLoaded", () => {
  init();
});
