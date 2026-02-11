// script.js (ES Module) — GitHub Pages friendly (imports por URL completa)
// ✅ BOM con clases (bom-tech/bom-section/bom-divider/bom-ok/bom-warn)
// ✅ robusto (no rompe si faltan nodos)
// ✅ IFC Export REAL (IFC4) — geometría paramétrica (extrusiones) + jerarquía Proyecto/Sitio/Edificio/Nivel
//    - Columnas -> IfcColumn
//    - Vigas/Cabios -> IfcBeam
//    - Correas/Largueros -> IfcMember
//    - Representación: IfcExtrudedAreaSolid (rectángulo) orientado por placement (eje local Z = dirección de la barra)
// ✅ NUEVO: Conexiones paramétricas reales (End-Plate atornillada) con bulón M16 (default),
//          chequeos mínimos (V, N, interacción) + bearing + soldadura aprox
// ✅ NUEVO: BOM suma placas y bulones; Validaciones agrega estado de conexiones

const qs = (sel, parent = document) => parent.querySelector(sel);
const qsa = (sel, parent = document) => [...parent.querySelectorAll(sel)];

const state = {
  session: null,
  role: null,
  model: null,
  version: 0,
  wizardStep: 1,

  // ✅ Catálogo mínimo (extensible)
  catalog: {
    densitySteel: 7850, // kg/m3
    gammaM2: 1.25,
    materials: {
      S275: { fy: 275, fu: 430, E: 210000 }, // MPa
      S355: { fy: 355, fu: 510, E: 210000 }, // MPa
    },
    bolts: {
      "8.8": { fu: 800 }, // MPa
      "10.9": { fu: 1000 }, // MPa
    },
    // Áreas resistentes As (mm2) típicas (ISO). Podés ampliar.
    boltAs: {
      M12: 84.3,
      M16: 157,
      M20: 245,
      M24: 353,
    },
    // Clasificación (placeholder formal): Omniclass/Uniclass/Custom
    classifications: {
      // ejemplo simple: podés mapear a Uniclass/Omniclass real más adelante
      columna: { system: "RMM", code: "SS_25_10_20", name: "Steel Columns" },
      cabio: { system: "RMM", code: "SS_25_10_10", name: "Steel Beams/Rafters" },
      viga: { system: "RMM", code: "SS_25_10_10", name: "Steel Beams" },
      correas: { system: "RMM", code: "SS_25_30_50", name: "Purlins" },
      correas_columna: { system: "RMM", code: "SS_25_30_40", name: "Girts" },
      endplate: { system: "RMM", code: "SS_25_20_10", name: "End Plate Connection" },
      bolt: { system: "RMM", code: "Pr_65_52", name: "Bolts" },
      weld: { system: "RMM", code: "Pr_65_55", name: "Welds" },
    },
  },

  // ✅ Acciones de diseño (si no existe UI, se usan defaults)
  designActions: {
    knee: {
      Mk_kNm: 60, // Momento por rodilla (kNm) (default demo)
      Vk_kN: 40, // Cortante por rodilla (kN)
      Nk_kN: 0, // Axial (kN) opcional
    },
  },

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

    // ✅ IFC Export (REAL)
    if (action === "export-ifc") exportIFC();
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

  // ✅ Lectura opcional de acciones de diseño (si existen inputs)
  bindDesignActionsInputs();
}

