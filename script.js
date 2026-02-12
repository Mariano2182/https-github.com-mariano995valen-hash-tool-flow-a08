// script.js (ES Module) — GitHub Pages friendly (imports por URL completa)
// ✅ Actualizado para: BOM con clases (bom-tech/bom-section/bom-divider/bom-ok/bom-warn)
// ✅ más robusto (no rompe si faltan nodos)
// ✅ IFC Export REAL (IFC4) — geometría paramétrica (extrusiones) + jerarquía Proyecto/Sitio/Edificio/Nivel
//    - Columnas -> IfcColumn
//    - Vigas/Cabios -> IfcBeam
//    - Correas/Largueros -> IfcMember
// ✅ AHORA: Secciones reales (I / C / Z) en IFC y Preview 3D
//    - IFC: IfcArbitraryClosedProfileDef + IfcExtrudedAreaSolid
//    - Preview 3D: THREE.Shape + ExtrudeGeometry

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
    resizeObs: null,
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

// -------------------- FASTENERS (BULONES) --------------------
const FASTENER_CATALOG = {
  bulon_m16: { label: "Bulón hex M16", kg_each: 0.14 },
};

// -------------------- PERFILES (SECCIÓN REAL) --------------------
// Dimensiones en METROS (m). Sin radios (simplificado, pero con forma real).
// kind: "I" (IPE/HEB), "C" (Canal), "Z" (Zeta)
const PROFILE_CATALOG = {
  // Primaria (ejemplo)
  IPE300: { kind: "I", h: 0.300, b: 0.150, tw: 0.007, tf: 0.011 },
  HEB300: { kind: "I", h: 0.300, b: 0.300, tw: 0.011, tf: 0.019 },

  // Secundaria (ejemplo)
  C200: { kind: "C", h: 0.200, b: 0.070, t: 0.003 },
  Z200: { kind: "Z", h: 0.200, b: 0.070, t: 0.003 },
};

// Perfil default por tipo de elemento del modelo
function defaultProfileForElementType(type) {
  if (type === "columna") return "HEB300";
  if (type === "viga" || type === "cabio") return "IPE300";
  if (type === "correas") return "Z200";
  if (type === "correas_columna") return "C200";
  return "IPE300";
}

function getProfileSpec(codeOrType) {
  const code = PROFILE_CATALOG[codeOrType] ? codeOrType : defaultProfileForElementType(codeOrType);
  const spec = PROFILE_CATALOG[code] || PROFILE_CATALOG.IPE300;
  return { code, ...spec };
}

// Contorno 2D cerrado, centrado en (0,0). Devuelve [{x,y}, ...] con cierre.
function profilePolygon(spec) {
  const k = spec.kind;

  if (k === "I") {
    const h = spec.h,
      b = spec.b,
      tw = spec.tw,
      tf = spec.tf;

    const x0 = -b / 2,
      x1 = -tw / 2,
      x2 = tw / 2,
      x3 = b / 2;
    const y0 = -h / 2,
      y1 = y0 + tf,
      y2 = h / 2 - tf,
      y3 = h / 2;

    return [
      { x: x0, y: y0 },
      { x: x3, y: y0 },
      { x: x3, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y2 },
      { x: x3, y: y3 },
      { x: x0, y: y3 },
      { x: x0, y: y2 },
      { x: x1, y: y2 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 },
    ];
  }

  if (k === "C") {
    const h = spec.h,
      b = spec.b,
      t = spec.t;

    const x0 = -b / 2,
      x3 = b / 2;
    const x1 = x0 + t,
      x2 = x3 - t;

    const y0 = -h / 2,
      y3 = h / 2;
    const y1 = y0 + t,
      y2 = y3 - t;

    // "C" sólida simplificada (tipo U)
    return [
      { x: x0, y: y0 },
      { x: x3, y: y0 },
      { x: x3, y: y1 },
      { x: x1, y: y1 },
      { x: x1, y: y2 },
      { x: x3, y: y2 },
      { x: x3, y: y3 },
      { x: x0, y: y3 },
      { x: x0, y: y0 },
    ];
  }

  if (k === "Z") {
    const h = spec.h,
      b = spec.b,
      t = spec.t;

    const y0 = -h / 2,
      y3 = h / 2;
    const y1 = y0 + t,
      y2 = y3 - t;

    // Z simplificada (sin labios), sólida
    // ala superior hacia +X; ala inferior hacia -X
    const xTop0 = -t / 2;
    const xTop1 = xTop0 + b;

    const xBot1 = t / 2;
    const xBot0 = xBot1 - b;

    return [
      // ala inferior
      { x: xBot0, y: y0 },
      { x: xBot1, y: y0 },
      { x: xBot1, y: y1 },

      // alma (sube)
      { x: t / 2, y: y1 },
      { x: t / 2, y: y2 },
      { x: -t / 2, y: y2 },
      { x: -t / 2, y: y1 },

      // ala superior
      { x: xTop0, y: y2 },
      { x: xTop1, y: y2 },
      { x: xTop1, y: y3 },
      { x: xTop0, y: y3 },
      { x: xTop0, y: y2 },

      // cierre “por atrás” (simplificación)
      { x: -t / 2, y: y2 },
      { x: xBot0, y: y2 },
      { x: xBot0, y: y0 },
    ];
  }

  // fallback: rectángulo
  const w = Math.max(0.08, spec.b || 0.12);
  const hh = Math.max(0.08, spec.h || 0.12);
  return [
    { x: -w / 2, y: -hh / 2 },
    { x: w / 2, y: -hh / 2 },
    { x: w / 2, y: hh / 2 },
    { x: -w / 2, y: hh / 2 },
    { x: -w / 2, y: -hh / 2 },
  ];
}

