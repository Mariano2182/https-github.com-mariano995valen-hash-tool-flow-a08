// script.js (ES Module) — GitHub Pages friendly (imports por URL completa)
// BOM “ultra técnico” + correas/largueros segmentados + líneas/niveles + robustez anti-null

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
    const emailEl = qs("#auth-email");
    const roleEl = qs("#auth-role");
    const email = emailEl ? emailEl.value.trim() : "";
    const role = roleEl ? roleEl.value : "Cliente";

    state.session = { email, role, at: nowISO() };
    state.role = role;

    const s = qs("#auth-status");
    if (s) s.textContent = `Sesión demo activa: ${email || "(sin email)"} (${role})`;
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
      if (!email) {
        if (status) status.textContent = "Ingresá un email para enviar el magic link.";
        return;
      }
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
  if (qs("#ind-purlin") && qs("#ind-purlin-value"))
    setTxt("#ind-purlin-value", Number(qs("#ind-purlin").value).toFixed(2));
  if (qs("#ind-girt") && qs("#ind-girt-value"))
    setTxt("#ind-girt-value", Number(qs("#ind-girt").value).toFixed(2));
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
    el.addEventListener("input", updateIndustrialLabels);
    el.addEventListener("change", updateIndustrialLabels);
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

// -------------------- MODELO PARAMÉTRICO (JSON) + BOM ULTRA --------------------
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

  const halfSpan = span / 2;
  const rise_two_slope = halfSpan * slope; // dos aguas: subida a cumbrera desde alero
  const rise_one_slope = span * slope; // una agua: diferencia entre aleros

  // Longitudes típicas (aprox) para BOM
  const rafterLen_two = Math.hypot(halfSpan, rise_two_slope); // cabio por faldón
  const rafterLen_one = Math.hypot(span, rise_one_slope); // cabio único

  // Alturas de alero
  const eaveLow = height;
  const eaveHigh = roof === "una_agua" ? height + rise_one_slope : height;

  // Líneas de correas
  let purlinLinesTotal = Math.max(2, Math.floor(span / purlinSpacing) + 1);

  let purlinLinesLeft = 0;
  let purlinLinesRight = 0;

  if (roof === "dos_aguas") {
    const perSlope = Math.max(2, Math.floor(halfSpan / purlinSpacing) + 1);
    purlinLinesLeft = perSlope;
    purlinLinesRight = perSlope;
    // total “ingenieril” (cumbrera se cuenta una sola vez)
    purlinLinesTotal = perSlope * 2 - 1;
  }

  // Niveles de largueros (por lado)
  const startY = 1.2; // arranque típico del primer larguero
  const topYL = Math.max(startY, eaveLow - 0.3);
  const topYR = Math.max(startY, eaveHigh - 0.3);

  const girtLevelsLeft = Math.max(2, Math.floor((topYL - startY) / girtSpacing) + 1);
  const girtLevelsRight = Math.max(2, Math.floor((topYR - startY) / girtSpacing) + 1);

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
      bays,
      step,
      slope,
      purlinSpacing,
      girtSpacing,

      // DERIVADOS “BOM ULTRA”
      eaveLow,
      eaveHigh,
      rise_two_slope,
      rise_one_slope,
      rafterLen_two,
      rafterLen_one,
      purlinLinesTotal,
      purlinLinesLeft,
      purlinLinesRight,
      girtLevelsLeft,
      girtLevelsRight,
    },
    elements: [],
  };

  // -------------------- ELEMENTOS PRINCIPALES --------------------
  for (let i = 0; i < frames; i++) {
    model.elements.push({
      id: `COL-L-${i + 1}`,
      type: "columna_izq",
      qty: 1,
      length: eaveLow,
      weightKg: eaveLow * 90,
    });

    model.elements.push({
      id: `COL-R-${i + 1}`,
      type: "columna_der",
      qty: 1,
      length: eaveHigh,
      weightKg: eaveHigh * 90,
    });

    if (roof === "dos_aguas") {
      model.elements.push({
        id: `RAF-L-${i + 1}`,
        type: "cabio_faldon_izq",
        qty: 1,
        length: rafterLen_two,
        weightKg: rafterLen_two * 40,
      });
      model.elements.push({
        id: `RAF-R-${i + 1}`,
        type: "cabio_faldon_der",
        qty: 1,
        length: rafterLen_two,
        weightKg: rafterLen_two * 40,
      });
    } else {
      const beamLen = roof === "plana" ? span : rafterLen_one;
      model.elements.push({
        id: `BEAM-${i + 1}`,
        type: roof === "plana" ? "viga_superior" : "cabio_principal",
        qty: 1,
        length: beamLen,
        weightKg: beamLen * 55,
      });
    }
  }

  // -------------------- CORREAS TECHO (MIEMBROS SEGMENTADOS POR VANO) --------------------
  if (roof === "dos_aguas") {
    const membersLeft = purlinLinesLeft * bays;
    const membersRight = purlinLinesRight * bays;

    model.elements.push({
      id: `PURLINS-L`,
      type: "correa_techo_faldon_izq",
      qty: membersLeft,
      length: step,
      weightKg: membersLeft * step * 8,
    });

    model.elements.push({
      id: `PURLINS-R`,
      type: "correa_techo_faldon_der",
      qty: membersRight,
      length: step,
      weightKg: membersRight * step * 8,
    });

    // correa cumbrera segmentada (1 línea)
    model.elements.push({
      id: `PURLIN-RIDGE`,
      type: "correa_cumbrera",
      qty: bays,
      length: step,
      weightKg: bays * step * 8,
    });

    // aleros: 2 líneas (izq+der)
    model.elements.push({
      id: `PURLIN-EAVES`,
      type: "correa_alero",
      qty: 2 * bays,
      length: step,
      weightKg: 2 * bays * step * 8,
    });
  } else {
    const members = purlinLinesTotal * bays;
    model.elements.push({
      id: `PURLINS`,
      type: "correa_techo",
      qty: members,
      length: step,
      weightKg: members * step * 8,
    });

    // aleros: 2 líneas
    model.elements.push({
      id: `PURLIN-EAVES`,
      type: "correa_alero",
      qty: 2 * bays,
      length: step,
      weightKg: 2 * bays * step * 8,
    });
  }

  // -------------------- LARGUEROS PARED (MIEMBROS SEGMENTADOS POR VANO) --------------------
  const girtMembersLeft = girtLevelsLeft * bays;
  const girtMembersRight = girtLevelsRight * bays;

  model.elements.push({
    id: `GIRTS-L`,
    type: "larguero_pared_izq",
    qty: girtMembersLeft,
    length: step,
    weightKg: girtMembersLeft * step * 6,
  });

  model.elements.push({
    id: `GIRTS-R`,
    type: "larguero_pared_der",
    qty: girtMembersRight,
    length: step,
    weightKg: girtMembersRight * step * 6,
  });

  // -------------------- “BOM ULTRA”: LÍNEAS / NIVELES COMO ÍTEMS DE INGENIERÍA --------------------
  // (metadatos: peso 0)
  model.elements.push({ id: `META_BAYS`, type: "bays_vanos", qty: bays, length: 0, weightKg: 0 });
  model.elements.push({ id: `META_STEP`, type: "paso_porticos_m", qty: 1, length: step, weightKg: 0 });

  model.elements.push({ id: `META_PURLIN_LINES`, type: "lineas_correas_techo", qty: purlinLinesTotal, length: 0, weightKg: 0 });
  if (roof === "dos_aguas") {
    model.elements.push({ id: `META_PURLIN_LINES_L`, type: "lineas_correas_faldon_izq", qty: purlinLinesLeft, length: 0, weightKg: 0 });
    model.elements.push({ id: `META_PURLIN_LINES_R`, type: "lineas_correas_faldon_der", qty: purlinLinesRight, length: 0, weightKg: 0 });
  }

  model.elements.push({ id: `META_GIRT_LEVELS`, type: "niveles_largueros_pared", qty: Math.max(girtLevelsLeft, girtLevelsRight), length: 0, weightKg: 0 });
  model.elements.push({ id: `META_GIRT_LEVELS_L`, type: "niveles_largueros_izq", qty: girtLevelsLeft, length: 0, weightKg: 0 });
  model.elements.push({ id: `META_GIRT_LEVELS_R`, type: "niveles_largueros_der", qty: girtLevelsRight, length: 0, weightKg: 0 });

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

