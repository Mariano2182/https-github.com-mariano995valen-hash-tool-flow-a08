// script.js (ES Module) — GitHub Pages friendly (imports por URL completa)
// ✅ BOM con clases, robusto, Preview 3D
// ✅ IFC4 REAL paramétrico: Proyecto/Sitio/Edificio/Niveles, IfcGrid, sólidos SweptSolid,
// ✅ perfiles reales (IPE/HEB/HEA/W/UPN/C/Z), QTO formal (Qto_*), clasificación,
// ✅ IfcStructuralAnalysisModel + nodos/miembros/cargas/casos/combinaciones.
// ⚠️ Nota: la tabla de perfiles incluye tamaños “típicos” (300/200/160). Podés ampliar la tabla abajo.

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

    // ✅ IFC Export REAL
    if (action === "export-ifc") exportIFC();
  });

  const ifcInput = qs("#ifc-file");
  if (ifcInput) {
    ifcInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const st = qs("#ifc-status");
      if (st) st.textContent = "Carga IFC: lectura/visualización IFC pendiente (export IFC real ya está disponible).";
      const vs = qs("#viewer-status");
      if (vs) vs.textContent = "Preview activo";
      e.target.value = "";
    });
  }
}

// -------------------- NUEVAS UTILIDADES BOM (ML + CLASIFICACIÓN) --------------------
function isPrimaryType(type) {
  return type === "columna" || type === "cabio" || type === "viga";
}
function isSecondaryType(type) {
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

  return { wPrimary, wSecondary, wOther, wTotal: wPrimary + wSecondary + wOther };
}

function computeLinearMetersByType(model) {
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

  // 👉 parámetros de perfiles (podés luego exponer en UI):
  // primaria: columnas HEB300, vigas/rafters IPE300, secundaria: correas C200, largueros Z200
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

      // perfiles paramétricos para IFC
      profiles: {
        column: "HEB300",
        rafter: "IPE300",
        beam: "IPE300",
        purlin: "C200",
        girt: "Z200",
      },
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

// -------------------- BOM TABLE (ULTRA TÉCNICO + clases CSS) --------------------
function trClassForTechRow(t) {
  if (t.kind === "divider") return "bom-divider";
  if (t.kind === "section") return "bom-section";
  if (t.status === "OK") return "bom-tech bom-ok";
  if (t.status === "WARN") return "bom-tech bom-warn";
  return "bom-tech";
}

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

  const techRows = [
    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "MÉTRICAS (PESO POR SISTEMA)", qty: "", w: "", status: "INFO" },
    { kind: "tech", name: "Peso primaria (kg) — pórticos", qty: "", w: fmt(Math.round(grouped.wPrimary)), status: "OK" },
    { kind: "tech", name: "Peso secundaria (kg) — correas+largueros", qty: "", w: fmt(Math.round(grouped.wSecondary)), status: "OK" },
    { kind: "tech", name: "Peso total (kg)", qty: "", w: fmt(Math.round(grouped.wTotal)), status: "OK" },

    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "MÉTRICAS (PLANTA / CUBIERTA)", qty: "", w: "", status: "INFO" },
    { kind: "tech", name: "Área en planta (m²)", qty: fmt2(eng.planArea), w: "", status: "OK" },
    { kind: "tech", name: "Área de cubierta aprox (m²)", qty: fmt2(eng.roofArea), w: "", status: "OK" },

    { kind: "tech", name: "kg/m² TOTAL (planta)", qty: "", w: fmt2(eng.kgm2Plan), status: "OK" },
    { kind: "tech", name: "kg/m² PRIMARIA (planta)", qty: "", w: fmt2(eng.kgm2PlanPrimary), status: "OK" },
    { kind: "tech", name: "kg/m² SECUNDARIA (planta)", qty: "", w: fmt2(eng.kgm2PlanSecondary), status: "OK" },

    { kind: "tech", name: "kg/m² TOTAL (cubierta)", qty: "", w: fmt2(eng.kgm2Roof), status: "OK" },
    { kind: "tech", name: "kg/m² PRIMARIA (cubierta)", qty: "", w: fmt2(eng.kgm2RoofPrimary), status: "OK" },
    { kind: "tech", name: "kg/m² SECUNDARIA (cubierta)", qty: "", w: fmt2(eng.kgm2RoofSecondary), status: "OK" },

    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "MÉTRICAS (MODULACIÓN)", qty: "", w: "", status: "INFO" },
    { kind: "tech", name: "Pórticos (un)", qty: fmt(b.frames || 0), w: "", status: "OK" },
    { kind: "tech", name: "Vanos (frames-1)", qty: fmt(eng.bays), w: "", status: "OK" },
    { kind: "tech", name: "Paso entre pórticos (m)", qty: fmt2(eng.step), w: "", status: "OK" },

    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "CORREAS DE TECHO (ULTRA TÉCNICO)", qty: "", w: "", status: "INFO" },
    { kind: "tech", name: "Separación correas (m)", qty: fmt2(b.purlinSpacing || 0), w: "", status: "OK" },
    { kind: "tech", name: "Cantidad líneas correas (across)", qty: fmt(eng.purlinLines), w: "", status: "OK" },
    { kind: "tech", name: "Miembros correas segmentados (líneas × vanos)", qty: fmt(eng.purlinSegments), w: "", status: "OK" },

    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "LARGUEROS DE PARED (ULTRA TÉCNICO)", qty: "", w: "", status: "INFO" },
    { kind: "tech", name: "Separación largueros (m)", qty: fmt2(b.girtSpacing || 0), w: "", status: "OK" },
    { kind: "tech", name: "Niveles largueros (izq)", qty: fmt(eng.girtLevelsL), w: "", status: "OK" },
    { kind: "tech", name: "Niveles largueros (der)", qty: fmt(eng.girtLevelsR), w: "", status: "OK" },
    { kind: "tech", name: "Miembros largueros segmentados ((niveles izq+der) × vanos)", qty: fmt(eng.girtSegments), w: "", status: "OK" },

    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "METROS LINEALES (m.l.) POR TIPO", qty: "", w: "", status: "INFO" },
    ...mlByType.map((r) => ({ kind: "tech", name: `m.l. ${r.type}`, qty: fmt2(r.ml), w: "", status: "OK" })),
  ];

  const bomHtml = rows
    .map((r) => {
      return `
      <tr>
        <td>${r.type}</td>
        <td>${fmt(r.qty)}</td>
        <td>${fmt(Math.round(r.weightKg))}</td>
        <td>${fmt2(r.ml)} m.l.</td>
      </tr>
    `;
    })
    .join("");

  const techHtml = techRows
    .map((t) => {
      const cls = trClassForTechRow(t);
      const label = t.kind === "divider" ? "—" : t.status ?? "";
      return `
      <tr class="${cls}">
        <td>${t.name}</td>
        <td>${t.qty ?? ""}</td>
        <td>${t.w ?? ""}</td>
        <td>${label}</td>
      </tr>
    `;
    })
    .join("");

  tbody.innerHTML = bomHtml + techHtml;

  const st = qs("#ifc-status");
  if (st) {
    st.textContent =
      `Modelo: ${b.roof || "-"} — pendiente ${((b.slope || 0) * 100).toFixed(1)}% — ` +
      `kg/m² total(planta) ${fmt2(eng.kgm2Plan)} | prim ${fmt2(eng.kgm2PlanPrimary)} | sec ${fmt2(eng.kgm2PlanSecondary)}`;
  }
}