// Calcula bulones M16 para el modelo paramétrico (estimación)
function estimateBoltsM16(model) {
  const b = model?.building;
  if (!b) return { qty: 0, breakdown: {} };

  const frames = Number(b.frames || 0);
  const bays = Math.max(1, frames - 1);

  const eng = computeEngineering(model);

  const boltsBasePlatePerColumn = 4; // anclajes base
  const boltsKneePerSide = 6; // rodilla por lado
  const boltsRidgePerFrame = b.roof === "dos_aguas" ? 6 : 0;

  const boltsPerPurlinSupport = 2;
  const boltsPerGirtSupport = 2;

  const columns = frames * 2;
  const basePlateBolts = columns * boltsBasePlatePerColumn;

  const kneeJoints = frames * 2;
  const kneeBolts = kneeJoints * boltsKneePerSide;

  const ridgeBolts = frames * boltsRidgePerFrame;

  const purlinSegments = Number(eng.purlinSegments || 0);
  const purlinBolts = purlinSegments * 2 * boltsPerPurlinSupport;

  const girtSegments = Number(eng.girtSegments || 0);
  const girtBolts = girtSegments * 2 * boltsPerGirtSupport;

  const total = basePlateBolts + kneeBolts + ridgeBolts + purlinBolts + girtBolts;

  const breakdown = {
    frames,
    bays,
    basePlateBolts,
    kneeBolts,
    ridgeBolts,
    purlinBolts,
    girtBolts,
  };

  return { qty: total, breakdown };
}

