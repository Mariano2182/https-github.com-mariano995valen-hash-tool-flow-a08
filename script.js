// script.js (ES Module) — GitHub Pages friendly (imports por URL completa)

const qs = (sel, parent = document) => parent.querySelector(sel);
const qsa = (sel, parent = document) => [...parent.querySelectorAll(sel)];

const state = {
  session: null,
  role: null,
  model: null,
  version: 0,
  wizardStep: 1,

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

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  if (!modal) return;
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
    const email = qs("#auth-email")?.value?.trim() || "";
    const role = qs("#auth-role")?.value || "Cliente";
    state.session = { email, role, at: nowISO() };
    state.role = role;

    const s = qs("#auth-status");
    if (s) s.textContent = `Sesión demo activa: ${email} (${role})`;
    renderPermissions(role);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="logout"]');
    if (!btn) return;

    state.session = null;
    state.role = null;
    const s = qs("#auth-status");
    if (s) s.textContent = "Sin sesión activa.";
    const ul = qs("#auth-permissions");
    if (ul) ul.innerHTML = "";
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="magic-link"]');
    if (!btn) return;

    const status = qs("#auth-supabase-status");
    const url = qs("#supabase-url")?.value?.trim();
    const key = qs("#supabase-key")?.value?.trim();
    if (!url || !key || !window.supabase) {
      if (status) status.textContent = "Supabase Auth sin configurar (cargá URL y ANON KEY en Backend).";
      return;
    }

    try {
      const client = window.supabase.createClient(url, key);
      const email = qs("#auth-email")?.value?.trim() || "";
      const { error } = await client.auth.signInWithOtp({ email });
      if (status) status.textContent = error ? `Error: ${error.message}` : "Magic link enviado (revisá tu email).";
    } catch (err) {
      if (status) status.textContent = `Error: ${err?.message || err}`;
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

    const ws = qs("#wizard-status");
    if (ws) ws.textContent = "Modelo generado. Revisá la vista industrial.";
    qs("#industrial")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  goStep(1);
}

function setIndustrialInputsFromWizard(data) {
  const span = qs("#ind-span");
  const length = qs("#ind-length");
  const height = qs("#ind-height");
  const frames = qs("#ind-frames");
  const cover = qs("#ind-cover");

  if (span) span.value = clamp(Number(data.ancho || 24), 10, 60);
  if (length) length.value = clamp(Number(data.largo || 60), 20, 200);
  if (height) height.value = clamp(Number(data.altura || 8), 4, 16);
  if (frames) frames.value = clamp(Number(data.porticos || 10), 4, 24);

  if (cover && data.cubierta) cover.value = data.cubierta;

  updateIndustrialLabels();
}

// -------------------- INDUSTRIAL CONTROLS --------------------
function updateIndustrialLabels() {
  const setTxt = (id, val) => {
    const el = qs(id);
    if (el) el.textContent = val;
  };

  setTxt("#ind-span-value", qs("#ind-span")?.value ?? "");
  setTxt("#ind-length-value", qs("#ind-length")?.value ?? "");
  setTxt("#ind-height-value", qs("#ind-height")?.value ?? "");
  setTxt("#ind-frames-value", qs("#ind-frames")?.value ?? "");

  if (qs("#ind-slope") && qs("#ind-slope-value")) setTxt("#ind-slope-value", qs("#ind-slope").value);
  if (qs("#ind-purlin") && qs("#ind-purlin-value")) setTxt("#ind-purlin-value", Number(qs("#ind-purlin").value).toFixed(2));
  if (qs("#ind-girt") && qs("#ind-girt-value")) setTxt("#ind-girt-value", Number(qs("#ind-girt").value).toFixed(2));
}

function bindIndustrialControls() {
  [
    "#ind-roof",
    "#ind-cover",
    "#ind-span",
    "#ind-length",
    "#ind-height",
    "#ind-frames",
    "#ind-slope",
    "#ind-purlin",
    "#ind-girt",
  ].forEach((id) => {
    const el = qs(id);
    if (!el) return;
    el.addEventListener("input", () => updateIndustrialLabels());
    el.addEventListener("change", () => updateIndustrialLabels());
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
      const st = qs("#ifc-status");
      if (st) st.textContent = "Carga IFC: pendiente de integrar IFC.js empaquetado. (Preview 3D funciona igual).";
      const vs = qs("#viewer-status");
      if (vs) vs.textContent = "Preview activo";
      e.target.value = "";
    });
  }
}

// -------------------- NUEVAS UTILIDADES BOM (ML + CLASIFICACIÓN) --------------------
function isPrimaryType(type) {
  // Estructura primaria = pórticos
  return type === "columna" || type === "cabio" || type === "viga";
}

function isSecondaryType(type) {
  // Estructura secundaria = correas + largueros
  return type === "correas" || type === "correas_columna";
}

function computeTotals(model) {
  const elements = model?.elements || [];
  const count = elements.reduce((acc, e) => acc + (Number(e.qty) || 0), 0);
  const weight = elements.reduce((acc, e) => acc + (Number(e.weightKg) || 0), 0);
  return { count, weight };
}