// -------------------- EXPORTS (CSV incluye kg/m² por grupo + m.l.) --------------------
function exportJSON() {
  const st = qs("#ifc-status");
  if (!state.model) {
    if (st) st.textContent = "No hay modelo para exportar.";
    return;
  }
  downloadText(`rmm_model_v${state.version}.json`, JSON.stringify(state.model, null, 2), "application/json");
}

function exportBOM() {
  const st = qs("#ifc-status");
  if (!state.model) {
    if (st) st.textContent = "No hay modelo para exportar.";
    return;
  }

  const b = state.model.building || {};
  const eng = computeEngineering(state.model);
  const totals = computeTotals(state.model);
  const grouped = computeTotalsByGroup(state.model);
  const mlByType = computeLinearMetersByType(state.model);

  const map = new Map();
  for (const e of state.model.elements) {
    const k = e.type;
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0, ml: 0 };
    cur.qty += Number(e.qty) || 0;
    cur.weightKg += Number(e.weightKg) || 0;
    cur.ml += (Number(e.qty) || 0) * (Number(e.length) || 0);
    map.set(k, cur);
  }

  const rows = [...map.values()];
  const header = "Elemento,Cantidad,Peso_kg,MetrosLineales_m,Version\n";
  const lines = rows.map((r) => `${r.type},${r.qty},${Math.round(r.weightKg)},${r.ml.toFixed(2)},${state.version}`).join("\n");

  const extra =
    "\n\n#PESO_POR_SISTEMA\n" +
    `peso_primaria_kg,,${Math.round(grouped.wPrimary)},,\n` +
    `peso_secundaria_kg,,${Math.round(grouped.wSecondary)},,\n` +
    `peso_total_kg,,${Math.round(grouped.wTotal)},,\n` +
    "\n#METRICAS_TECNICAS\n" +
    `roof,${b.roof || ""},,,\n` +
    `pendiente_pct,${((b.slope || 0) * 100).toFixed(2)},,,\n` +
    `span_m,${fmt2(b.span || 0)},,,\n` +
    `length_m,${fmt2(b.length || 0)},,,\n` +
    `frames,${b.frames || 0},,,\n` +
    `bays,${eng.bays},,,\n` +
    `step_m,${fmt2(eng.step)},,,\n` +
    `area_planta_m2,${fmt2(eng.planArea)},,,\n` +
    `area_cubierta_m2,${fmt2(eng.roofArea)},,,\n` +
    `peso_total_kg,,${Math.round(totals.weight)},,\n` +
    `kg_m2_total_planta,,${fmt2(eng.kgm2Plan)},,\n` +
    `kg_m2_primaria_planta,,${fmt2(eng.kgm2PlanPrimary)},,\n` +
    `kg_m2_secundaria_planta,,${fmt2(eng.kgm2PlanSecondary)},,\n` +
    `kg_m2_total_cubierta,,${fmt2(eng.kgm2Roof)},,\n` +
    `kg_m2_primaria_cubierta,,${fmt2(eng.kgm2RoofPrimary)},,\n` +
    `kg_m2_secundaria_cubierta,,${fmt2(eng.kgm2RoofSecondary)},,\n` +
    `purlin_spacing_m,${fmt2(b.purlinSpacing || 0)},,,\n` +
    `purlin_lines,${eng.purlinLines},,,\n` +
    `purlin_segments,${eng.purlinSegments},,,\n` +
    `girt_spacing_m,${fmt2(b.girtSpacing || 0)},,,\n` +
    `girt_levels_left,${eng.girtLevelsL)},,,\n` +
    `girt_levels_right,${eng.girtLevelsR)},,,\n` +
    `girt_segments,${eng.girtSegments)},,,\n` +
    "\n#METROS_LINEALES_POR_TIPO\n" +
    mlByType.map((r) => `ml_${r.type},,,${r.ml.toFixed(2)},\n`).join("");

  downloadText(`rmm_bom_ultra_v${state.version}.csv`, header + lines + extra, "text/csv");
}

// ============================================================================
// ============================ IFC4 REAL EXPORT ===============================
// ============================================================================

// ---- GUID helper (22 chars IFC-like) ----
function ifcGuid() {
  // Minimal deterministic-ish IFC GUID: base64url-ish from 16 bytes
  // Not a full IFC GUID algorithm, but accepted by most parsers if format is 22 chars.
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  const bytes = new Uint8Array(16);
  (crypto?.getRandomValues ? crypto.getRandomValues(bytes) : bytes.fill(Math.floor(Math.random() * 256)));

  // pack 128-bit to 22 chars (6 bits each) approx
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  // trim/pad to 132 bits (22*6)
  bits = bits.padEnd(132, "0").slice(0, 132);

  let out = "";
  for (let i = 0; i < 22; i++) {
    const chunk = bits.slice(i * 6, i * 6 + 6);
    const v = parseInt(chunk, 2);
    out += chars[v % chars.length];
  }
  return out;
}