function upsertBoltsIntoModel(model) {
  if (!model?.elements) return;

  const { qty, breakdown } = estimateBoltsM16(model);
  const spec = FASTENER_CATALOG.bulon_m16;
  const weightKg = qty * (spec?.kg_each || 0);

  model.elements = model.elements.filter((e) => e.type !== "bulon_m16");

  model.elements.push({
    id: "BOLTS-M16",
    type: "bulon_m16",
    qty,
    length: 0,
    weightKg,
    meta: { ...breakdown, kg_each: spec?.kg_each || 0 },
  });
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
    if (action === "export-ifc") exportIFC(); // ✅ IFC Export REAL
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

  const maxYL = Math.max(startY, topL - 0.3);
  const maxYR = Math.max(startY, topR - 0.3);

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

  for (let i = 0; i < frames; i++) {
    model.elements.push({ id: `COL-L-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });
    model.elements.push({ id: `COL-R-${i + 1}`, type: "columna", qty: 1, length: height, weightKg: height * 90 });

    if (roof === "dos_aguas") {
      const rafterLen = Math.hypot(span / 2, (span / 2) * slope);
      model.elements.push({ id: `RAF-L-${i + 1}`, type: "cabio", qty: 1, length: rafterLen, weightKg: rafterLen * 40 });
      model.elements.push({ id: `RAF-R-${i + 1}`, type: "cabio", qty: 1, length: rafterLen, weightKg: rafterLen * 40 });
    } else {
      const beamLen = Math.hypot(span, roof === "una_agua" ? span * slope : 0);
      model.elements.push({
        id: `BEAM-${i + 1}`,
        type: roof === "plana" ? "viga" : "cabio",
        qty: 1,
        length: beamLen,
        weightKg: beamLen * 55,
      });
    }
  }

  const purlinLines = Math.max(2, Math.floor(span / Math.max(0.1, purlinSpacing)) + 1);
  const purlinMembers = purlinLines * bays;

  model.elements.push({
    id: `PURLINS`,
    type: "correas",
    qty: purlinMembers,
    length: step,
    weightKg: purlinMembers * step * 8,
  });

  const startY = 1.2;
  const topL = height;
  const topR = roof === "una_agua" ? height + span * slope : height;

  const maxYL = Math.max(startY, topL - 0.3);
  const maxYR = Math.max(startY, topR - 0.3);

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

  upsertBoltsIntoModel(model);

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
  const rows = [...map.values()].sort((a, bb) => a.type.localeCompare(bb.type));

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
      const displayName = FASTENER_CATALOG[r.type]?.label || r.type;
      return `
      <tr>
        <td>${displayName}</td>
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

// -------------------- EXPORTS --------------------
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
  const lines = rows
    .map((r) => {
      const name = FASTENER_CATALOG[r.type]?.label || r.type;
      return `${name},${r.qty},${Math.round(r.weightKg)},${r.ml.toFixed(2)},${state.version}`;
    })
    .join("\n");

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
    `girt_levels_left,${eng.girtLevelsL},,,\n` +
    `girt_levels_right,${eng.girtLevelsR},,,\n` +
    `girt_segments,${eng.girtSegments},,,\n` +
    "\n#METROS_LINEALES_POR_TIPO\n" +
    mlByType.map((r) => `ml_${r.type},,,${r.ml.toFixed(2)},\n`).join("");

  downloadText(`rmm_bom_ultra_v${state.version}.csv`, header + lines + extra, "text/csv");
}

// ============================================================================
// ============================== IFC EXPORT REAL ==============================
// ============================================================================

// ---- Math helpers (sin libs) ----
function v3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}
function vSub(a, b) {
  return v3(a.x - b.x, a.y - b.y, a.z - b.z);
}
function vLen(a) {
  return Math.hypot(a.x, a.y, a.z);
}
function vNorm(a) {
  const l = vLen(a);
  return l > 1e-12 ? v3(a.x / l, a.y / l, a.z / l) : v3(0, 0, 1);
}
function vDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function vCross(a, b) {
  return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

// ---- IFC GUID (22 chars) ----
const IFC64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
function ifcGuidFromBytes(bytes16) {
  const b = bytes16;
  const toInt = (i) => (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];

  const parts = [toInt(0) >>> 0, toInt(4) >>> 0, toInt(8) >>> 0, toInt(12) >>> 0];

  let num = BigInt(parts[0]);
  num = (num << 32n) + BigInt(parts[1]);
  num = (num << 32n) + BigInt(parts[2]);
  num = (num << 32n) + BigInt(parts[3]);

  const mask = 63n;
  const chars = [];
  for (let i = 0; i < 22; i++) {
    const shift = BigInt((21 - i) * 6);
    const idx = Number((num >> shift) & mask);
    chars.push(IFC64[idx]);
  }
  return chars.join("");
}
function ifcGuid() {
  const bytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  return ifcGuidFromBytes(bytes);
}

// ---- STEP helpers ----
function ifcStr(s) {
  if (s == null) return "$";
  const t = String(s).replace(/'/g, "''");
  return `'${t}'`;
}
function ifcNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.";
  return `${x.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".")}`;
}
function ifcRef(id) {
  return `#${id}`;
}
function ifcList(arr) {
  return `(${arr.join(",")})`;
}
function ifcDir(v) {
  return `(${ifcNum(v.x)},${ifcNum(v.y)},${ifcNum(v.z)})`;
}
function ifcPt(v) {
  return `(${ifcNum(v.x)},${ifcNum(v.y)},${ifcNum(v.z)})`;
}

// ---- Segmentación geométrica desde el modelo paramétrico ----
function buildSegmentsFromModel(model) {
  const b = model?.building;
  if (!b) return [];

  const { span, length, height, frames, roof, slope, purlinSpacing, girtSpacing } = b;
  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  function roofY(x) {
    if (roof === "plana") return height;
    if (roof === "una_agua") {
      const t = (x + halfSpan) / span;
      return height + t * (span * slope);
    }
    const t = Math.abs(x) / halfSpan;
    return height + (1 - t) * (halfSpan * slope);
  }

  const segs = [];

  function elementTypeFrom(kind, name) {
    if (kind === "COLUMN") return "columna";
    if (kind === "BEAM") return name?.startsWith("BEAM-") ? "viga" : "cabio";
    // MEMBER: correas vs largueros
    if (String(name || "").startsWith("GIRT-")) return "correas_columna";
    return "correas";
  }

  function pushSeg(kind, name, a, c) {
    const dir = vSub(c, a);
    const len = vLen(dir);
    if (len <= 1e-6) return;

    const type = elementTypeFrom(kind, name);
    const profile = getProfileSpec(type);

    segs.push({ kind, name, a, b: c, profileSpec: profile, length: len, type });
  }

  // pórticos
  for (let i = 0; i < frames; i++) {
    const z = i * step;

    let topL = v3(-halfSpan, height, z);
    let topR = v3(halfSpan, height, z);

    if (roof === "una_agua") {
      topR = v3(halfSpan, height + span * slope, z);
    }

    const baseL = v3(-halfSpan, 0, z);
    const baseR = v3(halfSpan, 0, z);

    pushSeg("COLUMN", `COL-L-${i + 1}`, baseL, topL);
    pushSeg("COLUMN", `COL-R-${i + 1}`, baseR, topR);

    if (roof === "plana") {
      const a = v3(-halfSpan, roofY(-halfSpan), z);
      const c = v3(halfSpan, roofY(halfSpan), z);
      pushSeg("BEAM", `BEAM-${i + 1}`, a, c);
    } else if (roof === "una_agua") {
      pushSeg("BEAM", `RAF-${i + 1}`, topL, topR);
    } else {
      const eaveL = v3(-halfSpan, height, z);
      const eaveR = v3(halfSpan, height, z);
      const ridge = v3(0, height + halfSpan * slope, z);

      pushSeg("BEAM", `RAF-L-${i + 1}`, eaveL, ridge);
      pushSeg("BEAM", `RAF-R-${i + 1}`, ridge, eaveR);
    }
  }

  // correas
  const linesAcross = Math.max(2, Math.floor(span / Math.max(0.1, purlinSpacing)) + 1);
  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    if (roof === "dos_aguas") {
      const halfLines = Math.max(1, Math.floor(linesAcross / 2));

      for (let k = 0; k <= halfLines; k++) {
        const x = -halfSpan + (k / halfLines) * halfSpan;
        pushSeg("MEMBER", `PURLIN-L-${bay + 1}-${k + 1}`, v3(x, roofY(x), z0), v3(x, roofY(x), z1));
      }
      for (let k = 1; k <= halfLines; k++) {
        const x = (k / halfLines) * halfSpan;
        pushSeg("MEMBER", `PURLIN-R-${bay + 1}-${k + 1}`, v3(x, roofY(x), z0), v3(x, roofY(x), z1));
      }
      pushSeg("MEMBER", `PURLIN-RIDGE-${bay + 1}`, v3(0, roofY(0), z0), v3(0, roofY(0), z1));
    } else {
      for (let k = 0; k <= linesAcross; k++) {
        const x = -halfSpan + (k / linesAcross) * span;
        pushSeg("MEMBER", `PURLIN-${bay + 1}-${k + 1}`, v3(x, roofY(x), z0), v3(x, roofY(x), z1));
      }
    }
  }

  // largueros
  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const topL = height;
    const topR = roof === "una_agua" ? height + span * slope : height;

    const startY = 1.2;
    const maxYL = Math.max(startY, topL - 0.3);
    const maxYR = Math.max(startY, topR - 0.3);

    const levelsL = Math.max(2, Math.floor((maxYL - startY) / Math.max(0.1, girtSpacing)) + 1);
    const levelsR = Math.max(2, Math.floor((maxYR - startY) / Math.max(0.1, girtSpacing)) + 1);

    for (let i = 0; i < levelsL; i++) {
      const y = Math.min(maxYL, startY + i * girtSpacing);
      pushSeg("MEMBER", `GIRT-L-${bay + 1}-${i + 1}`, v3(-halfSpan, y, z0), v3(-halfSpan, y, z1));
    }
    for (let i = 0; i < levelsR; i++) {
      const y = Math.min(maxYR, startY + i * girtSpacing);
      pushSeg("MEMBER", `GIRT-R-${bay + 1}-${i + 1}`, v3(halfSpan, y, z0), v3(halfSpan, y, z1));
    }
  }

  return segs;
}

// ---- IFC Writer minimal (IFC4) ----
class IFCWriter {
  constructor({ projectName = "RMM Project", schema = "IFC4" } = {}) {
    this.schema = schema;
    this.projectName = projectName;
    this.lines = [];
    this.id = 0;
  }
  nextId() {
    this.id += 1;
    return this.id;
  }
  add(entity, args) {
    const id = this.nextId();
    this.lines.push(`#${id}=${entity}(${args});`);
    return id;
  }

  header({ fileName = "model.ifc", author = "RMM", org = "RMM", app = "RMM Web", time = nowISO() } = {}) {
    const ts = time;
    return [
      "ISO-10303-21;",
      "HEADER;",
      `FILE_DESCRIPTION((${ifcStr("ViewDefinition [CoordinationView]")}),${ifcStr("2;1")});`,
      `FILE_NAME(${ifcStr(fileName)},${ifcStr(ts)},(${ifcStr(author)}),(${ifcStr(org)}),${ifcStr(app)},${ifcStr("RMM")},${ifcStr("")});`,
      `FILE_SCHEMA((${ifcStr(this.schema)}));`,
      "ENDSEC;",
      "DATA;",
    ].join("\n");
  }

  footer() {
    return ["ENDSEC;", "END-ISO-10303-21;"].join("\n");
  }

  buildBase({ buildingName = "Nave Industrial", storeyName = "Nivel 0" } = {}) {
    const person = this.add("IFCPERSON", `${ifcStr("")},${ifcStr("")},${ifcStr("RMM")},$,$,$,$,$`);
    const org = this.add("IFCORGANIZATION", `${ifcStr("")},${ifcStr("RMM")},${ifcStr("")},$,$`);
    const pAndO = this.add("IFCPERSONANDORGANIZATION", `${ifcRef(person)},${ifcRef(org)},$`);
    const app = this.add("IFCAPPLICATION", `${ifcRef(org)},${ifcStr("1.0")},${ifcStr("RMM Web")},${ifcStr("RMM_WEB")}`);
    const ownerHistory = this.add(
      "IFCOWNERHISTORY",
      `${ifcRef(pAndO)},${ifcRef(app)},$,.ADDED.,$,$,$,${ifcNum(Date.now() / 1000)}`
    );

    const uLen = this.add("IFCSIUNIT", `$,.LENGTHUNIT.,.METRE.,$`);
    const uArea = this.add("IFCSIUNIT", `$,.AREAUNIT.,.SQUARE_METRE.,$`);
    const uVol = this.add("IFCSIUNIT", `$,.VOLUMEUNIT.,.CUBIC_METRE.,$`);
    // ✅ FIX: unidad masa correcta y sin romper sintaxis
    const uMass = this.add("IFCSIUNIT", `$,.MASSUNIT.,.KILOGRAM.,$`);
    const unitAssignment = this.add("IFCUNITASSIGNMENT", ifcList([ifcRef(uLen), ifcRef(uArea), ifcRef(uVol), ifcRef(uMass)]));

    const originPt = this.add("IFCCARTESIANPOINT", ifcPt(v3(0, 0, 0)));
    const wcs = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(originPt)},$,$`);
    const context = this.add(
      "IFCGEOMETRICREPRESENTATIONCONTEXT",
      `${ifcStr("Model")},${ifcStr("3D")},3,${ifcNum(1e-5)},${ifcRef(wcs)},$`
    );

    const project = this.add(
      "IFCPROJECT",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr(this.projectName)},${ifcStr("")},$,$,$,${ifcList([ifcRef(context)])},${ifcRef(unitAssignment)}`
    );

    const siteLoc = this.add("IFCCARTESIANPOINT", ifcPt(v3(0, 0, 0)));
    const siteAxis = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(siteLoc)},$,$`);
    const sitePlacement = this.add("IFCLOCALPLACEMENT", `$,${ifcRef(siteAxis)}`);

    const bldLoc = this.add("IFCCARTESIANPOINT", ifcPt(v3(0, 0, 0)));
    const bldAxis = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(bldLoc)},$,$`);
    const bldPlacement = this.add("IFCLOCALPLACEMENT", `${ifcRef(sitePlacement)},${ifcRef(bldAxis)}`);

    const stLoc = this.add("IFCCARTESIANPOINT", ifcPt(v3(0, 0, 0)));
    const stAxis = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(stLoc)},$,$`);
    const stPlacement = this.add("IFCLOCALPLACEMENT", `${ifcRef(bldPlacement)},${ifcRef(stAxis)}`);

    const site = this.add(
      "IFCSITE",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr("Site")},${ifcStr("")},$,$,${ifcRef(sitePlacement)},$,$,.ELEMENT.,$,$,$,$,$`
    );

    const building = this.add(
      "IFCBUILDING",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr(buildingName)},${ifcStr("")},$,$,${ifcRef(bldPlacement)},$,$,.ELEMENT.,$,$,$`
    );

    const storey = this.add(
      "IFCBUILDINGSTOREY",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr(storeyName)},${ifcStr("")},$,$,${ifcRef(stPlacement)},$,$,.ELEMENT.,${ifcNum(0)}`
    );

    this.add(
      "IFCRELAGGREGATES",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr("Aggregates")},$,${ifcRef(project)},${ifcList([ifcRef(site)])}`
    );
    this.add(
      "IFCRELAGGREGATES",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr("Aggregates")},$,${ifcRef(site)},${ifcList([ifcRef(building)])}`
    );
    this.add(
      "IFCRELAGGREGATES",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr("Aggregates")},$,${ifcRef(building)},${ifcList([ifcRef(storey)])}`
    );

    return { ownerHistory, context, project, site, building, storey, storeyPlacement: stPlacement };
  }

  makeMemberPlacement({ storeyPlacement, start, dirUnit }) {
    const z = vNorm(dirUnit);
    const up = Math.abs(vDot(z, v3(0, 0, 1))) > 0.95 ? v3(0, 1, 0) : v3(0, 0, 1);
    const x = vNorm(vCross(up, z));
    const xFinal = vLen(x) < 1e-8 ? v3(1, 0, 0) : x;

    const pt = this.add("IFCCARTESIANPOINT", ifcPt(start));
    const axisDir = this.add("IFCDIRECTION", ifcDir(z));
    const refDir = this.add("IFCDIRECTION", ifcDir(xFinal));
    const ax = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(pt)},${ifcRef(axisDir)},${ifcRef(refDir)}`);
    const lp = this.add("IFCLOCALPLACEMENT", `${ifcRef(storeyPlacement)},${ifcRef(ax)}`);
    return lp;
  }

  // ✅ Perfil arbitrario cerrado extruido (sección real)
  makeExtrudedProfileShape({ context, profileSpec, depth }) {
    const pts = profilePolygon(profileSpec);

    // IFCPOLYLINE: lista de IFCCARTESIANPOINT 2D
    const ptIds = pts.map((p) => this.add("IFCCARTESIANPOINT", `(${ifcNum(p.x)},${ifcNum(p.y)})`));
    const poly = this.add("IFCPOLYLINE", ifcList(ptIds.map((id) => ifcRef(id))));

    const prof = this.add(
      "IFCARBITRARYCLOSEDPROFILEDEF",
      `.AREA.,${ifcStr(profileSpec.code || "")},$,${ifcRef(poly)}`
    );

    const solidPosPt = this.add("IFCCARTESIANPOINT", ifcPt(v3(0, 0, 0)));
    const solidPos = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(solidPosPt)},$,$`);
    const extrudeDir = this.add("IFCDIRECTION", ifcDir(v3(0, 0, 1)));

    const solid = this.add(
      "IFCEXTRUDEDAREASOLID",
      `${ifcRef(prof)},${ifcRef(solidPos)},${ifcRef(extrudeDir)},${ifcNum(depth)}`
    );

    const bodyRep = this.add(
      "IFCSHAPEREPRESENTATION",
      `${ifcRef(context)},${ifcStr("Body")},${ifcStr("SweptSolid")},${ifcList([ifcRef(solid)])}`
    );

    const pds = this.add("IFCPRODUCTDEFINITIONSHAPE", `$,$,${ifcList([ifcRef(bodyRep)])}`);
    return pds;
  }

  addLinearProduct({ ownerHistory, storeyPlacement, context, kind, name, start, end, profileSpec }) {
    const dir = vSub(end, start);
    const len = vLen(dir);
    const dirUnit = vNorm(dir);

    const placement = this.makeMemberPlacement({ storeyPlacement, start, dirUnit });

    const shape = this.makeExtrudedProfileShape({
      context,
      profileSpec: profileSpec || getProfileSpec("IPE300"),
      depth: len,
    });

    const ent = kind === "COLUMN" ? "IFCCOLUMN" : kind === "BEAM" ? "IFCBEAM" : "IFCMEMBER";
    const prod = this.add(ent, `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr(name)},${ifcStr("")},$,${ifcRef(placement)},${ifcRef(shape)},$,$`);

    return prod;
  }
}

async function exportIFC() {
  const st = qs("#ifc-status");
  if (!state.model) {
    if (st) st.textContent = "No hay modelo para exportar a IFC.";
    return;
  }

  try {
    const projectName = (qs("#project-name")?.value?.trim() || "RMM Project") + ` v${state.version}`;
    const client = qs("#project-client")?.value?.trim() || "";
    const buildingName = client ? `Nave — ${client}` : "Nave Industrial";
    const fileName = `rmm_model_v${state.version}.ifc`;

    const writer = new IFCWriter({ projectName, schema: "IFC4" });
    const base = writer.buildBase({ buildingName, storeyName: "Nivel 0" });

    const segs = buildSegmentsFromModel(state.model);

    const prodIds = [];
    for (const s of segs) {
      const pid = writer.addLinearProduct({
        ownerHistory: base.ownerHistory,
        storeyPlacement: base.storeyPlacement,
        context: base.context,
        kind: s.kind,
        name: s.name,
        start: s.a,
        end: s.b,
        profileSpec: s.profileSpec,
      });
      prodIds.push(pid);
    }

    if (prodIds.length) {
      writer.add(
        "IFCRELCONTAINEDINSPATIALSTRUCTURE",
        `${ifcStr(ifcGuid())},${ifcRef(base.ownerHistory)},${ifcStr("Containment")},$,${ifcList(prodIds.map((id) => ifcRef(id)))},${ifcRef(base.storey)}`
      );
    }

    const ifcText = [
      writer.header({ fileName, author: "RMM", org: "RMM", app: "RMM Web", time: nowISO() }),
      writer.lines.join("\n"),
      writer.footer(),
    ].join("\n");

    downloadText(fileName, ifcText, "application/octet-stream");
    if (st) st.textContent = `IFC4 exportado (SECCIÓN REAL): ${prodIds.length} elementos — archivo ${fileName}`;
  } catch (err) {
    if (st) st.textContent = `Error exportando IFC: ${err?.message || err}`;
  }
}

// -------------------- REGLAS (VALIDACIONES) --------------------
function rule(id, name, ok, msg) {
  return { id, name, ok: Boolean(ok), msg: msg || "" };
}

function getTypicalRanges(cover) {
  if (cover === "panel") {
    return { purlin: { min: 1.2, max: 2.5 }, girt: { min: 1.2, max: 2.2 } };
  }
  return { purlin: { min: 0.8, max: 1.5 }, girt: { min: 1.0, max: 2.0 } };
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

  results.push(rule("R5", "Separación correas techo (típica)", pOk, `Fuera de rango típico para "${b.cover}". Recomendado: ${ranges.purlin.min}–${ranges.purlin.max} m (verificar por cálculo y ficha técnica).`));
  results.push(rule("R6", "Separación largueros pared (típica)", gOk, `Fuera de rango típico para "${b.cover}". Recomendado: ${ranges.girt.min}–${ranges.girt.max} m (verificar por cálculo y ficha técnica).`));

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

    const { WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, AxesHelper, AmbientLight, DirectionalLight } = THREE;

    container.innerHTML = "";

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // ✅ SOMBRAS: habilitar apenas existe el renderer (antes de luces/mesh)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w0 = container.clientWidth || Math.max(320, Math.floor(window.innerWidth * 0.6));
    const h0 = container.clientHeight || 520; // ✅ FIX: evita height 0 => canvas invisible
    renderer.setSize(w0, h0);
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = new Color(0x071226);
    scene.fog = new Fog(0x071226, 80, 500);

    const camera = new PerspectiveCamera(55, w0 / h0, 0.1, 2000);
    camera.position.set(35, 18, 60);

    const controls = new state.preview.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.03;   // más suave
    controls.rotateSpeed = 0.35;     // rotación más lenta
    controls.zoomSpeed = 0.6;        // zoom más lento
    controls.panSpeed = 0.45;        // paneo más lento
    controls.minDistance = 10;
    controls.maxDistance = 250;
    controls.screenSpacePanning = true;
    controls.target.set(0, 6, 20);

    // --- SUELO SÓLIDO BLANCO ---
    const groundSize = 300;
    const groundThickness = 0.5;

    const groundGeometry = new THREE.BoxGeometry(groundSize, groundThickness, groundSize);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);

    // lo bajamos medio espesor para que el "0" quede arriba
    ground.position.y = -groundThickness / 2;

    // ✅ Recibe sombras
    ground.receiveShadow = true;

    scene.add(ground);

    const axes = new AxesHelper(8);
    scene.add(axes);

    scene.add(new AmbientLight(0xffffff, 0.55));

    const dir = new DirectionalLight(0xffffff, 0.9);
    dir.position.set(40, 60, 20);

    // ✅ Luz proyecta sombras
    dir.castShadow = true;

    // ✅ Calidad de sombras (recomendado)
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 600;
    dir.shadow.bias = -0.0002;

    scene.add(dir);

    state.preview.renderer = renderer;
    state.preview.scene = scene;
    state.preview.camera = camera;
    state.preview.controls = controls;

    if (state.preview.resizeObs) {
      try { state.preview.resizeObs.disconnect(); } catch {}
      state.preview.resizeObs = null;
    }

    const ro = new ResizeObserver(() => {
      if (!state.preview.renderer || !state.preview.camera) return;
      const w = container.clientWidth || w0;
      const h = container.clientHeight || h0;
      state.preview.renderer.setSize(w, h);
      state.preview.camera.aspect = w / h;
      state.preview.camera.updateProjectionMatrix();
    });
    ro.observe(container);
    state.preview.resizeObs = ro;

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
  if (state.preview.resizeObs) {
    try { state.preview.resizeObs.disconnect(); } catch {}
  }

  state.preview.ready = false;
  state.preview.THREE = null;
  state.preview.OrbitControls = null;
  state.preview.renderer = null;
  state.preview.scene = null;
  state.preview.camera = null;
  state.preview.controls = null;
  state.preview.animId = null;
  state.preview.resizeObs = null;

  container.innerHTML = "";
  const vs = qs("#viewer-status");
  if (vs) vs.textContent = "Sin archivo";
  const st = qs("#ifc-status");
  if (st) st.textContent = "Visor reiniciado. Preview se reinicia al generar modelo.";
}

// ✅ Preview con sección real: ExtrudeGeometry(Shape)
function addMember(THREE, parent, a, b, profileSpec, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len <= 0.0001) return;

  const pts = profilePolygon(profileSpec);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: len,
    bevelEnabled: false,
    steps: 1,
  });

  const mesh = new THREE.Mesh(geom, material);

  // La extrusión va en +Z local, alineamos con dir (a->b)
  const zAxis = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(zAxis, dir.clone().normalize());
  mesh.quaternion.copy(q);

  // centrar: extruye 0..len, movemos geometría a -len/2 para que el mesh quede en mid
  geom.translate(0, 0, -len / 2);

  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mesh.position.copy(mid);

  parent.add(mesh);
}

function fitToGroup(THREE, camera, controls, group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.6 || 40;

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

  const profCol = getProfileSpec("columna");
  const profBeam = getProfileSpec("cabio"); // incluye cabios y vigas planas
  const profPurl = getProfileSpec("correas");
  const profGirt = getProfileSpec("correas_columna");

  function roofY(x) {
    if (roof === "plana") return height;

    if (roof === "una_agua") {
      const t = (x + halfSpan) / span;
      return height + t * (span * slope);
    }

    const t = Math.abs(x) / halfSpan;
    return height + (1 - t) * (halfSpan * slope);
  }

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    let topL = new THREE.Vector3(-halfSpan, height, z);
    let topR = new THREE.Vector3(halfSpan, height, z);

    if (roof === "una_agua") {
      topR = new THREE.Vector3(halfSpan, height + span * slope, z);
    }

    const baseL = new THREE.Vector3(-halfSpan, 0, z);
    const baseR = new THREE.Vector3(halfSpan, 0, z);

    addMember(THREE, group, baseL, topL, profCol, matCol);
    addMember(THREE, group, baseR, topR, profCol, matCol);

    if (roof === "plana") {
      addMember(
        THREE,
        group,
        new THREE.Vector3(-halfSpan, roofY(-halfSpan), z),
        new THREE.Vector3(halfSpan, roofY(halfSpan), z),
        profBeam,
        matRafter
      );
    } else if (roof === "una_agua") {
      addMember(THREE, group, topL, topR, profBeam, matRafter);
    } else {
      const eaveL = new THREE.Vector3(-halfSpan, height, z);
      const eaveR = new THREE.Vector3(halfSpan, height, z);
      const ridge = new THREE.Vector3(0, height + halfSpan * slope, z);

      addMember(THREE, group, eaveL, ridge, profBeam, matRafter);
      addMember(THREE, group, ridge, eaveR, profBeam, matRafter);
    }
  }

  const linesAcross = Math.max(2, Math.floor(span / Math.max(0.1, purlinSpacing)) + 1);

  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    if (roof === "dos_aguas") {
      const halfLines = Math.max(1, Math.floor(linesAcross / 2));

      for (let k = 0; k <= halfLines; k++) {
        const x = -halfSpan + (k / halfLines) * halfSpan;
        addMember(THREE, group, new THREE.Vector3(x, roofY(x), z0), new THREE.Vector3(x, roofY(x), z1), profPurl, matPurlin);
      }

      for (let k = 1; k <= halfLines; k++) {
        const x = (k / halfLines) * halfSpan;
        addMember(THREE, group, new THREE.Vector3(x, roofY(x), z0), new THREE.Vector3(x, roofY(x), z1), profPurl, matPurlin);
      }

      addMember(THREE, group, new THREE.Vector3(0, roofY(0), z0), new THREE.Vector3(0, roofY(0), z1), profPurl, matPurlin);
    } else {
      for (let k = 0; k <= linesAcross; k++) {
        const x = -halfSpan + (k / linesAcross) * span;
        addMember(THREE, group, new THREE.Vector3(x, roofY(x), z0), new THREE.Vector3(x, roofY(x), z1), profPurl, matPurlin);
      }
    }
  }

  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const topL = height;
    const topR = roof === "una_agua" ? height + span * slope : height;

    const startY = 1.2;
    const maxYL = Math.max(startY, topL - 0.3);
    const maxYR = Math.max(startY, topR - 0.3);

    const levelsL = Math.max(2, Math.floor((maxYL - startY) / Math.max(0.1, girtSpacing)) + 1);
    const levelsR = Math.max(2, Math.floor((maxYR - startY) / Math.max(0.1, girtSpacing)) + 1);

    for (let i = 0; i < levelsL; i++) {
      const y = Math.min(maxYL, startY + i * girtSpacing);
      addMember(THREE, group, new THREE.Vector3(-halfSpan, y, z0), new THREE.Vector3(-halfSpan, y, z1), profGirt, matGirt);
    }

    for (let i = 0; i < levelsR; i++) {
      const y = Math.min(maxYR, startY + i * girtSpacing);
      addMember(THREE, group, new THREE.Vector3(halfSpan, y, z0), new THREE.Vector3(halfSpan, y, z1), profGirt, matGirt);
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