function computeTotalsByGroup(model) {
  const elements = model?.elements || [];

  let wPrimary = 0;
  let wSecondary = 0;
  let wOther = 0;

  for (const e of elements) {
    const w = Number(e.weightKg) || 0;
    if (isPrimaryType(e.type)) wPrimary += w;
    else if (isSecondaryType(e.type)) wSecondary += w;
    else wOther += w;
  }

  return {
    wPrimary,
    wSecondary,
    wOther,
    wTotal: wPrimary + wSecondary + wOther,
  };
}

function computeLinearMetersByType(model) {
  // m.l. por tipo = sum(qty * length)
  const elements = model?.elements || [];
  const map = new Map();

  for (const e of elements) {
    const type = e.type || "unknown";
    const qty = Number(e.qty) || 0;
    const len = Number(e.length) || 0;
    const ml = qty * len;

    const cur = map.get(type) || { type, ml: 0, qty: 0, w: 0 };
    cur.ml += ml;
    cur.qty += qty;
    cur.w += Number(e.weightKg) || 0;
    map.set(type, cur);
  }

  return [...map.values()].sort((a, b) => a.type.localeCompare(b.type));
}

// -------------------- MÉTRICAS INGENIERILES --------------------
function computeEngineering(model) {
  const b = model?.building;
  if (!b) {
    return {
      bays: 0,
      step: 0,
      planArea: 0,
      roofArea: 0,
      kgm2Plan: 0,
      kgm2Roof: 0,
      kgm2PlanPrimary: 0,
      kgm2PlanSecondary: 0,
      kgm2RoofPrimary: 0,
      kgm2RoofSecondary: 0,
      purlinLines: 0,
      purlinSegments: 0,
      girtLevelsL: 0,
      girtLevelsR: 0,
      girtSegments: 0,
    };
  }

  const bays = Math.max(1, (b.frames || 0) - 1);
  const step = (b.frames || 0) > 1 ? (b.length || 0) / ((b.frames || 0) - 1) : (b.length || 0);

  const planArea = (b.span || 0) * (b.length || 0);

  const slope = Number(b.slope || 0);
  const slopeFactor = b.roof === "plana" ? 1 : Math.sqrt(1 + slope * slope);
  const roofArea = planArea * slopeFactor;

  const totals = computeTotals(model);
  const grouped = computeTotalsByGroup(model);

  const kgm2Plan = planArea > 0 ? totals.weight / planArea : 0;
  const kgm2Roof = roofArea > 0 ? totals.weight / roofArea : 0;

  const kgm2PlanPrimary = planArea > 0 ? grouped.wPrimary / planArea : 0;
  const kgm2PlanSecondary = planArea > 0 ? grouped.wSecondary / planArea : 0;

  const kgm2RoofPrimary = roofArea > 0 ? grouped.wPrimary / roofArea : 0;
  const kgm2RoofSecondary = roofArea > 0 ? grouped.wSecondary / roofArea : 0;

  const purlinLines = Math.max(2, Math.floor((b.span || 0) / Math.max(0.1, b.purlinSpacing || 1.5)) + 1);
  const purlinSegments = purlinLines * bays;

  const startY = 1.2;
  const topL = Number(b.height || 0);
  const topR = b.roof === "una_agua" ? Number(b.height || 0) + (b.span || 0) * slope : Number(b.height || 0);

  const maxYL = Math.max(startY, topL - 0.30);
  const maxYR = Math.max(startY, topR - 0.30);

  const girtSpacing = Math.max(0.1, Number(b.girtSpacing || 1.5));
  const girtLevelsL = Math.max(2, Math.floor((maxYL - startY) / girtSpacing) + 1);
  const girtLevelsR = Math.max(2, Math.floor((maxYR - startY) / girtSpacing) + 1);

  const girtSegments = (girtLevelsL + girtLevelsR) * bays;

  return {
    bays,
    step,
    planArea,
    roofArea,
    kgm2Plan,
    kgm2Roof,
    kgm2PlanPrimary,
    kgm2PlanSecondary,
    kgm2RoofPrimary,
    kgm2RoofSecondary,
    purlinLines,
    purlinSegments,
    girtLevelsL,
    girtLevelsR,
    girtSegments,
  };
}