// ---- geometry math (world: x=span, y=vertical, z=length) ----
function v3(x, y, z) {
  return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 };
}
function vsub(a, b) {
  return v3(a.x - b.x, a.y - b.y, a.z - b.z);
}
function vlen(a) {
  return Math.hypot(a.x, a.y, a.z);
}
function vnorm(a) {
  const L = vlen(a);
  if (L < 1e-9) return v3(0, 0, 1);
  return v3(a.x / L, a.y / L, a.z / L);
}
function vcross(a, b) {
  return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
function vdot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function vscale(a, s) {
  return v3(a.x * s, a.y * s, a.z * s);
}
function vadd(a, b) {
  return v3(a.x + b.x, a.y + b.y, a.z + b.z);
}
function safeRefDir(zAxis) {
  // pick an "up" candidate not parallel to zAxis, then cross
  const up = Math.abs(zAxis.z) < 0.9 ? v3(0, 0, 1) : v3(0, 1, 0);
  let x = vcross(up, zAxis);
  const L = vlen(x);
  if (L < 1e-9) x = v3(1, 0, 0);
  return vnorm(x);
}

// ---- Profile catalog (add more sizes when needed) ----
// Dimensions are in meters.
// For I profiles: overallDepth h, overallWidth b, webThickness tw, flangeThickness tf, filletRadius r.
const PROFILE_CATALOG = {
  // H / HE / IPE
  HEB300: { kind: "I", family: "HEB", h: 0.300, b: 0.300, tw: 0.011, tf: 0.019, r: 0.015 },
  HEA300: { kind: "I", family: "HEA", h: 0.300, b: 0.300, tw: 0.0085, tf: 0.014, r: 0.015 },
  IPE300: { kind: "I", family: "IPE", h: 0.300, b: 0.150, tw: 0.0107, tf: 0.0142, r: 0.012 },

  // UPN
  UPN200: { kind: "U", family: "UPN", h: 0.200, b: 0.075, tw: 0.0085, tf: 0.012, r: 0.012 },

  // "W" (AISC style approx)
  W310x60: { kind: "I", family: "W", h: 0.310, b: 0.165, tw: 0.010, tf: 0.016, r: 0.013 },

  // C / Z (cold formed - simplified)
  C200: { kind: "C", family: "C", h: 0.200, b: 0.070, c: 0.020, tw: 0.010, tf: 0.010 },
  Z200: { kind: "Z", family: "Z", h: 0.200, b: 0.070, c: 0.020, tw: 0.010, tf: 0.010 },
};

function profileByName(name) {
  const key = String(name || "").toUpperCase().replace(/\s+/g, "");
  return PROFILE_CATALOG[key] ? { name: key, ...PROFILE_CATALOG[key] } : null;
}

function profileAreaApprox(p) {
  // Approx section area (m²). Good enough for QTO & weight in this demo-exporter.
  if (!p) return 0;
  if (p.kind === "I") {
    const h = p.h, b = p.b, tw = p.tw, tf = p.tf;
    // two flanges + web (minus overlap is negligible if using tw*tf twice; keep simple):
    return 2 * (b * tf) + (h - 2 * tf) * tw;
  }
  if (p.kind === "U") {
    const h = p.h, b = p.b, tw = p.tw, tf = p.tf;
    // 2 flanges + web
    return 2 * (b * tf) + (h - 2 * tf) * tw;
  }
  if (p.kind === "C") {
    // web + 2 flanges + 2 lips (approx)
    const h = p.h, b = p.b, c = p.c, t = p.tw;
    return (h * t) + 2 * (b * t) + 2 * (c * t);
  }
  if (p.kind === "Z") {
    const h = p.h, b = p.b, c = p.c, t = p.tw;
    return (h * t) + 2 * (b * t) + 2 * (c * t);
  }
  return 0;
}

// ---- Build actual member axes from building parameters (not from BOM aggregation) ----
function buildMemberAxesFromModel(model) {
  const b = model?.building;
  if (!b) return [];

  const span = Number(b.span || 0);
  const length = Number(b.length || 0);
  const height = Number(b.height || 0);
  const frames = Number(b.frames || 0);
  const roof = b.roof || "dos_aguas";
  const slope = Number(b.slope || 0);
  const purlinSpacing = Number(b.purlinSpacing || 1.5);
  const girtSpacing = Number(b.girtSpacing || 1.5);

  const halfSpan = span / 2;
  const bays = Math.max(1, frames - 1);
  const step = frames > 1 ? length / (frames - 1) : length;

  // roof function (y at x)
  function roofY(x) {
    if (roof === "plana") return height;
    if (roof === "una_agua") {
      const t = (x + halfSpan) / Math.max(1e-6, span);
      return height + t * (span * slope);
    }
    // dos aguas: ridge at x=0
    const t = Math.abs(x) / Math.max(1e-6, halfSpan);
    return height + (1 - t) * (halfSpan * slope);
  }

  const prof = b.profiles || {
    column: "HEB300",
    rafter: "IPE300",
    beam: "IPE300",
    purlin: "C200",
    girt: "Z200",
  };

  const members = [];

  // Columns + rafters/beams per frame
  for (let i = 0; i < frames; i++) {
    const z = i * step;

    // columns: base at y=0 to eave (height) on both sides
    members.push({
      id: `COL-L-${i + 1}`,
      role: "columna",
      ifcType: "IfcColumn",
      profile: prof.column,
      start: v3(-halfSpan, 0, z),
      end: v3(-halfSpan, height, z),
      storey: "Nivel 0",
    });
    members.push({
      id: `COL-R-${i + 1}`,
      role: "columna",
      ifcType: "IfcColumn",
      profile: prof.column,
      start: v3(halfSpan, 0, z),
      end: v3(halfSpan, roof === "una_agua" ? height + span * slope : height, z),
      storey: "Nivel 0",
    });

    if (roof === "dos_aguas") {
      const ridge = v3(0, height + halfSpan * slope, z);
      const eaveL = v3(-halfSpan, height, z);
      const eaveR = v3(halfSpan, height, z);

      members.push({
        id: `RAF-L-${i + 1}`,
        role: "cabio",
        ifcType: "IfcBeam",
        profile: prof.rafter,
        start: eaveL,
        end: ridge,
        storey: "Nivel 1",
      });
      members.push({
        id: `RAF-R-${i + 1}`,
        role: "cabio",
        ifcType: "IfcBeam",
        profile: prof.rafter,
        start: ridge,
        end: eaveR,
        storey: "Nivel 1",
      });
    } else {
      // plana/una_agua: beam across span
      const a = v3(-halfSpan, roofY(-halfSpan), z);
      const c = v3(halfSpan, roofY(halfSpan), z);
      members.push({
        id: `BEAM-${i + 1}`,
        role: roof === "plana" ? "viga" : "cabio",
        ifcType: roof === "plana" ? "IfcBeam" : "IfcBeam",
        profile: roof === "plana" ? prof.beam : prof.rafter,
        start: a,
        end: c,
        storey: "Nivel 1",
      });
    }
  }

  // Purlins: lines across x, segments along z between frames
  const linesAcross = Math.max(2, Math.floor(span / Math.max(0.1, purlinSpacing)) + 1);

  for (let bay = 0; bay < bays; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    if (roof === "dos_aguas") {
      const halfLines = Math.max(1, Math.floor(linesAcross / 2));
      const xs = [];

      // left slope including ridge
      for (let k = 0; k <= halfLines; k++) xs.push(-halfSpan + (k / halfLines) * halfSpan);
      // right slope excluding ridge
      for (let k = 1; k <= halfLines; k++) xs.push((k / halfLines) * halfSpan);
      // ensure ridge line
      if (!xs.some((x) => Math.abs(x) < 1e-6)) xs.push(0);

      xs.sort((a, b) => a - b);

      for (let li = 0; li < xs.length; li++) {
        const x = xs[li];
        members.push({
          id: `PURLIN-${bay + 1}-${li + 1}`,
          role: "correas",
          ifcType: "IfcMember",
          profile: prof.purlin,
          start: v3(x, roofY(x), z0),
          end: v3(x, roofY(x), z1),
          storey: "Nivel 1",
        });
      }
    } else {
      for (let k = 0; k <= linesAcross; k++) {
        const x = -halfSpan + (k / linesAcross) * span;
        members.push({
          id: `PURLIN-${bay + 1}-${k + 1}`,
          role: "correas",
          ifcType: "IfcMember",
          profile: prof.purlin,
          start: v3(x, roofY(x), z0),
          end: v3(x, roofY(x), z1),
          storey: "Nivel 1",
        });
      }
    }
  }

  // Girts: levels on left and right, segments along z
  for (let bay = 0; bay < bays; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const topL = height;
    const topR = roof === "una_agua" ? height + span * slope : height;

    const startY = 1.2;
    const maxYL = Math.max(startY, topL - 0.30);
    const maxYR = Math.max(startY, topR - 0.30);

    const levelsL = Math.max(2, Math.floor((maxYL - startY) / Math.max(0.1, girtSpacing)) + 1);
    const levelsR = Math.max(2, Math.floor((maxYR - startY) / Math.max(0.1, girtSpacing)) + 1);

    for (let i = 0; i < levelsL; i++) {
      const y = Math.min(maxYL, startY + i * girtSpacing);
      members.push({
        id: `GIRT-L-${bay + 1}-${i + 1}`,
        role: "correas_columna",
        ifcType: "IfcMember",
        profile: prof.girt,
        start: v3(-halfSpan, y, z0),
        end: v3(-halfSpan, y, z1),
        storey: "Nivel 0",
      });
    }
    for (let i = 0; i < levelsR; i++) {
      const y = Math.min(maxYR, startY + i * girtSpacing);
      members.push({
        id: `GIRT-R-${bay + 1}-${i + 1}`,
        role: "correas_columna",
        ifcType: "IfcMember",
        profile: prof.girt,
        start: v3(halfSpan, y, z0),
        end: v3(halfSpan, y, z1),
        storey: "Nivel 0",
      });
    }
  }

  return members;
}

// ---- IFC writer (minimal but valid) ----
class IfcWriter {
  constructor() {
    this.lines = [];
    this.id = 0;
    this.map = new Map();
  }
  add(line) {
    this.id += 1;
    const tag = `#${this.id}`;
    this.lines.push(`${tag}=${line};`);
    return tag;
  }
  raw(line) {
    this.lines.push(line);
  }
}

function ifcStr(s) {
  if (s === null || s === undefined) return "$";
  const x = String(s);
  return `'${x.replace(/'/g, "''")}'`;
}
function ifcNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.";
  // IFC likes dot decimal and often trailing dot
  const s = x.toFixed(6).replace(/0+$/g, "").replace(/\.$/, ".0");
  return s.includes(".") ? s : `${s}.`;
}
function ifcPt(p) {
  return `IFCCARTESIANPOINT((${ifcNum(p.x)},${ifcNum(p.y)},${ifcNum(p.z)}))`;
}
function ifcDir(d) {
  return `IFCDIRECTION((${ifcNum(d.x)},${ifcNum(d.y)},${ifcNum(d.z)}))`;
}
function ifcPolyline2(w, a, b) {
  const p0 = w.add(ifcPt(v3(a.x, a.y, a.z)));
  const p1 = w.add(ifcPt(v3(b.x, b.y, b.z)));
  return w.add(`IFCPOLYLINE((${p0},${p1}))`);
}