// -------------------- ACCIONES DE DISEÑO (UI opcional) --------------------
function bindDesignActionsInputs() {
  // Si agregás estos inputs en HTML, quedan activos:
  //  - #knee-mk (kNm), #knee-vk (kN), #knee-nk (kN)
  const mk = qs("#knee-mk");
  const vk = qs("#knee-vk");
  const nk = qs("#knee-nk");

  const apply = () => {
    if (mk) state.designActions.knee.Mk_kNm = clamp(Number(mk.value || 60), 0, 5000);
    if (vk) state.designActions.knee.Vk_kN = clamp(Number(vk.value || 40), 0, 5000);
    if (nk) state.designActions.knee.Nk_kN = clamp(Number(nk.value || 0), -5000, 5000);
    // Revalida si ya hay modelo
    if (state.model) {
      computeAndAttachConnectionChecks(state.model);
      renderBOMFromModel();
      runRules();
    }
  };

  [mk, vk, nk].filter(Boolean).forEach((el) => {
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });
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

  // sumar conexiones si existen
  const connWeight = (model?.connectionBOM?.items || []).reduce((acc, it) => acc + (Number(it.weightKg) || 0), 0);
  const connCount = (model?.connectionBOM?.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

  return { count: count + connCount, weight: weight + connWeight };
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

  // conexiones como "other"
  const connWeight = (model?.connectionBOM?.items || []).reduce((acc, it) => acc + (Number(it.weightKg) || 0), 0);
  wOther += connWeight;

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

// ============================================================================
// ====================== CONEXIONES PARAMÉTRICAS (M16) =======================
// ============================================================================

// Default: End-Plate atornillada (rodilla)
// Unidades internas: fuerzas N, momentos Nmm, dimensiones mm.
function defaultEndPlateConnection() {
  return {
    type: "endplate_bolted",
    material: "S355",
    bolts: {
      d: 16, // mm (M16)
      grade: "8.8",
      nRows: 4,
      nCols: 2,
      // paso y distancias a borde (mm)
      p: 70, // pitch vertical
      g: 80, // gauge horizontal (entre columnas de bulones)
      e1: 40, // borde horizontal
      e2: 40, // borde inferior
    },
    plate: {
      t: 12, // mm
      width: 220, // mm
      height: 380, // mm
    },
    weld: {
      a: 6, // garganta mm (aprox)
      // longitud se calcula en base al ancho de placa si no se da
      length: null, // mm (si null => 2*width)
    },
  };
}

function ensureConnections(model) {
  if (!model) return;
  if (!model.connections) model.connections = [];

  // Evitar duplicar si ya existen y corresponden a esta versión
  if (model.connections?.length) return;

  const b = model.building || {};
  const frames = Number(b.frames || 0);
  const roof = b.roof || "dos_aguas";

  // Por cada pórtico: rodilla izquierda y derecha
  // Mapeo de ids (según tu generador actual)
  for (let i = 1; i <= frames; i++) {
    const colL = `COL-L-${i}`;
    const colR = `COL-R-${i}`;

    if (roof === "dos_aguas") {
      const rafL = `RAF-L-${i}`;
      const rafR = `RAF-R-${i}`;

      model.connections.push({
        id: `KNEE-L-${i}`,
        from: colL,
        to: rafL,
        ...defaultEndPlateConnection(),
        side: "L",
        frame: i,
      });
      model.connections.push({
        id: `KNEE-R-${i}`,
        from: colR,
        to: rafR,
        ...defaultEndPlateConnection(),
        side: "R",
        frame: i,
      });
    } else {
      // una_agua o plana: un beam/cabio por pórtico
      const beam = `BEAM-${i}`; // tu generador usa BEAM-i para no dos_aguas
      model.connections.push({
        id: `KNEE-L-${i}`,
        from: colL,
        to: beam,
        ...defaultEndPlateConnection(),
        side: "L",
        frame: i,
      });
      model.connections.push({
        id: `KNEE-R-${i}`,
        from: colR,
        to: beam,
        ...defaultEndPlateConnection(),
        side: "R",
        frame: i,
      });
    }
  }
}

// Calcula resistencias por bulón (simplificado)
// - Vrd = 0.6 * fub * As / gammaM2
// - Nrd = 0.9 * fub * As / gammaM2
function boltDesignResistances({ d, grade }, catalog) {
  const fub = catalog?.bolts?.[grade]?.fu ?? 800; // MPa
  const As = catalog?.boltAs?.[`M${d}`] ?? 157; // mm2
  const gamma = catalog?.gammaM2 ?? 1.25;

  const Vrd = (0.6 * fub * As) / gamma; // N (porque MPa=N/mm2)
  const Nrd = (0.9 * fub * As) / gamma; // N
  return { fub, As, Vrd, Nrd };
}

// Bearing de placa (muy conservador y simple)
// FbRd ≈ k * d * t * fu / gammaM2
function bearingResistance({ d, t, material }, catalog) {
  const fu = catalog?.materials?.[material]?.fu ?? 510; // MPa
  const gamma = catalog?.gammaM2 ?? 1.25;
  const k = 1.0;
  const FbRd = (k * d * t * fu) / gamma; // N
  return { fu, FbRd };
}

// Soldadura filete aproximada (conservadora)
// FwRd ≈ 0.42*fu * Aw / gamma
function weldResistance({ a, length, material }, catalog) {
  const fu = catalog?.materials?.[material]?.fu ?? 510; // MPa
  const gamma = catalog?.gammaM2 ?? 1.25;
  const fvw = 0.42 * fu; // MPa
  const Aw = a * length; // mm2 (garganta * longitud)
  const FwRd = (fvw * Aw) / gamma; // N
  return { fu, FwRd };
}

// Chequeo de End-Plate con acciones Mk,Vk,Nk (por conexión)
// simplificación:
///  - V por bulón = V / nBolts
///  - Tensión por momento: T = M / z ; z ~ 0.8*plate.height
///  - N por bulón = (T / nTensionBolts) + (N/ nBolts) (si Nk>0)
function checkEndPlate(conn, actions, catalog) {
  const Mk = Number(actions?.Mk_kNm ?? 60); // kNm
  const Vk = Number(actions?.Vk_kN ?? 40); // kN
  const Nk = Number(actions?.Nk_kN ?? 0); // kN

  const M = Mk * 1e6; // Nmm
  const V = Vk * 1e3; // N
  const N = Nk * 1e3; // N

  const bolts = conn.bolts;
  const plate = conn.plate;
  const weld = conn.weld;

  const nBolts = Math.max(1, (Number(bolts.nRows) || 4) * (Number(bolts.nCols) || 2));
  const nTensionBolts = Math.max(1, Math.ceil(nBolts / 2)); // simplificación: mitad en tracción

  const { Vrd, Nrd, As, fub } = boltDesignResistances({ d: bolts.d, grade: bolts.grade }, catalog);

  const VEdBolt = V / nBolts;

  const z = Math.max(50, 0.8 * (Number(plate.height) || 380)); // mm
  const T = M / z; // N (resultante tracción)
  const NEdBolt_fromM = T / nTensionBolts;

  const NEdBolt_fromN = N / nBolts; // axial distribuida (puede ser negativa -> compresión, ignoramos en tracción)
  const NEdBolt = Math.max(0, NEdBolt_fromM + NEdBolt_fromN);

  const utilV = Vrd > 0 ? VEdBolt / Vrd : 999;
  const utilN = Nrd > 0 ? NEdBolt / Nrd : 999;
  const utilInt = utilV * utilV + utilN * utilN; // criterio elíptico simple

  // Bearing placa
  const { FbRd } = bearingResistance({ d: bolts.d, t: plate.t, material: conn.material }, catalog);
  const FbEd = Math.sqrt(VEdBolt * VEdBolt + NEdBolt * NEdBolt); // resultante por bulón
  const utilBear = FbRd > 0 ? FbEd / FbRd : 999;

  // Soldadura (solo informativo/semáforo)
  const wLen = weld.length == null ? 2 * (Number(plate.width) || 220) : Number(weld.length);
  const { FwRd } = weldResistance({ a: weld.a, length: wLen, material: conn.material }, catalog);
  // Sup: soldadura “toma” una parte del cortante + parte de T (muy aproximado)
  const FwEd = 0.6 * V + 0.4 * T;
  const utilWeld = FwRd > 0 ? FwEd / FwRd : 999;

  // Status global de conexión (conservador)
  const utilMax = Math.max(utilV, utilN, utilBear, utilWeld, Math.sqrt(utilInt));
  const ok = utilMax <= 1.0;

  return {
    ok,
    util: {
      boltShear: utilV,
      boltTension: utilN,
      boltInteraction: utilInt, // <=1
      bearing: utilBear,
      weld: utilWeld,
      max: utilMax,
    },
    detail: {
      actions: { Mk_kNm: Mk, Vk_kN: Vk, Nk_kN: Nk },
      bolt: { d: bolts.d, grade: bolts.grade, nBolts, nTensionBolts, As, fub, VEdBolt, NEdBolt, Vrd, Nrd },
      plate: { ...plate, z },
      weld: { ...weld, length: wLen, FwEd, FwRd },
      bearing: { FbEd, FbRd },
    },
  };
}

// Adjunta resultados al modelo + genera BOM de conexiones
function computeAndAttachConnectionChecks(model) {
  if (!model) return;
  ensureConnections(model);

  const checks = [];
  const bomItems = [];

  const actions = state.designActions?.knee || { Mk_kNm: 60, Vk_kN: 40, Nk_kN: 0 };
  const cat = state.catalog;

  for (const c of model.connections || []) {
    const res = checkEndPlate(c, actions, cat);
    checks.push({ id: c.id, from: c.from, to: c.to, type: c.type, ok: res.ok, utilMax: res.util.max, util: res.util, detail: res.detail });

    // BOM por conexión
    const plate = c.plate;
    const bolts = c.bolts;
    const weld = c.weld;

    const t_m = (Number(plate.t) || 12) / 1000;
    const w_m = (Number(plate.width) || 220) / 1000;
    const h_m = (Number(plate.height) || 380) / 1000;
    const plateVol = t_m * w_m * h_m; // m3
    const plateW = plateVol * cat.densitySteel; // kg

    const nBolts = Math.max(1, (Number(bolts.nRows) || 4) * (Number(bolts.nCols) || 2));
    const weldLen_m = ((weld.length == null ? 2 * (Number(plate.width) || 220) : Number(weld.length)) / 1000);
    const weldA_m = (Number(weld.a) || 6) / 1000;
    // Peso de soldadura no se suele contar, pero dejamos “qty” como metros para taller
    const weldQty = weldLen_m;

    bomItems.push({
      type: "endplate",
      id: `PLATE_${c.id}`,
      name: `Placa End-Plate ${c.id} (${plate.t}mm)`,
      qty: 1,
      unit: "un",
      weightKg: plateW,
    });
    bomItems.push({
      type: "bolt",
      id: `BOLT_${c.id}`,
      name: `Bulón M${bolts.d} ${bolts.grade} (${nBolts}u)`,
      qty: nBolts,
      unit: "un",
      weightKg: 0, // opcional: agregar peso por bulón si querés
    });
    bomItems.push({
      type: "weld",
      id: `WELD_${c.id}`,
      name: `Soldadura filete a=${weld.a}mm (L=${weldQty.toFixed(2)}m)`,
      qty: Number(weldQty.toFixed(2)),
      unit: "m",
      weightKg: 0,
    });
  }

  model.checks = model.checks || {};
  model.checks.connections = checks;

  model.connectionBOM = {
    items: compressConnectionBOM(bomItems),
    raw: bomItems,
  };
}

function compressConnectionBOM(items) {
  const map = new Map();
  for (const it of items || []) {
    const key = `${it.type}|${it.name}|${it.unit || ""}`;
    const cur = map.get(key) || { ...it, qty: 0, weightKg: 0 };
    cur.qty += Number(it.qty) || 0;
    cur.weightKg += Number(it.weightKg) || 0;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => (a.type || "").localeCompare(b.type || ""));
}

function connectionSummary(model) {
  const arr = model?.checks?.connections || [];
  if (!arr.length) return { total: 0, ok: 0, warn: 0, worst: 0 };
  let ok = 0;
  let worst = 0;
  for (const c of arr) {
    if (c.ok) ok++;
    worst = Math.max(worst, Number(c.utilMax) || 0);
  }
  return { total: arr.length, ok, warn: arr.length - ok, worst };
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
    connections: [], // ✅
    checks: {}, // ✅
    connectionBOM: { items: [], raw: [] }, // ✅
  };

  // columnas y cabios/vigas por pórtico (BOM lógico)
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

  // ✅ Conexiones + chequeos + BOM conexiones
  ensureConnections(model);
  computeAndAttachConnectionChecks(model);

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

  // ✅ Sumar items de conexiones como filas BOM "extra"
  const connItems = state.model.connectionBOM?.items || [];
  for (const it of connItems) {
    const k = it.type || "conexion";
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0, ml: 0 };
    cur.qty += Number(it.qty) || 0;
    cur.weightKg += Number(it.weightKg) || 0;
    // ml no aplica
    map.set(k, cur);
  }

  const rows = [...map.values()].sort((a, bb) => a.type.localeCompare(bb.type));

  const connSum = connectionSummary(state.model);

  // Filas técnicas (con kind para clases)
  const techRows = [
    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "CONEXIONES (END-PLATE) — M16", qty: "", w: "", status: "INFO" },
    {
      kind: "tech",
      name: "Conexiones generadas (un)",
      qty: fmt(connSum.total),
      w: "",
      status: connSum.warn ? "WARN" : "OK",
    },
    {
      kind: "tech",
      name: "Conexiones OK / Revisar",
      qty: `${fmt(connSum.ok)} / ${fmt(connSum.warn)}`,
      w: "",
      status: connSum.warn ? "WARN" : "OK",
    },
    {
      kind: "tech",
      name: "Utilización peor (max)",
      qty: fmt2(connSum.worst),
      w: "",
      status: connSum.worst > 1.0 ? "WARN" : "OK",
    },

    { kind: "divider", name: "—", qty: "", w: "", status: "—" },

    { kind: "section", name: "MÉTRICAS (PESO POR SISTEMA)", qty: "", w: "", status: "INFO" },
    { kind: "tech", name: "Peso primaria (kg) — pórticos", qty: "", w: fmt(Math.round(grouped.wPrimary)), status: "OK" },
    { kind: "tech", name: "Peso secundaria (kg) — correas+largueros", qty: "", w: fmt(Math.round(grouped.wSecondary)), status: "OK" },
    { kind: "tech", name: "Peso otros (kg) — conexiones", qty: "", w: fmt(Math.round(grouped.wOther)), status: "OK" },
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
      const mlLabel = r.ml > 0 ? `${fmt2(r.ml)} m.l.` : "";
      return `
      <tr>
        <td>${r.type}</td>
        <td>${fmt(r.qty)}</td>
        <td>${fmt(Math.round(r.weightKg))}</td>
        <td>${mlLabel}</td>
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
      `kg/m² total(planta) ${fmt2(eng.kgm2Plan)} | prim ${fmt2(eng.kgm2PlanPrimary)} | sec ${fmt2(eng.kgm2PlanSecondary)} — ` +
      `Conexiones: ${connSum.ok}/${connSum.total} OK`;
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

  // ✅ sumo conexiones BOM
  for (const it of state.model.connectionBOM?.items || []) {
    const k = it.type || "conexion";
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0, ml: 0 };
    cur.qty += Number(it.qty) || 0;
    cur.weightKg += Number(it.weightKg) || 0;
    map.set(k, cur);
  }

  const rows = [...map.values()];
  const header = "Elemento,Cantidad,Peso_kg,MetrosLineales_m,Version\n";
  const lines = rows
    .map((r) => `${r.type},${r.qty},${Math.round(r.weightKg)},${(r.ml || 0).toFixed(2)},${state.version}`)
    .join("\n");

  const connSum = connectionSummary(state.model);

  const extra =
    "\n\n#CONEXIONES\n" +
    `conexiones_total,${connSum.total},,,\n` +
    `conexiones_ok,${connSum.ok},,,\n` +
    `conexiones_warn,${connSum.warn},,,\n` +
    `conexiones_util_peor,${connSum.worst.toFixed(3)},,,\n` +
    "\n#PESO_POR_SISTEMA\n" +
    `peso_primaria_kg,,${Math.round(grouped.wPrimary)},,\n` +
    `peso_secundaria_kg,,${Math.round(grouped.wSecondary)},,\n` +
    `peso_otros_conexiones_kg,,${Math.round(grouped.wOther)},,\n` +
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
  else {
    for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  }
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

  const segs = [];
  function pushSeg(kind, name, a, c, size) {
    const dir = vSub(c, a);
    const len = vLen(dir);
    if (len <= 1e-6) return;
    segs.push({ kind, name, a, b: c, size, length: len });
  }

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    let topL = v3(-halfSpan, height, z);
    let topR = v3(halfSpan, height, z);

    if (roof === "una_agua") {
      topL = v3(-halfSpan, height, z);
      topR = v3(halfSpan, height + span * slope, z);
    }

    const baseL = v3(-halfSpan, 0, z);
    const baseR = v3(halfSpan, 0, z);

    pushSeg("COLUMN", `COL-L-${i + 1}`, baseL, topL, colSize);
    pushSeg("COLUMN", `COL-R-${i + 1}`, baseR, topR, colSize);

    if (roof === "plana") {
      pushSeg("BEAM", `BEAM-${i + 1}`, v3(-halfSpan, roofY(-halfSpan), z), v3(halfSpan, roofY(halfSpan), z), rafterSize);
    } else if (roof === "una_agua") {
      pushSeg("BEAM", `RAF-${i + 1}`, topL, topR, rafterSize);
    } else {
      const eaveL = v3(-halfSpan, height, z);
      const eaveR = v3(halfSpan, height, z);
      const ridge = v3(0, height + halfSpan * slope, z);
      pushSeg("BEAM", `RAF-L-${i + 1}`, eaveL, ridge, rafterSize);
      pushSeg("BEAM", `RAF-R-${i + 1}`, ridge, eaveR, rafterSize);
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
        pushSeg("MEMBER", `PURLIN-L-${bay + 1}-${k + 1}`, v3(x, roofY(x), z0), v3(x, roofY(x), z1), purlinSize);
      }
      for (let k = 1; k <= halfLines; k++) {
        const x = (k / halfLines) * halfSpan;
        pushSeg("MEMBER", `PURLIN-R-${bay + 1}-${k + 1}`, v3(x, roofY(x), z0), v3(x, roofY(x), z1), purlinSize);
      }
      pushSeg("MEMBER", `PURLIN-RIDGE-${bay + 1}`, v3(0, roofY(0), z0), v3(0, roofY(0), z1), purlinSize);
    } else {
      for (let k = 0; k <= linesAcross; k++) {
        const x = -halfSpan + (k / linesAcross) * span;
        pushSeg("MEMBER", `PURLIN-${bay + 1}-${k + 1}`, v3(x, roofY(x), z0), v3(x, roofY(x), z1), purlinSize);
      }
    }
  }

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
      pushSeg("MEMBER", `GIRT-L-${bay + 1}-${i + 1}`, v3(-halfSpan, y, z0), v3(-halfSpan, y, z1), girtSize);
    }
    for (let i = 0; i < levelsR; i++) {
      const y = Math.min(maxYR, startY + i * girtSpacing);
      pushSeg("MEMBER", `GIRT-R-${bay + 1}-${i + 1}`, v3(halfSpan, y, z0), v3(halfSpan, y, z1), girtSize);
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
    const ownerHistory = this.add("IFCOWNERHISTORY", `${ifcRef(pAndO)},${ifcRef(app)},$,.ADDED.,$,$,$,${ifcNum(Date.now() / 1000)}`);

    const uLen = this.add("IFCSIUNIT", `$,.LENGTHUNIT.,.METRE.,$`);
    const uArea = this.add("IFCSIUNIT", `$,.AREAUNIT.,.SQUARE_METRE.,$`);
    const uVol = this.add("IFCSIUNIT", `$,.VOLUMEUNIT.,.CUBIC_METRE.,$`);
    const uMass = this.add("IFCSIUNIT", `$,.MASSUNIT.,.GRAM.,.KILO.`);
    const unitAssignment = this.add("IFCUNITASSIGNMENT", ifcList([ifcRef(uLen), ifcRef(uArea), ifcRef(uVol), ifcRef(uMass)]));

    const originPt = this.add("IFCCARTESIANPOINT", ifcPt(v3(0, 0, 0)));
    const wcs = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(originPt)},$,$`);
    const context = this.add("IFCGEOMETRICREPRESENTATIONCONTEXT", `${ifcStr("Model")},${ifcStr("3D")},3,${ifcNum(1e-5)},${ifcRef(wcs)},$`);

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
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr("Aggregates")},$,${ifcRef(project)},${ifcList([ifcRef(site)])}`.replace(/\s+/g, " ")
    );
    this.add(
      "IFCRELAGGREGATES",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr("Aggregates")},$,${ifcRef(site)},${ifcList([ifcRef(building)])}`.replace(/\s+/g, " ")
    );
    this.add(
      "IFCRELAGGREGATES",
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr("Aggregates")},$,${ifcRef(building)},${ifcList([ifcRef(storey)])}`.replace(/\s+/g, " ")
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

  makeExtrudedRectShape({ context, width, height, depth }) {
    const origin2d = this.add("IFCCARTESIANPOINT", `(0.,0.)`);
    const prof = this.add(
      "IFCRECTANGLEPROFILEDEF",
      `.AREA.,${ifcStr("")},$,${ifcRef(origin2d)},${ifcNum(width)},${ifcNum(height)}`.replace(/\s+/g, " ")
    );

    const solidPosPt = this.add("IFCCARTESIANPOINT", ifcPt(v3(0, 0, 0)));
    const solidPos = this.add("IFCAXIS2PLACEMENT3D", `${ifcRef(solidPosPt)},$,$`);

    const extrudeDir = this.add("IFCDIRECTION", ifcDir(v3(0, 0, 1)));
    const solid = this.add("IFCEXTRUDEDAREASOLID", `${ifcRef(prof)},${ifcRef(solidPos)},${ifcRef(extrudeDir)},${ifcNum(depth)}`);

    const bodyRep = this.add(
      "IFCSHAPEREPRESENTATION",
      `${ifcRef(context)},${ifcStr("Body")},${ifcStr("SweptSolid")},${ifcList([ifcRef(solid)])}`
    );

    const pds = this.add("IFCPRODUCTDEFINITIONSHAPE", `$,$,${ifcList([ifcRef(bodyRep)])}`);
    return pds;
  }

  addLinearProduct({ ownerHistory, storeyPlacement, context, kind, name, start, end, size }) {
    const dir = vSub(end, start);
    const len = vLen(dir);
    const dirUnit = vNorm(dir);

    const placement = this.makeMemberPlacement({ storeyPlacement, start, dirUnit });

    const w = Math.max(0.02, Number(size) || 0.08);
    const h = w;
    const shape = this.makeExtrudedRectShape({ context, width: w, height: h, depth: len });

    const ent = kind === "COLUMN" ? "IFCCOLUMN" : kind === "BEAM" ? "IFCBEAM" : "IFCMEMBER";
    const prod = this.add(
      ent,
      `${ifcStr(ifcGuid())},${ifcRef(ownerHistory)},${ifcStr(name)},${ifcStr("")},$,${ifcRef(placement)},${ifcRef(shape)},$,$`.replace(/\s+/g, " ")
    );

    return prod;
  }
}

// -------------------- IFC EXPORT (REAL IFC4) --------------------
async function exportIFC() {
  const st = qs("#ifc-status");
  if (!state.model) {
    if (st) st.textContent = "No hay modelo para exportar a IFC.";
    return;
  }

  try {
    const projectName = (qs("#project-name")?.value?.trim() || "RMM Project") + ` v${state.version}`;
    const buildingName = qs("#project-client")?.value?.trim()
      ? `Nave — ${qs("#project-client").value.trim()}`
      : "Nave Industrial";
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
        size: s.size,
      });
      prodIds.push(pid);
    }

    if (prodIds.length) {
      writer.add(
        "IFCRELCONTAINEDINSPATIALSTRUCTURE",
        `${ifcStr(ifcGuid())},${ifcRef(base.ownerHistory)},${ifcStr("Containment")},$,${ifcList(prodIds.map((id) => ifcRef(id)))},${ifcRef(base.storey)}`.replace(
          /\s+/g,
          " "
        )
      );
    }

    const ifcText = [writer.header({ fileName, author: "RMM", org: "RMM", app: "RMM Web", time: nowISO() }), writer.lines.join("\n"), writer.footer()].join(
      "\n"
    );

    downloadText(fileName, ifcText, "application/octet-stream");

    if (st) st.textContent = `IFC4 exportado (REAL): ${prodIds.length} elementos — archivo ${fileName}`;
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

  // ✅ recalcular chequeos por si cambian acciones
  computeAndAttachConnectionChecks(state.model);

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

  // ✅ Conexiones
  const connSum = connectionSummary(state.model);
  results.push(
    rule(
      "R7",
      "Conexiones (End-Plate M16) — semáforo",
      connSum.warn === 0,
      `Hay ${connSum.warn}/${connSum.total} conexiones para revisar (utilización peor: ${fmt2(connSum.worst)}).`
    )
  );

  const ok = results.filter((r) => r.ok).length;
  summary.textContent = `Validaciones: ${ok}/${results.length} OK`;

  // Detalle opcional (top 6 peores conexiones)
  const worst = (state.model.checks?.connections || [])
    .slice()
    .sort((a, b) => (Number(b.utilMax) || 0) - (Number(a.utilMax) || 0))
    .slice(0, 6);

  const worstHtml =
    worst.length > 0
      ? `
      <div class="rule-item">
        <strong>Detalle (peores conexiones)</strong>
        ${worst
          .map(
            (c) => `
            <div class="helper">
              ${c.ok ? "✅" : "⚠️"} ${c.id} — util ${fmt2(c.utilMax)} (V=${fmt2(c.util.boltShear)} N=${fmt2(c.util.boltTension)} bear=${fmt2(
              c.util.bearing
            )} weld=${fmt2(c.util.weld)})
            </div>
          `
          )
          .join("")}
      </div>
    `
      : "";

  list.innerHTML =
    results
      .map(
        (r) => `
      <div class="rule-item">
        <strong>${r.id} — ${r.name}</strong>
        <div>${r.ok ? "✅ OK" : "⚠️ Revisar"}</div>
        ${r.ok ? "" : `<div class="helper">${r.msg}</div>`}
      </div>
    `
      )
      .join("") + worstHtml;
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
    const connSum = connectionSummary(state.model);
    st.textContent =
      `Preview 3D: ${roof} — pendiente ${(slope * 100).toFixed(1)}% — ` +
      `correas ${purlinSpacing.toFixed(2)}m — largueros ${girtSpacing.toFixed(2)}m — ` +
      `kg/m² total(planta) ${fmt2(eng.kgm2Plan)} | prim ${fmt2(eng.kgm2PlanPrimary)} | sec ${fmt2(eng.kgm2PlanSecondary)} — ` +
      `Conexiones ${connSum.ok}/${connSum.total} OK`;
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

  // ✅ recomputar conexiones/checks
  computeAndAttachConnectionChecks(state.model);

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

    computeAndAttachConnectionChecks(state.model);

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