// -------------------- BOM TABLE (ULTRA TÉCNICO) --------------------
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
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0, length: null };
    cur.qty += Number(e.qty) || 0;
    cur.weightKg += Number(e.weightKg) || 0;
    if (cur.length == null && e.length != null && Number(e.length) > 0) cur.length = Number(e.length);
    map.set(k, cur);
  }

  const order = [
    "bays_vanos",
    "paso_porticos_m",
    "lineas_correas_techo",
    "lineas_correas_faldon_izq",
    "lineas_correas_faldon_der",
    "niveles_largueros_pared",
    "niveles_largueros_izq",
    "niveles_largueros_der",

    "columna_izq",
    "columna_der",
    "viga_superior",
    "cabio_principal",
    "cabio_faldon_izq",
    "cabio_faldon_der",

    "correa_cumbrera",
    "correa_alero",
    "correa_techo",
    "correa_techo_faldon_izq",
    "correa_techo_faldon_der",

    "larguero_pared_izq",
    "larguero_pared_der",
  ];

  const rows = [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.type);
    const ib = order.indexOf(b.type);
    if (ia === -1 && ib === -1) return a.type.localeCompare(b.type);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const label = (r) => {
    const isMeta =
      r.type.startsWith("lineas_") ||
      r.type.startsWith("niveles_") ||
      r.type.startsWith("bays_") ||
      r.type.startsWith("paso_");

    if (r.type === "paso_porticos_m" && r.length != null) return `paso_porticos (≈${r.length.toFixed(2)} m)`;
    if (!isMeta && r.length != null) return `${r.type} (L≈${r.length.toFixed(2)} m)`;
    return r.type;
  };

  tbody.innerHTML = rows
    .map((r) => {
      const w = Math.round(r.weightKg);
      return `
        <tr>
          <td>${label(r)}</td>
          <td>${fmt(r.qty)}</td>
          <td>${fmt(w)}</td>
          <td>OK</td>
        </tr>
      `;
    })
    .join("");
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