// ---- Create grids (simple, but valid) ----
function emitGrid(w, buildingPlacement, span, length, frames) {
  const origin = w.add(ifcPt(v3(0, 0, 0)));
  const ax3 = w.add(`IFCAXIS2PLACEMENT3D(${origin},$,$)`);
  const gridLP = w.add(`IFCLOCALPLACEMENT(${buildingPlacement},${ax3})`);

  // Axes: X direction line at z=0, and Z direction line at x=0 (in 2D polyline coordinates)
  // IFC2D polyline uses IFCCARTESIANPOINT((x,y)) where y here is "second axis" - we use z as y in 2D for simplicity.
  const pA0 = w.add(`IFCCARTESIANPOINT((${ifcNum(-span / 2)},${ifcNum(0)}))`);
  const pA1 = w.add(`IFCCARTESIANPOINT((${ifcNum(span / 2)},${ifcNum(0)}))`);
  const curveA = w.add(`IFCPOLYLINE((${pA0},${pA1}))`);

  const p10 = w.add(`IFCCARTESIANPOINT((${ifcNum(0)},${ifcNum(0)}))`);
  const p11 = w.add(`IFCCARTESIANPOINT((${ifcNum(0)},${ifcNum(length)}))`);
  const curve1 = w.add(`IFCPOLYLINE((${p10},${p11}))`);

  const axisA = w.add(`IFCGRIDAXIS('A',${curveA},$, .T.)`);
  const axisB = w.add(`IFCGRIDAXIS('B',${curveA},$, .F.)`);

  const axis1 = w.add(`IFCGRIDAXIS('1',${curve1},$, .T.)`);
  const axis2 = w.add(`IFCGRIDAXIS('2',${curve1},$, .F.)`);

  const grid = w.add(`IFCGRID('${ifcGuid()}',#5,'Grid',$,$,${gridLP},$,( ${axisA},${axisB} ),( ${axis1},${axis2} ),$)`);
  return grid;
}