// -------------------- MODELO PARAMÉTRICO (JSON) --------------------
function generateModelFromIndustrial() {
  const span = Number(qs("#ind-span")?.value || 24);
  const length = Number(qs("#ind-length")?.value || 60);
  const height = Number(qs("#ind-height")?.value || 8);
  const frames = Number(qs("#ind-frames")?.value || 10);
  const roof = qs("#ind-roof")?.value || "dos_aguas";
  const cover = qs("#ind-cover")?.value || "chapa";

  const slopePct = Number(qs("#ind-slope")?.value || 10);
  const slope = clamp(slopePct / 100, 0.02, 0.25);

  const purlinSpacing = clamp(Number(qs("#ind-purlin")?.value || 1.5), 0.8, 2.5);
  const girtSpacing = clamp(Number(qs("#ind-girt")?.value || 1.5), 0.8, 2.2);

  const bays = Math.max(1, frames - 1);
  const step = frames > 1 ? length / (frames - 1) : length;

  state.version += 1;

  const model = {
    meta: { createdAt: nowISO(), version: state.version, unit: "m", source: "RMM Industrial UI" },
    building: {
      type: "nave",
      roof,
      cover,
      span,
      length,
      height,
      frames,
      slope,
      purlinSpacing,
      girtSpacing,
      bays,
      step,
    },
    elements: [],
  };

  // columnas y cabios/vigas por pórtico
  for (let i = 0; i < frames; i++) {
    model.elements.push({ id: `COL-L-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `COL-R-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });

    if (roof === "dos_aguas") {
      const rafterLen = Math.hypot(span / 2, (span / 2) * slope);
      model.elements.push({ id: `RAF-L-${i + 1}`, type: "cabio", qty: 1, length: rafterLen, weightKg: rafterLen * 40 });
      model.elements.push({ id: `RAF-R-${i + 1}`, type: "cabio", qty: 1, length: rafterLen, weightKg: rafterLen * 40 });
    } else {
      const beamLen = Math.hypot(span, roof === "una_agua" ? span * slope : 0);
      model.elements.push({ id: `BEAM-${i + 1}`, type: roof === "plana" ? "viga" : "cabio", qty: 1, length: beamLen, weightKg: beamLen * 55 });
    }
  }

  // correas de techo (segmentadas por vano)
  const purlinLines = Math.max(2, Math.floor(span / Math.max(0.1, purlinSpacing)) + 1);
  const purlinMembers = purlinLines * bays;

  model.elements.push({
    id: `PURLINS`,
    type: "correas",
    qty: purlinMembers,
    length: step,
    weightKg: purlinMembers * step * 8,
  });

  // largueros (segmentados por vano)
  const startY = 1.2;
  const topL = height;
  const topR = roof === "una_agua" ? height + span * slope : height;

  const maxYL = Math.max(startY, topL - 0.30);
  const maxYR = Math.max(startY, topR - 0.30);

  const levelsL = Math.max(2, Math.floor((maxYL - startY) / Math.max(0.1, girtSpacing)) + 1);
  const levelsR = Math.max(2, Math.floor((maxYR - startY) / Math.max(0.1, girtSpacing)) + 1);

  const girtMembers = (levelsL + levelsR) * bays;

  model.elements.push({
    id: `GIRTS`,
    type: "correas_columna",
    qty: girtMembers,
    length: step,
    weightKg: girtMembers * step * 6,
  });

  model.building.purlinLines = purlinLines;
  model.building.girtLevelsL = levelsL;
  model.building.girtLevelsR = levelsR;

  state.model = model;

  const gs = qs("#geometry-status");
  if (gs) gs.textContent = "Geometría calculada (modelo paramétrico).";

  const kv = qs("#kpi-version");
  if (kv) kv.textContent = String(state.version);

  renderBOMFromModel();
  refreshKPIs();
  runRules();

  const st = qs("#ifc-status");
  if (st) st.textContent = "Modelo generado. Preview 3D actualizado.";

  renderParametricPreview();
}

function refreshKPIs() {
  const { count, weight } = computeTotals(state.model);
  const ke = qs("#kpi-elements");
  const kw = qs("#kpi-weight");
  if (ke) ke.textContent = fmt(count);
  if (kw) kw.textContent = fmt(Math.round(weight));
}

// -------------------- BOM TABLE (ULTRA TÉCNICO + kg/m² por grupo + m.l.) --------------------
function renderBOMFromModel() {
  const tbody = qs("#materials-table");
  if (!tbody) return;

  if (!state.model) {
    tbody.innerHTML = `<tr><td colspan="4">Generá un modelo o cargá un IFC.</td></tr>`;
    return;
  }

  const b = state.model.building || {};
  const eng = computeEngineering(state.model);
  const totals = computeTotals(state.model);
  const grouped = computeTotalsByGroup(state.model);
  const mlByType = computeLinearMetersByType(state.model);

  // BOM agrupado por tipo
  const map = new Map();
  for (const e of state.model.elements) {
    const k = e.type;
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0, ml: 0 };
    cur.qty += Number(e.qty) || 0;
    cur.weightKg += Number(e.weightKg) || 0;
    cur.ml += (Number(e.qty) || 0) * (Number(e.length) || 0);
    map.set(k, cur);
  }

  const rows = [...map.values()].sort((a, b) => a.type.localeCompare(b.type));

  // Filas técnicas
  const techRows = [
    { name: "—", qty: "", w: "", status: "—" },

    { name: "MÉTRICAS (PESO POR SISTEMA)", qty: "", w: "", status: "INFO" },
    { name: "Peso primaria (kg) — 