// BOM CSV ULTRA: incluye longitud típica
function exportBOM() {
  const st = qs("#ifc-status");
  if (!state.model) {
    if (st) st.textContent = "No hay modelo para exportar.";
    return;
  }

  const map = new Map();
  for (const e of state.model.elements) {
    const k = e.type;
    const cur = map.get(k) || { type: k, qty: 0, weightKg: 0, lengthTypical: null };
    cur.qty += Number(e.qty) || 0;
    cur.weightKg += Number(e.weightKg) || 0;
    if (cur.lengthTypical == null && e.length != null && Number(e.length) > 0) cur.lengthTypical = Number(e.length);
    map.set(k, cur);
  }

  const rows = [...map.values()];
  const header = "Elemento,Cantidad,Longitud_tipica_m,Peso_kg,Version\n";
  const lines = rows
    .map((r) => `${r.type},${r.qty},${r.lengthTypical != null ? r.lengthTypical.toFixed(3) : ""},${Math.round(r.weightKg)},${state.version}`)
    .join("\n");

  downloadText(`rmm_bom_v${state.version}.csv`, header + lines, "text/csv");
}

// -------------------- REGLAS (VALIDACIONES) --------------------
function rule(id, name, ok, msg) {
  return { id, name, ok: Boolean(ok), msg: msg || "" };
}

function getTypicalRanges(cover) {
  // Rangos típicos “de anteproyecto” (verificar por cálculo + ficha)
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
    // Import directo por URL completa (evita “Failed to resolve module specifier 'three'”)
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

// Preview paramétrico: pórticos + correas techo (por vano) + largueros (por vano)
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
      const t = (x + halfSpan) / span; // 0..1
      return height + t * (span * slope);
    }

    const t = Math.abs(x) / halfSpan; // 0 centro, 1 alero
    return height + (1 - t) * (halfSpan * slope);
  }

  // -------------------- PÓRTICOS --------------------
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

  // -------------------- CORREAS DE TECHO (segmentadas POR VANO) --------------------
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

  // -------------------- LARGUEROS EN COLUMNAS (segmentados POR VANO) --------------------
  function colTopYLeft() {
    return height;
  }
  function colTopYRight() {
    return roof === "una_agua" ? height + span * slope : height;
  }

  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const topL = colTopYLeft();
    const topR = colTopYRight();

    const startY = 1.2;
    const maxYL = Math.max(startY, topL - 0.3);
    const maxYR = Math.max(startY, topR - 0.3);

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

  const st = qs("#ifc-status");
  if (st) st.textContent = `Preview 3D: ${roof} — pendiente ${(slope * 100).toFixed(1)}% — correas ${purlinSpacing.toFixed(2)}m — largueros ${girtSpacing.toFixed(2)}m`;
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