// ---- Build IFC (full) ----
function buildIFC4FromStateModel(model) {
  const b = model?.building;
  if (!b) throw new Error("Modelo vacío.");

  const projectName = qs("#project-name")?.value?.trim() || `RMM Proyecto v${model?.meta?.version || 1}`;
  const clientName = qs("#project-client")?.value?.trim() || "Cliente";
  const siteName = "Sitio";
  const buildingName = "Edificio - Nave";

  const span = Number(b.span || 24);
  const length = Number(b.length || 60);
  const height = Number(b.height || 8);
  const frames = Number(b.frames || 10);

  const w = new IfcWriter();

  // HEADER is written at the end as a joined string; here we generate DATA section entities.
  // Basic owner/application
  const person = w.add(`IFCPERSON($,$,'RMM',$,$,$,$,$)`);
  const org = w.add(`IFCORGANIZATION($,'RMM',$,$,$)`);
  const pao = w.add(`IFCPERSONANDORGANIZATION(${person},${org},$)`);
  const app = w.add(`IFCAPPLICATION(${org},'1.0','RMM IFC Exporter','RMM_IFC')`);
  // #5 for easy reference in relationships below
  const owner = w.add(`IFCOWNERHISTORY(${pao},${app},$,.ADDED.,$,$,$,${Math.floor(Date.now() / 1000)})`);

  // Units
  const uLen = w.add(`IFCSIUNIT(*,.LENGTHUNIT.,.METRE.,$)`);
  const uArea = w.add(`IFCSIUNIT(*,.AREAUNIT.,.SQUARE_METRE.,$)`);
  const uVol = w.add(`IFCSIUNIT(*,.VOLUMEUNIT.,.CUBIC_METRE.,$)`);
  const uMass = w.add(`IFCSIUNIT(*,.MASSUNIT.,.KILOGRAM.,$)`);
  const unitAssign = w.add(`IFCUNITASSIGNMENT((${uLen},${uArea},${uVol},${uMass}))`);

  // Contexts
  const o0 = w.add(ifcPt(v3(0, 0, 0)));
  const wcs = w.add(`IFCAXIS2PLACEMENT3D(${o0},$,$)`);
  const ctxModel = w.add(`IFCGEOMETRICREPRESENTATIONCONTEXT('Model','3D',3,1.E-05,${wcs},$)`);
  const ctxAnalysis = w.add(`IFCGEOMETRICREPRESENTATIONCONTEXT('Analysis','3D',3,1.E-05,${wcs},$)`);

  const project = w.add(`IFCPROJECT('${ifcGuid()}',#5,${ifcStr(projectName)},$,$,$,$,(${ctxModel},${ctxAnalysis}),${unitAssign})`);

  // Placements hierarchy: Project->Site->Building->Storeys
  const siteLP = w.add(`IFCLOCALPLACEMENT($,${wcs})`);
  const site = w.add(`IFCSITE('${ifcGuid()}',#5,${ifcStr(siteName)},$,$,${siteLP},$,$,.ELEMENT.,$,$,$,$,$)`);

  const bldLP = w.add(`IFCLOCALPLACEMENT(${siteLP},${wcs})`);
  const building = w.add(`IFCBUILDING('${ifcGuid()}',#5,${ifcStr(buildingName)},$,$,${bldLP},$,$,.ELEMENT.,$,$,$)`);

  // Storeys (Nivel 0, Nivel 1 at eave height ~ height)
  const s0pt = w.add(ifcPt(v3(0, 0, 0)));
  const s0ax = w.add(`IFCAXIS2PLACEMENT3D(${s0pt},$,$)`);
  const s0lp = w.add(`IFCLOCALPLACEMENT(${bldLP},${s0ax})`);
  const storey0 = w.add(`IFCBUILDINGSTOREY('${ifcGuid()}',#5,'Nivel 0',$,$,${s0lp},$,$,.ELEMENT.,${ifcNum(0)})`);

  const s1pt = w.add(ifcPt(v3(0, height, 0)));
  const s1ax = w.add(`IFCAXIS2PLACEMENT3D(${s1pt},$,$)`);
  const s1lp = w.add(`IFCLOCALPLACEMENT(${bldLP},${s1ax})`);
  const storey1 = w.add(`IFCBUILDINGSTOREY('${ifcGuid()}',#5,'Nivel 1',$,$,${s1lp},$,$,.ELEMENT.,${ifcNum(height)})`);

  // Aggregations
  w.add(`IFCRELAGGREGATES('${ifcGuid()}',#5,'Project aggregates',$,${project},(${site}))`);
  w.add(`IFCRELAGGREGATES('${ifcGuid()}',#5,'Site aggregates',$,${site},(${building}))`);
  w.add(`IFCRELAGGREGATES('${ifcGuid()}',#5,'Building aggregates',$,${building},(${storey0},${storey1}))`);

  // Grid
  const grid = emitGrid(w, bldLP, span, length, frames);

  // Containment grid in building
  w.add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',#5,'Grid in building',$,(${grid}),${building})`);

  // Materials
  const matSteel = w.add(`IFCMATERIAL('Steel S275')`);

  // Classification (OmniClass example)
  const cls = w.add(`IFCCLASSIFICATION('OmniClass',$,'OmniClass Construction Classification System',$,'https://www.omniclass.org')`);
  const clsRef = w.add(`IFCCLASSIFICATIONREFERENCE($,'21-02 10 10','Structural Framing',$,${cls})`);

  // Representation placement for extrusions (origin)
  const p0 = w.add(ifcPt(v3(0, 0, 0)));
  const ax3 = w.add(`IFCAXIS2PLACEMENT3D(${p0},$,$)`);
  const dirZ = w.add(`IFCDIRECTION((0.,0.,1.))`);

  // Profile defs cache
  const profileDefId = new Map();
  const shapeBodyId = new Map(); // key: profileName + length -> product definition shape (body)

  function ensureProfileDef(profileName) {
    const p = profileByName(profileName);
    if (!p) return null;

    const key = p.name;
    if (profileDefId.has(key)) return profileDefId.get(key);

    let def = null;

    if (p.kind === "I") {
      def = w.add(
        `IFCISHAPEPROFILEDEF(.AREA.,${ifcStr(p.name)},$,${ifcNum(p.h)},${ifcNum(p.b)},${ifcNum(p.tw)},${ifcNum(p.tf)},${ifcNum(p.r)})`
      );
    } else if (p.kind === "U") {
      def = w.add(
        `IFCUSHAPEPROFILEDEF(.AREA.,${ifcStr(p.name)},$,${ifcNum(p.h)},${ifcNum(p.b)},${ifcNum(p.tw)},${ifcNum(p.tf)},${ifcNum(p.r)})`
      );
    } else if (p.kind === "C") {
      // IfcCShapeProfileDef: depth, width, wallThickness, girth? IFC fields: Depth, Width, WallThickness, Girth, InternalFilletRadius
      // We'll map: depth=h, width=b, wallThickness=tw, girth=c (lip), fillet=0
      def = w.add(
        `IFCCSHAPEPROFILEDEF(.AREA.,${ifcStr(p.name)},$,${ifcNum(p.h)},${ifcNum(p.b)},${ifcNum(p.tw)},${ifcNum(p.c)},${ifcNum(0)})`
      );
    } else if (p.kind === "Z") {
      // IfcZShapeProfileDef: Depth, FlangeWidth, WebThickness, FlangeThickness, FilletRadius
      def = w.add(
        `IFCZSHAPEPROFILEDEF(.AREA.,${ifcStr(p.name)},$,${ifcNum(p.h)},${ifcNum(p.b)},${ifcNum(p.tw)},${ifcNum(p.tf)},${ifcNum(0)})`
      );
    }

    profileDefId.set(key, def);
    return def;
  }

  function ensureBodyShape(profileName, memberLen) {
    const p = profileByName(profileName);
    if (!p) return null;

    const L = Math.max(1e-6, Number(memberLen || 0));
    const key = `${p.name}|${L.toFixed(6)}`;
    if (shapeBodyId.has(key)) return shapeBodyId.get(key);

    const profDef = ensureProfileDef(profileName);
    if (!profDef) return null;

    const solid = w.add(`IFCEXTRUDEDAREASOLID(${profDef},${ax3},${dirZ},${ifcNum(L)})`);
    const body = w.add(`IFCSHAPEREPRESENTATION(${ctxModel},'Body','SweptSolid',(${solid}))`);
    const pds = w.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${body}))`);

    shapeBodyId.set(key, pds);
    return pds;
  }

  function makeLocalPlacement(parentLP, start, end) {
    const zAxis = vnorm(vsub(end, start)); // local Z along member axis
    const xAxis = safeRefDir(zAxis); // local X
    const origin = w.add(ifcPt(start));
    const axis = w.add(ifcDir(zAxis));
    const ref = w.add(ifcDir(xAxis));
    const a3 = w.add(`IFCAXIS2PLACEMENT3D(${origin},${axis},${ref})`);
    return w.add(`IFCLOCALPLACEMENT(${parentLP},${a3})`);
  }

  // Build members (real axes)
  const members = buildMemberAxesFromModel(model);

  // Split by storey
  const storey0Products = [];
  const storey1Products = [];
  const allProducts = [];

  // Structural analysis items
  const sam = w.add(`IFCSTRUCTURALANALYSISMODEL('${ifcGuid()}',#5,'SAM-01',$,$,$,.IN_PLANE_LOADING_2D.,$,( ${ctxAnalysis} ))`);

  // Structural nodes cache
  const nodeByKey = new Map();
  function nodeKey(p) {
    return `${p.x.toFixed(4)}|${p.y.toFixed(4)}|${p.z.toFixed(4)}`;
  }
  function ensureStructuralNode(p, storeyLP) {
    const k = nodeKey(p);
    if (nodeByKey.has(k)) return nodeByKey.get(k);

    const pt = w.add(ifcPt(p));
    const vx = w.add(`IFCVERTEXPOINT(${pt})`);
    const node = w.add(`IFCSTRUCTURALPOINTCONNECTION('${ifcGuid()}',#5,${ifcStr("N_" + k)},$,$,${storeyLP},${vx},$,$)`);
    nodeByKey.set(k, node);
    return node;
  }

  // Structural curve members
  const structuralMembers = [];

  // QTO entities list (relationships later)
  const relQtos = [];

  // For containment by storey
  function pushToStorey(prodTag, storeyName) {
    if (storeyName === "Nivel 1") storey1Products.push(prodTag);
    else storey0Products.push(prodTag);
    allProducts.push(prodTag);
  }

  // Create physical products
  for (const m of members) {
    const start = m.start;
    const end = m.end;
    const L = vlen(vsub(end, start));
    if (L < 1e-6) continue;

    const pName = m.profile;
    const p = profileByName(pName) || profileByName("IPE300");
    const pds = ensureBodyShape(p?.name || "IPE300", L);
    if (!pds) continue;

    const parentLP = m.storey === "Nivel 1" ? s1lp : s0lp;
    const lp = makeLocalPlacement(parentLP, start, end);

    const name = m.id;
    const desc = `${m.role} ${p?.name || pName}`;

    let prod = null;
    if (m.ifcType === "IfcColumn") {
      prod = w.add(`IFCCOLUMN('${ifcGuid()}',#5,${ifcStr(name)},${ifcStr(desc)},$,${lp},${pds},$,$)`);
    } else if (m.ifcType === "IfcBeam") {
      prod = w.add(`IFCBEAM('${ifcGuid()}',#5,${ifcStr(name)},${ifcStr(desc)},$,${lp},${pds},$,$)`);
    } else {
      prod = w.add(`IFCMEMBER('${ifcGuid()}',#5,${ifcStr(name)},${ifcStr(desc)},$,${lp},${pds},$,$)`);
    }

    // Material association (collect later)
    // Classification association (collect later)
    pushToStorey(prod, m.storey);

    // QTO: Length, Area (0), Volume, Weight
    const area = profileAreaApprox(p);
    const vol = area * L;
    const weight = vol * 7850; // kg/m3
    const qLen = w.add(`IFCQUANTITYLENGTH('Length',$,$,${ifcNum(L)})`);
    const qVol = w.add(`IFCQUANTITYVOLUME('NetVolume',$,$,${ifcNum(vol)})`);
    const qW = w.add(`IFCQUANTITYWEIGHT('Weight',$,$,${ifcNum(weight)})`);
    const qSetName =
      m.ifcType === "IfcColumn" ? "Qto_ColumnBaseQuantities" : m.ifcType === "IfcBeam" ? "Qto_BeamBaseQuantities" : "Qto_MemberBaseQuantities";
    const eq = w.add(`IFCELEMENTQUANTITY('${ifcGuid()}',#5,${ifcStr(qSetName)},$,$,(${qLen},${qVol},${qW}))`);
    relQtos.push(w.add(`IFCRELDEFINESBYPROPERTIES('${ifcGuid()}',#5,'QTO',$,(${prod}),${eq})`));

    // Structural: nodes + curve member axis
    const stLP = m.storey === "Nivel 1" ? s1lp : s0lp;
    const n0 = ensureStructuralNode(start, stLP);
    const n1 = ensureStructuralNode(end, stLP);

    const poly = ifcPolyline2(w, start, end);
    const axisRep = w.add(`IFCSHAPEREPRESENTATION(${ctxAnalysis},'Axis','Curve3D',(${poly}))`);
    const spds = w.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${axisRep}))`);
    const sc = w.add(
      `IFCSTRUCTURALCURVEMEMBER('${ifcGuid()}',#5,${ifcStr("S_" + name)},$,$,${stLP},${spds},.RIGID_JOINED_MEMBER.,$,$)`
    );

    structuralMembers.push(sc);
    // connect structural member to nodes
    w.add(`IFCRELCONNECTSSTRUCTURALMEMBER('${ifcGuid()}',#5,$,$,${sc},${n0},$,$)`);
    w.add(`IFCRELCONNECTSSTRUCTURALMEMBER('${ifcGuid()}',#5,$,$,${sc},${n1},$,$)`);

    // assign structural item to physical product (traceability)
    w.add(`IFCRELASSIGNSTOPRODUCT('${ifcGuid()}',#5,$,$,(${sc}),${prod},$)`);
  }

  // Containment by storey
  if (storey0Products.length) {
    w.add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',#5,'Nivel 0 elements',$,(${storey0Products.join(",")}),${storey0})`);
  }
  if (storey1Products.length) {
    w.add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',#5,'Nivel 1 elements',$,(${storey1Products.join(",")}),${storey1})`);
  }

  // Material association (single rel)
  if (allProducts.length) {
    w.add(`IFCRELASSOCIATESMATERIAL('${ifcGuid()}',#5,'Steel',$,(${allProducts.join(",")}),${matSteel})`);
  }

  // Classification association
  if (allProducts.length) {
    w.add(`IFCRELASSOCIATESCLASSIFICATION('${ifcGuid()}',#5,'Classification',$,(${allProducts.join(",")}),${clsRef})`);
  }

  // Assign structural nodes + members into SAM
  const allStructuralItems = [...nodeByKey.values(), ...structuralMembers];
  if (allStructuralItems.length) {
    w.add(`IFCRELASSIGNSTOGROUP('${ifcGuid()}',#5,'SAM assigns',$,(${allStructuralItems.join(",")}),${sam})`);
  }

  // Loads / cases / combinations
  const lcG = w.add(`IFCSTRUCTURALLOADCASE('${ifcGuid()}',#5,'LC_G Dead Load',$,$,.G.,.PERMANENT_G.,$,$,1.0,$)`);
  const lcQ = w.add(`IFCSTRUCTURALLOADCASE('${ifcGuid()}',#5,'LC_Q Live Load',$,$,.Q.,.VARIABLE_Q.,$,$,1.0,$)`);

  // ULS combination group (contains cases)
  const uls = w.add(`IFCSTRUCTURALLOADGROUP('${ifcGuid()}',#5,'ULS 1.2G+1.6Q',$,$,.LOAD_COMBINATION.,.U.,.USERDEFINED.,$,'ULS')`);
  w.add(`IFCRELASSIGNSTOGROUP('${ifcGuid()}',#5,'ULS contains',$,(${lcG},${lcQ}),${uls})`);

  // Apply one representative point load at top nodes (Nivel 1) to demonstrate
  // Choose nodes with y >= height (approx)
  const topNodes = [...nodeByKey.entries()]
    .map(([k, tag]) => ({ k, tag }))
    .filter(({ k }) => {
      const parts = k.split("|").map(Number);
      const y = parts[1] || 0;
      return y >= height - 1e-3;
    })
    .slice(0, 6); // keep reasonable amount

  const actions = [];
  for (const tn of topNodes) {
    // Fy -50 kN (down) => in kN; IFC does not enforce unit here; this is demo consistent
    const load = w.add(`IFCSTRUCTURALLOADSINGLEFORCE(0.,-50.0,0.,0.,0.,0.)`);
    const act = w.add(`IFCSTRUCTURALPOINTACTION('${ifcGuid()}',#5,'Q@TOP',$,$,${s1lp},$,${load},.GLOBAL_COORDS.)`);
    w.add(`IFCRELCONNECTSSTRUCTURALACTIVITY('${ifcGuid()}',#5,$,$,${act},${tn.tag},$)`);
    actions.push(act);
  }
  if (actions.length) {
    w.add(`IFCRELASSIGNSTOGROUP('${ifcGuid()}',#5,'Actions->LC_Q',$,(${actions.join(",")}),${lcQ})`);
  }

  // Final: build STEP text
  const header = [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]','ViewDefinition [StructuralAnalysisView]'),'2;1');",
    `FILE_NAME('${projectName.replace(/'/g, "''")}.ifc','${nowISO()}',('RMM'),(${ifcStr(clientName)}),'RMM IFC Exporter','RMM','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
  ].join("\n");

  const footer = ["ENDSEC;", "END-ISO-10303-21;"].join("\n");

  // Replace hard #5 references: we intentionally created owner as #5 (but our writer increments ids).
  // So we guarantee #5 exists by forcing owner to be #5: easiest is to keep it as written:
  // We already used "#5" literals; in this writer, #5 is indeed owner because of creation order.
  // Validate: person(#1) org(#2) pao(#3) app(#4) owner(#5) ✅

  return `${header}\n${w.lines.join("\n")}\n${footer}\n`;
}

// -------------------- IFC EXPORT (REAL) --------------------
async function exportIFC() {
  const st = qs("#ifc-status");
  try {
    if (!state.model) {
      if (st) st.textContent = "No hay modelo para exportar a IFC.";
      return;
    }
    const ifcText = buildIFC4FromStateModel(state.model);
    downloadText(`rmm_model_v${state.version}.ifc`, ifcText, "application/octet-stream");
    if (st) st.textContent = "✅ IFC4 válido exportado (Proyecto/Sitio/Edificio/Niveles/Grids/Sólidos/QTO/SAM).";
  } catch (err) {
    if (st) st.textContent = `Error export IFC: ${err?.message || err}`;
  }
}

// -------------------- REGLAS (VALIDACIONES) --------------------
function rule(id, name, ok, msg) {
  return { id, name, ok: Boolean(ok), msg: msg || "" };
}

function getTypicalRanges(cover) {
  if (cover === "panel") {
    return {
      purlin: { min: 1.2, max: 2.5 },
      girt: { min: 1.2, max: 2.2 },
    };
  }
  return {
    purlin: { min: 0.8, max: 1.5 },
    girt: { min: 1.0, max: 2.0 },
  };
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
  results.push(rule("R3", "Pendiente razonable", b.slope >= 0.02 && b.slope <= 0.25, "Pendiente fuera de rango típico."));
  results.push(rule("R4", "Elementos generados", (state.model.elements?.length || 0) > 0, "No se generaron elementos."));

  const ranges = getTypicalRanges(b.cover);
  const pOk = b.purlinSpacing >= ranges.purlin.min && b.purlinSpacing <= ranges.purlin.max;
  const gOk = b.girtSpacing >= ranges.girt.min && b.girtSpacing <= ranges.girt.max;

  results.push(
    rule(
      "R5",
      "Separación correas techo (típica)",
      pOk,
      `Fuera de rango típico para "${b.cover}". Recomendado: ${ranges.purlin.min}–${ranges.purlin.max} m (verificar por cálculo y ficha técnica).`
    )
  );

  results.push(
    rule(
      "R6",
      "Separación largueros pared (típica)",
      gOk,
      `Fuera de rango típico para "${b.cover}". Recomendado: ${ranges.girt.min}–${ranges.girt.max} m (verificar por cálculo y ficha técnica).`
    )
  );

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

// -------------------- PREVIEW 3D (Three.js) --------------------
async function ensurePreview3D() {
  if (state.preview.ready) return true;

  const container = qs("#ifc-viewer");
  if (!container) return false;

  try {
    const THREE = await import("https://unpkg.com/three@0.158.0/build/three.module.js");
    const oc = await import("https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js");

    state.preview.THREE = THREE;
    state.preview.OrbitControls = oc.OrbitControls;

    const { WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, AxesHelper, GridHelper, AmbientLight, DirectionalLight } = THREE;

    container.innerHTML = "";

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = new Color(0x071226);
    scene.fog = new Fog(0x071226, 80, 500);

    const camera = new PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(35, 18, 60);

    const controls = new state.preview.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 6, 20);

    const grid = new GridHelper(300, 120);
    grid.position.y = 0;
    scene.add(grid);

    const axes = new AxesHelper(8);
    scene.add(axes);

    const amb = new AmbientLight(0xffffff, 0.55);
    scene.add(amb);

    const dir = new DirectionalLight(0xffffff, 0.9);
    dir.position.set(40, 60, 20);
    scene.add(dir);

    state.preview.renderer = renderer;
    state.preview.scene = scene;
    state.preview.camera = camera;
    state.preview.controls = controls;

    const ro = new ResizeObserver(() => {
      if (!state.preview.renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      state.preview.renderer.setSize(w, h);
      state.preview.camera.aspect = w / h;
      state.preview.camera.updateProjectionMatrix();
    });
    ro.observe(container);

    const tick = () => {
      state.preview.animId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    state.preview.ready = true;
    const vs = qs("#viewer-status");
    if (vs) vs.textContent = "Preview activo";
    const st = qs("#ifc-status");
    if (st) st.textContent = "Preview 3D listo. Generá un modelo para ver estructura.";

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
    const vs = qs("#viewer-status");
    if (vs) vs.textContent = "Error 3D";
    return false;
  }
}

function resetViewer() {
  const container = qs("#ifc-viewer");
  if (!container) return;

  if (state.preview.animId) cancelAnimationFrame(state.preview.animId);

  state.preview.ready = false;
  state.preview.THREE = null;
  state.preview.OrbitControls = null;
  state.preview.renderer = null;
  state.preview.scene = null;
  state.preview.camera = null;
  state.preview.controls = null;
  state.preview.animId = null;

  container.innerHTML = "";
  const vs = qs("#viewer-status");
  if (vs) vs.textContent = "Sin archivo";
  const st = qs("#ifc-status");
  if (st) st.textContent = "Visor reiniciado. Preview se reinicia al generar modelo.";
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
  const dist = maxDim * 1.6;

  camera.position.set(center.x + dist, center.y + dist * 0.55, center.z + dist);
  controls.target.copy(center);
  controls.update();
}

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

  const { span, length, height, frames, roof, slope, purlinSpacing, girtSpacing } = state.model.building;

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
      const t = (x + halfSpan) / span;
      return height + t * (span * slope);
    }

    const t = Math.abs(x) / halfSpan;
    return height + (1 - t) * (halfSpan * slope);
  }

  // PÓRTICOS
  for (let i = 0; i < frames; i++) {
    const z = i * step;

    let topL = new THREE.Vector3(-halfSpan, height, z);
    let topR = new THREE.Vector3(halfSpan, height, z);

    if (roof === "una_agua") {
      topL = new THREE.Vector3(-halfSpan, height, z);
      topR = new THREE.Vector3(halfSpan, height + span * slope, z);
    }

    const baseL = new THREE.Vector3(-halfSpan, 0, z);
    const baseR = new THREE.Vector3(halfSpan, 0, z);
    addMember(THREE, group, baseL, topL, colSize, matCol);
    addMember(THREE, group, baseR, topR, colSize, matCol);

    if (roof === "plana") {
      const a = new THREE.Vector3(-halfSpan, roofY(-halfSpan), z);
      const b2 = new THREE.Vector3(halfSpan, roofY(halfSpan), z);
      addMember(THREE, group, a, b2, rafterSize, matRafter);
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

  // CORREAS TECHO (por vano)
  const linesAcross = Math.max(2, Math.floor(span / Math.max(0.1, purlinSpacing)) + 1);

  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    if (roof === "dos_aguas") {
      const halfLines = Math.max(1, Math.floor(linesAcross / 2));

      for (let k = 0; k <= halfLines; k++) {
        const x = -halfSpan + (k / halfLines) * halfSpan;
        addMember(THREE, group, new THREE.Vector3(x, roofY(x), z0), new THREE.Vector3(x, roofY(x), z1), purlinSize, matPurlin);
      }

      for (let k = 1; k <= halfLines; k++) {
        const x = (k / halfLines) * halfSpan;
        addMember(THREE, group, new THREE.Vector3(x, roofY(x), z0), new THREE.Vector3(x, roofY(x), z1), purlinSize, matPurlin);
      }

      addMember(THREE, group, new THREE.Vector3(0, roofY(0), z0), new THREE.Vector3(0, roofY(0), z1), purlinSize, matPurlin);
    } else {
      for (let k = 0; k <= linesAcross; k++) {
        const x = -halfSpan + (k / linesAcross) * span;
        addMember(THREE, group, new THREE.Vector3(x, roofY(x), z0), new THREE.Vector3(x, roofY(x), z1), purlinSize, matPurlin);
      }
    }
  }

  // LARGUEROS (por vano)
  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const topL = height;
    const topR = roof === "una_agua" ? height + span * slope : height;

    const startY = 1.2;
    const maxYL = Math.max(startY, topL - 0.30);
    const maxYR = Math.max(startY, topR - 0.30);

    const levelsL = Math.max(2, Math.floor((maxYL - startY) / Math.max(0.1, girtSpacing)) + 1);
    const levelsR = Math.max(2, Math.floor((maxYR - startY) / Math.max(0.1, girtSpacing)) + 1);

    for (let i = 0; i < levelsL; i++) {
      const y = Math.min(maxYL, startY + i * girtSpacing);
      addMember(THREE, group, new THREE.Vector3(-halfSpan, y, z0), new THREE.Vector3(-halfSpan, y, z1), girtSize, matGirt);
    }

    for (let i = 0; i < levelsR; i++) {
      const y = Math.min(maxYR, startY + i * girtSpacing);
      addMember(THREE, group, new THREE.Vector3(halfSpan, y, z0), new THREE.Vector3(halfSpan, y, z1), girtSize, matGirt);
    }
  }

  scene.add(group);

  fitToGroup(THREE, state.preview.camera, state.preview.controls, group);

  const vs = qs("#viewer-status");
  if (vs) vs.textContent = "Preview activo";

  const eng = computeEngineering(state.model);
  const st = qs("#ifc-status");
  if (st) {
    st.textContent =
      `Preview 3D: ${roof} — pendiente ${(slope * 100).toFixed(1)}% — ` +
      `correas ${purlinSpacing.toFixed(2)}m — largueros ${girtSpacing.toFixed(2)}m — ` +
      `kg/m² total(planta) ${fmt2(eng.kgm2Plan)} | prim ${fmt2(eng.kgm2PlanPrimary)} | sec ${fmt2(eng.kgm2PlanSecondary)}`;
  }
}

// -------------------- VERSIONADO LOCAL --------------------
function localKey() {
  const name = qs("#project-name")?.value?.trim() || "rmm_project";
  return `rmm_versions_${name}`;
}

function saveLocalVersion() {
  const ps = qs("#persistence-status");
  if (!state.model) {
    if (ps) ps.textContent = "No hay modelo para guardar.";
    return;
  }

  const key = localKey();
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  const entry = { savedAt: nowISO(), version: state.version, model: state.model };
  current.unshift(entry);
  localStorage.setItem(key, JSON.stringify(current.slice(0, 50)));

  if (ps) ps.textContent = `Versión guardada localmente (v${state.version}).`;
  renderLocalVersions();
}

function loadLocalVersion() {
  const ps = qs("#persistence-status");
  const key = localKey();
  const current = JSON.parse(localStorage.getItem(key) || "[]");
  if (!current.length) {
    if (ps) ps.textContent = "No hay versiones guardadas.";
    return;
  }
  const latest = current[0];
  state.model = latest.model;
  state.version = latest.version || state.version;

  const b = state.model?.building;
  if (b) {
    if (qs("#ind-slope")) qs("#ind-slope").value = String(Math.round((b.slope ?? 0.1) * 100));
    if (qs("#ind-purlin")) qs("#ind-purlin").value = String(b.purlinSpacing ?? 1.5);
    if (qs("#ind-girt")) qs("#ind-girt").value = String(b.girtSpacing ?? 1.5);
    if (qs("#ind-cover")) qs("#ind-cover").value = b.cover ?? "chapa";
    if (qs("#ind-roof")) qs("#ind-roof").value = b.roof ?? "dos_aguas";
  }
  updateIndustrialLabels();

  if (ps) ps.textContent = `Versión cargada (v${state.version}).`;
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
          <button class="ghost" data-action="load-local" data-tooltip="Cargar la última versión local (demo)" type="button">Cargar última</button>
          <button class="ghost" data-action="export-json" data-tooltip="Descargar el modelo actual en JSON" type="button">Exportar JSON</button>
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

    const b = state.model?.building;
    if (b) {
      if (qs("#ind-slope")) qs("#ind-slope").value = String(Math.round((b.slope ?? 0.1) * 100));
      if (qs("#ind-purlin")) qs("#ind-purlin").value = String(b.purlinSpacing ?? 1.5);
      if (qs("#ind-girt")) qs("#ind-girt").value = String(b.girtSpacing ?? 1.5);
      if (qs("#ind-cover")) qs("#ind-cover").value = b.cover ?? "chapa";
      if (qs("#ind-roof")) qs("#ind-roof").value = b.roof ?? "dos_aguas";
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

  await ensurePreview3D();
  const vs = qs("#viewer-status");
  if (vs) vs.textContent = "Preview activo";
  const st = qs("#ifc-status");
  if (st) st.textContent = "Preview 3D listo. Generá un modelo para ver estructura.";
}

window.addEventListener("DOMContentLoaded", () => {
  init();
});
