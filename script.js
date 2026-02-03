/* =========================
   RMM STRUCTURES — MVP Avanzado (SPA)
   ========================= */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------- UI refs ---------- */
const appStatus = $("#app-status");

const authForm = $("#auth-form");
const authEmail = $("#auth-email");
const authRole = $("#auth-role");
const authStatus = $("#auth-status");
const authPermissions = $("#auth-permissions");
const authSupabaseStatus = $("#auth-supabase-status");

const stepButtons = $$(".wizard-steps .step");
const stepPanels = $$(".wizard-form .step-panel");
const wizardForm = $("#wizard-form");
const wizardSummary = $("#wizard-summary");
const wizardStatus = $("#wizard-status");

const geometryStatus = $("#geometry-status");
const detailStatus = $("#detail-status");
const materialsTable = $("#materials-table");

const projectForm = $("#project-form");
const projectStatus = $("#project-status");
const workspaceProject = $("#workspace-project");
const workspaceLocation = $("#workspace-location");
const workspaceTonnage = $("#workspace-tonnage");
const workspaceStage = $("#workspace-stage");

const priceKg = $("#price-kg");
const coefFab = $("#coef-fab");
const coefMont = $("#coef-mont");
const costSummary = $("#cost-summary");

const persistenceStatus = $("#persistence-status");
const versionList = $("#version-list");

const rulesSummary = $("#rules-summary");
const rulesList = $("#rules-list");
const rulesDetail = $("#rules-detail");

const progressBar = $("#progress-bar");
const progressLabel = $("#progress-label");

const demoForm = $("#demo-form");
const demoStatus = $("#demo-status");
const consultingForm = $("#consulting-form");
const consultingStatus = $("#consulting-status");
const tourStatus = $("#tour-status");

const supabaseUrlInput = $("#supabase-url");
const supabaseKeyInput = $("#supabase-key");
const supabaseStatus = $("#supabase-status");

/* ---------- Roles / permissions ---------- */
const rolePermissions = {
  Cliente: ["VIEW_PROJECT", "EXPORT_BOM", "EXPORT_SUMMARY"],
  Ingeniero: ["VIEW_PROJECT", "EDIT_MODEL", "RUN_RULES", "EXPORT_BOM", "EXPORT_JSON", "EXPORT_SUMMARY", "EXPORT_DSTV"],
  Fabricador: ["VIEW_PROJECT", "EXPORT_BOM", "EXPORT_DSTV", "EXPORT_SUMMARY"],
  Admin: ["VIEW_PROJECT", "EDIT_MODEL", "RUN_RULES", "EXPORT_BOM", "EXPORT_JSON", "EXPORT_SUMMARY", "EXPORT_DSTV", "SAVE_REMOTE"],
};

/* ---------- State ---------- */
const state = {
  wizardStep: 1,
  wizardData: {},
  workspace: null,
  model: null, // {meta, geometryElements, bom, totals, versions...}
  progress: 62,
};

/* ---------- Storage keys ---------- */
const LS = {
  session: "rmm-session",
  workspace: "rmm-workspace",
  versions: "rmm-versions",
  supabase: "rmm-supabase-config",
};

/* ---------- Helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nowISO = () => new Date().toISOString();

const safeJSON = (raw) => {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

const downloadBlob = (content, filename, type = "text/plain") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const setStatus = (msg) => {
  if (appStatus) appStatus.textContent = msg;
};

/* =========================
   Session (local)
   ========================= */
const getSession = () => safeJSON(localStorage.getItem(LS.session));
const saveSession = (s) => localStorage.setItem(LS.session, JSON.stringify(s));
const clearSession = () => localStorage.removeItem(LS.session);

const hasPermission = (perm) => {
  const session = getSession();
  if (!session) return false;
  const perms = rolePermissions[session.role] || [];
  return perms.includes(perm);
};

const renderPermissions = (role) => {
  if (!authPermissions) return;
  const perms = role ? (rolePermissions[role] || []) : [];
  authPermissions.innerHTML = perms.length
    ? perms.map((p) => `<li>${p}</li>`).join("")
    : "<li>Sin permisos</li>";
};

const updateAuthUI = (session) => {
  if (!authStatus) return;
  if (!session) {
    authStatus.textContent = "Sin sesión activa.";
    renderPermissions(null);
    return;
  }
  authStatus.textContent = `Sesión activa: ${session.email} (${session.role}).`;
  renderPermissions(session.role);
};

/* =========================
   Workspace & versions (local)
   ========================= */
const loadWorkspace = () => safeJSON(localStorage.getItem(LS.workspace));
const saveWorkspace = (w) => localStorage.setItem(LS.workspace, JSON.stringify(w));

const loadVersions = () => safeJSON(localStorage.getItem(LS.versions)) || [];
const saveVersions = (arr) => localStorage.setItem(LS.versions, JSON.stringify(arr));

const renderWorkspace = () => {
  const w = state.workspace || loadWorkspace();
  if (!w) return;

  workspaceProject.textContent = w.project;
  workspaceLocation.textContent = w.location;
  workspaceTonnage.textContent = `${w.tonnage} t`;
  workspaceStage.textContent = w.stage;
};

const renderVersions = () => {
  if (!versionList) return;
  const versions = loadVersions();
  versionList.innerHTML = versions.length
    ? versions
        .slice()
        .reverse()
        .map((v) => {
          const dt = new Date(v.created_at).toLocaleString();
          return `
          <div class="version-item">
            <strong>${v.project_name}</strong>
            <small>${dt}</small>
            <span>Elementos: ${v.model?.geometryElements?.length || 0} · Peso: ${Math.round(v.model?.totals?.weightKg || 0)} kg</span>
          </div>`;
        })
        .join("")
    : `<div class="helper">Aún no hay versiones guardadas.</div>`;
};

/* =========================
   Modals
   ========================= */
const openModal = (id) => {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
};

const closeModal = (modal) => {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
};

const bindModals = () => {
  $$("[data-modal]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.modal));
  });

  $$("[data-close]").forEach((btn) => {
    const modal = btn.closest(".modal");
    if (!modal) return;
    btn.addEventListener("click", () => closeModal(modal));
  });

  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) closeModal(m);
    });
  });
};

/* =========================
   Smooth scroll buttons
   ========================= */
const bindScrollButtons = () => {
  $$("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.scroll;
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
};

/* =========================
   Wizard
   ========================= */
const setWizardStep = (step) => {
  state.wizardStep = clamp(step, 1, 4);
  stepButtons.forEach((b) => b.classList.toggle("active", Number(b.dataset.step) === state.wizardStep));
  stepPanels.forEach((p) => p.classList.toggle("active", Number(p.dataset.step) === state.wizardStep));
};

const getWizardDataFromForm = () => {
  const fd = new FormData(wizardForm);
  const obj = Object.fromEntries(fd.entries());
  return {
    tipo: obj.tipo || "industrial",
    ubicacion: obj.ubicacion || "",
    ancho: Number(obj.ancho || 24),
    largo: Number(obj.largo || 60),
    altura: Number(obj.altura || 8),
    porticos: Number(obj.porticos || 10),
    portico: obj.portico || "rigido",
    perfil: obj.perfil || "IPE300",
    cubierta: obj.cubierta || "chapa",
    cerramiento: obj.cerramiento || "parcial",
  };
};

const renderWizardSummary = () => {
  const d = state.wizardData;
  if (!wizardSummary) return;
  wizardSummary.innerHTML = `
    <strong>Resumen</strong><br/>
    Tipo: ${d.tipo} · Ubicación: ${d.ubicacion}<br/>
    ${d.ancho}m x ${d.largo}m · Altura: ${d.altura}m · Pórticos: ${d.porticos}<br/>
    Pórtico: ${d.portico} · Perfil: ${d.perfil} · Cubierta: ${d.cubierta} · Cerramiento: ${d.cerramiento}
  `;
};

/* =========================
   Parametric model (MVP)
   ========================= */
const profileLibrary = {
  IPE300: { name: "IPE 300", kg_m: 42.2 },
  HEA200: { name: "HEA 200", kg_m: 42.3 },
  TUBO200x100: { name: "Tubo 200x100", kg_m: 25.0 },
};

const buildGeometryModel = () => {
  const d = state.wizardData;
  const width = clamp(Number(d.ancho || 24), 10, 80);
  const length = clamp(Number(d.largo || 60), 10, 300);
  const height = clamp(Number(d.altura || 8), 3, 25);
  const frames = clamp(Number(d.porticos || 10), 2, 60);
  const spacing = frames > 1 ? length / (frames - 1) : length;

  const profile = profileLibrary[d.perfil] || profileLibrary.IPE300;
  const elements = [];

  // Simple portal frame model:
  // For each frame: 2 columns + 1 rafter/beam
  // Columns vertical, beams across width at top.
  for (let i = 0; i < frames; i++) {
    const x = i * spacing;

    // Columns
    elements.push({
      id: `C${String(i + 1).padStart(2, "0")}-L`,
      type: "COLUMN",
      profile: d.perfil,
      length_m: height,
      qty: 1,
      status: "MODELADO",
      meta: { frame: i + 1, side: "LEFT", x },
    });
    elements.push({
      id: `C${String(i + 1).padStart(2, "0")}-R`,
      type: "COLUMN",
      profile: d.perfil,
      length_m: height,
      qty: 1,
      status: "MODELADO",
      meta: { frame: i + 1, side: "RIGHT", x },
    });

    // Beam/rafter
    elements.push({
      id: `B${String(i + 1).padStart(2, "0")}`,
      type: "BEAM",
      profile: d.perfil,
      length_m: width,
      qty: 1,
      status: "MODELADO",
      meta: { frame: i + 1, x },
    });
  }

  // Basic purlins (correas) approx: along length
  const purlinLines = 6; // demo
  const purlinSpan = spacing;
  const purlinCount = (frames - 1) * purlinLines;
  elements.push({
    id: `Z-PURLINS`,
    type: "PURLIN",
    profile: "Z200",
    length_m: purlinSpan,
    qty: purlinCount,
    status: "DEMO",
    meta: { lines: purlinLines },
  });

  // Compute totals
  const bom = buildBOM(elements);
  const totals = computeTotals(bom);

  const model = {
    meta: {
      created_at: nowISO(),
      tipo: d.tipo,
      ubicacion: d.ubicacion,
      ancho_m: width,
      largo_m: length,
      altura_m: height,
      porticos: frames,
      perfil: d.perfil,
    },
    geometryElements: elements,
    bom,
    totals,
  };

  state.model = model;
  geometryStatus.textContent = `Geometría calculada: ${elements.length} items (incluye items agrupados).`;
  detailStatus.textContent = "Detalle MVP: perfiles + cuantificación + export (uniones: roadmap).";
  setStatus("Modelo generado");

  return model;
};

const buildBOM = (elements) => {
  const byKey = new Map();

  for (const el of elements) {
    const key = `${el.type}|${el.profile}|${el.length_m}`;
    const prev = byKey.get(key);
    const qty = Number(el.qty || 1);

    if (!prev) {
      byKey.set(key, {
        element: el.type,
        profile: el.profile,
        length_m: Number(el.length_m || 0),
        qty,
        status: el.status || "MODELADO",
      });
    } else {
      prev.qty += qty;
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.element.localeCompare(b.element));
};

const computeTotals = (bom) => {
  let weightKg = 0;

  for (const row of bom) {
    const lib = profileLibrary[row.profile] || null;
    const kgm = lib?.kg_m || (row.profile === "Z200" ? 8.5 : 25); // fallback demo
    weightKg += row.qty * row.length_m * kgm;
  }

  return {
    weightKg,
  };
};

const renderBOMTable = () => {
  if (!materialsTable) return;
  if (!state.model?.bom?.length) {
    materialsTable.innerHTML = `<tr><td colspan="4">Listado pendiente de generación.</td></tr>`;
    return;
  }

  materialsTable.innerHTML = state.model.bom
    .map((r) => {
      const lib = profileLibrary[r.profile] || null;
      const kgm = lib?.kg_m || (r.profile === "Z200" ? 8.5 : 25);
      const weight = r.qty * r.length_m * kgm;
      return `
      <tr>
        <td>${r.element} · ${r.profile} · ${r.length_m.toFixed(2)}m</td>
        <td>${r.qty}</td>
        <td>${weight.toFixed(1)}</td>
        <td>${r.status}</td>
      </tr>
      `;
    })
    .join("");
};

/* =========================
   Costing
   ========================= */
const calcCost = () => {
  if (!state.model?.totals) {
    costSummary.textContent = "Primero generá el modelo y la BOM.";
    return;
  }
  const weightKg = state.model.totals.weightKg || 0;

  const p = Number(priceKg.value || 0);
  const f = Number(coefFab.value || 1);
  const m = Number(coefMont.value || 0);

  const materialCost = weightKg * p;
  const fabricationCost = materialCost * f;
  const erectionCost = fabricationCost * m;
  const total = fabricationCost + erectionCost;

  costSummary.innerHTML = `
    Peso estimado: <strong>${Math.round(weightKg)} kg</strong><br/>
    Material: ${materialCost.toFixed(0)}<br/>
    Fab (coef ${f}): ${fabricationCost.toFixed(0)}<br/>
    Montaje (coef ${m}): ${erectionCost.toFixed(0)}<br/>
    <strong>Total: ${total.toFixed(0)}</strong>
  `;
};

/* =========================
   Export
   ========================= */
const exportBOMCsv = () => {
  if (!hasPermission("EXPORT_BOM")) return alert("Sin permisos para exportar BOM.");
  if (!state.model?.bom?.length) return alert("Primero generá el modelo y la BOM.");

  const header = ["elemento", "perfil", "longitud_m", "cantidad", "status"].join(",");
  const rows = state.model.bom.map((r) =>
    [r.element, r.profile, r.length_m.toFixed(3), r.qty, r.status].join(",")
  );
  downloadBlob([header, ...rows].join("\n"), "rmm-bom.csv", "text/csv");
};

const exportModelJson = () => {
  if (!hasPermission("EXPORT_JSON")) return alert("Sin permisos para exportar JSON.");
  if (!state.model) return alert("Primero generá el modelo.");
  downloadBlob(JSON.stringify(state.model, null, 2), "rmm-modelo.json", "application/json");
};

const exportSummaryTxt = () => {
  if (!hasPermission("EXPORT_SUMMARY")) return alert("Sin permisos para exportar resumen.");
  if (!state.model) return alert("Primero generá el modelo.");

  const w = state.workspace;
  const d = state.model.meta;
  const t = state.model.totals;

  const lines = [
    "RMM STRUCTURES — Resumen de proyecto",
    "-----------------------------------",
    `Fecha: ${new Date(d.created_at).toLocaleString()}`,
    w ? `Proyecto: ${w.project}` : "Proyecto: -",
    w ? `Ubicación: ${w.location}` : `Ubicación: ${d.ubicacion}`,
    w ? `Etapa: ${w.stage}` : "Etapa: -",
    "",
    `Nave: ${d.ancho_m}m x ${d.largo_m}m · Altura ${d.altura_m}m · Pórticos ${d.porticos}`,
    `Perfil base: ${d.perfil}`,
    `Peso estimado: ${Math.round(t.weightKg)} kg`,
    "",
    "Notas:",
    "- Modelo paramétrico MVP (sin uniones detalladas).",
    "- Exportaciones: BOM/JSON/Resumen/DSTV-lite demo.",
  ];

  downloadBlob(lines.join("\n"), "rmm-resumen.txt", "text/plain");
};

// DSTV-lite demo: simple text file with per-element lines.
// (No es NC1 real. Es un “puente” para mostrar intención industrial.)
const exportDstvLite = () => {
  if (!hasPermission("EXPORT_DSTV")) return alert("Sin permisos para exportar DSTV.");
  if (!state.model?.geometryElements?.length) return alert("Primero generá el modelo.");

  const lines = [
    "RMM DSTV-LITE (DEMO)",
    "---------------------",
    `DATE ${nowISO()}`,
    `COUNT ${state.model.geometryElements.length}`,
    "",
  ];

  for (const el of state.model.geometryElements) {
    const len = Number(el.length_m || 0);
    lines.push(`ST ${el.id} ${el.type} ${el.profile} LEN ${len.toFixed(3)} QTY ${el.qty || 1}`);
  }

  downloadBlob(lines.join("\n"), "rmm-dstv-lite.txt", "text/plain");
};

/* =========================
   Rules (MVP deterministic)
   ========================= */
const buildRules = () => {
  const issues = [];
  const model = state.model;

  const rule = (id, title, status, detail) => ({ id, title, status, detail });

  if (!model) {
    return [
      rule("R1", "Modelo existente", "ERROR", "No hay modelo. Generá geometría primero."),
    ];
  }

  // R1: Basic dimensions sanity
  const { ancho_m, largo_m, altura_m, porticos } = model.meta;
  if (ancho_m <= 0 || largo_m <= 0 || altura_m <= 0 || porticos < 2) {
    issues.push(rule("R1", "Dimensiones válidas", "ERROR", "Dimensiones inválidas o pórticos < 2."));
  } else {
    issues.push(rule("R1", "Dimensiones válidas", "OK", "Dimensiones dentro de rangos mínimos."));
  }

  // R2: Weight non-zero
  if ((model.totals?.weightKg || 0) <= 0) {
    issues.push(rule("R2", "Peso estimado", "WARNING", "Peso 0. Revisar perfiles / BOM."));
  } else {
    issues.push(rule("R2", "Peso estimado", "OK", `Peso: ${Math.round(model.totals.weightKg)} kg.`));
  }

  // R3: Export readiness
  const canExport = model.bom?.length > 0;
  issues.push(
    rule(
      "R3",
      "Listados generados",
      canExport ? "OK" : "ERROR",
      canExport ? "BOM lista para export." : "BOM vacía."
    )
  );

  // R4: Permissions
  const session = getSession();
  if (!session) {
    issues.push(rule("R4", "Sesión activa", "WARNING", "No hay sesión. Algunas acciones quedarán bloqueadas."));
  } else {
    issues.push(rule("R4", "Sesión activa", "OK", `Rol: ${session.role}.`));
  }

  return issues;
};

const renderRules = (items) => {
  if (!rulesList) return;

  rulesList.innerHTML = items
    .map((r) => {
      const badge = r.status === "OK" ? "✅" : r.status === "WARNING" ? "⚠️" : "❌";
      return `
        <div class="rule-item" data-rule="${r.id}" style="border:1px solid var(--border); border-radius:14px; padding:12px; cursor:pointer; background:#fff; margin-top:10px;">
          <div style="display:flex; justify-content:space-between; gap:12px;">
            <strong>${badge} ${r.id} — ${r.title}</strong>
            <span style="font-weight:700; font-size:.85rem; text-transform:uppercase;">${r.status}</span>
          </div>
          <div class="helper" style="margin-top:6px;">${r.detail}</div>
        </div>
      `;
    })
    .join("");

  // click detail
  $$(".rule-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.rule;
      const r = items.find((x) => x.id === id);
      if (!r) return;
      rulesDetail.textContent = `${r.id} — ${r.title}: ${r.detail}`;
    });
  });

  const hasError = items.some((i) => i.status === "ERROR");
  const hasWarn = items.some((i) => i.status === "WARNING");
  rulesSummary.textContent = hasError ? "Hay errores a resolver." : hasWarn ? "Validación con advertencias." : "Validación OK.";
};

/* =========================
   Supabase integration (optional)
   ========================= */
const loadSupabaseConfig = () => safeJSON(localStorage.getItem(LS.supabase));
const saveSupabaseConfig = (cfg) => localStorage.setItem(LS.supabase, JSON.stringify(cfg));

const ensureSupabaseClient = () => {
  const cfg = loadSupabaseConfig();
  const url = cfg?.url || supabaseUrlInput?.value?.trim();
  const key = cfg?.key || supabaseKeyInput?.value?.trim();

  if (!url || !key) return null;
  if (!window.supabase) return null;

  return window.supabase.createClient(url, key);
};

const updateSupabaseStatus = (msg) => {
  if (supabaseStatus) supabaseStatus.textContent = msg;
};

const updateAuthSupabaseStatus = (msg) => {
  if (authSupabaseStatus) authSupabaseStatus.textContent = msg;
};

const sendMagicLink = async () => {
  const client = ensureSupabaseClient();
  if (!client) return updateAuthSupabaseStatus("Configura Supabase URL + KEY primero.");

  const email = authEmail.value.trim();
  if (!email) return updateAuthSupabaseStatus("Ingresá un email válido.");

  const { error } = await client.auth.signInWithOtp({ email });
  updateAuthSupabaseStatus(error ? `Error: ${error.message}` : "Magic link enviado. Revisá tu correo.");
};

const syncSupabaseSession = async () => {
  const client = ensureSupabaseClient();
  if (!client) return;

  const { data } = await client.auth.getSession();
  const sess = data?.session;
  if (!sess) {
    updateAuthSupabaseStatus("Sin sesión Supabase activa.");
    return;
  }

  // role from metadata fallback
  const role = (sess.user?.user_metadata?.role && rolePermissions[sess.user.user_metadata.role])
    ? sess.user.user_metadata.role
    : "Cliente";

  const localSession = { email: sess.user?.email || "usuario@empresa.com", role };
  saveSession(localSession);
  updateAuthUI(localSession);
  updateAuthSupabaseStatus(`Supabase Auth activo: ${localSession.email}`);
};

const saveRemoteVersion = async () => {
  if (!hasPermission("SAVE_REMOTE")) return alert("Sin permisos para guardar en remoto (rol Admin).");
  const client = ensureSupabaseClient();
  if (!client) return updateSupabaseStatus("Configura Supabase URL + KEY.");

  const w = state.workspace;
  const model = state.model;
  if (!w || !model) return updateSupabaseStatus("Primero crea workspace y genera modelo.");

  const { data: sData } = await client.auth.getSession();
  const sess = sData?.session;
  if (!sess) return updateSupabaseStatus("Iniciá sesión Supabase (magic link) primero.");

  const payload = {
    owner_id: sess.user.id,
    org_id: null,
    project_id: null,
    project_name: w.project,
    client_name: "Cliente (demo)",
    bim_json: model,
  };

  const { error } = await client.from("project_versions").insert(payload);
  updateSupabaseStatus(error ? `Error guardando: ${error.message}` : "Versión guardada en Supabase.");
};

const loadRemoteLatest = async () => {
  const client = ensureSupabaseClient();
  if (!client) return updateSupabaseStatus("Configura Supabase URL + KEY.");

  const w = state.workspace;
  if (!w) return updateSupabaseStatus("Primero crea workspace.");

  const { data: sData } = await client.auth.getSession();
  const sess = sData?.session;
  if (!sess) return updateSupabaseStatus("Iniciá sesión Supabase (magic link) primero.");

  const { data, error } = await client
    .from("project_versions")
    .select("id, project_name, bim_json, created_at")
    .eq("owner_id", sess.user.id)
    .eq("project_name", w.project)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return updateSupabaseStatus(`Error cargando: ${error.message}`);
  if (!data?.length) return updateSupabaseStatus("No hay versiones remotas para este proyecto.");

  state.model = data[0].bim_json;
  renderBOMTable();
  geometryStatus.textContent = "Modelo cargado desde Supabase.";
  detailStatus.textContent = "Modelo remoto listo.";
  updateSupabaseStatus("Última versión remota cargada.");
};

/* =========================
   Catalog demo (simple)
   ========================= */
const catalogTableBody = $("#catalog-table-body");
const catalogStatus = $("#catalog-status");

const libraries = {
  "rmm-core": [
    { name: "IPE300", norma: "EN", type: "I", h: 0.300, b: 0.150, tw: 0.0065, tf: 0.0107, rmin: 12, kgm: 42.2 },
    { name: "HEA200", norma: "EN", type: "H", h: 0.190, b: 0.200, tw: 0.0065, tf: 0.0100, rmin: 15, kgm: 42.3 },
    { name: "TUBO200x100", norma: "ISO", type: "RECT", h: 0.200, b: 0.100, tw: 0.0040, tf: 0.0040, rmin: 6, kgm: 25.0 },
  ],
  "eu-steel": [
    { name: "IPE270", norma: "EN", type: "I", h: 0.270, b: 0.135, tw: 0.0066, tf: 0.0102, rmin: 12, kgm: 36.1 },
    { name: "HEB200", norma: "EN", type: "H", h: 0.200, b: 0.200, tw: 0.0090, tf: 0.0150, rmin: 15, kgm: 61.3 },
  ],
  "aisc-us": [
    { name: "W12x50", norma: "AISC", type: "W", h: 0.310, b: 0.203, tw: 0.0071, tf: 0.0112, rmin: 13, kgm: 74.4 },
  ],
  "custom-plant": [
    { name: "C200", norma: "PLANTA", type: "C", h: 0.200, b: 0.075, tw: 0.0032, tf: 0.0032, rmin: 4, kgm: 14.0 },
  ],
};

const renderCatalog = (key) => {
  if (!catalogTableBody) return;
  const rows = libraries[key] || libraries["rmm-core"];
  catalogTableBody.innerHTML = rows
    .map((r) => `
      <tr>
        <td>${r.name}</td>
        <td>${r.norma}</td>
        <td>${r.type}</td>
        <td>${r.h.toFixed(3)}</td>
        <td>${r.b.toFixed(3)}</td>
        <td>${r.tw.toFixed(4)}</td>
        <td>${r.tf.toFixed(4)}</td>
        <td>${r.rmin}</td>
        <td>${r.kgm.toFixed(1)}</td>
      </tr>
    `)
    .join("");

  if (catalogStatus) catalogStatus.textContent = `Biblioteca cargada: ${key}`;
};

const exportCatalogJson = () => {
  const key = $("#catalog-library-select")?.value || "rmm-core";
  const company = $("#catalog-company")?.value?.trim() || "Empresa";
  const rows = libraries[key] || [];
  const payload = { library: key, company, rows, created_at: nowISO() };
  downloadBlob(JSON.stringify(payload, null, 2), `rmm-catalog-${key}.json`, "application/json");
};

/* =========================
   Progress
   ========================= */
const updateProgress = () => {
  state.progress = clamp(state.progress + 6, 0, 100);
  if (progressBar) progressBar.style.width = `${state.progress}%`;
  if (progressLabel) progressLabel.textContent = `Progreso actual: ${state.progress}%`;
};

/* =========================
   Bind actions
   ========================= */
const bindActions = () => {
  // Auth
  if (authForm) {
    authForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = authEmail.value.trim();
      const role = authRole.value;
      if (!email) return;

      saveSession({ email, role });
      updateAuthUI(getSession());
      setStatus("Sesión iniciada");
    });
  }

  $$("[data-action='logout']").forEach((b) =>
    b.addEventListener("click", () => {
      clearSession();
      updateAuthUI(null);
      updateAuthSupabaseStatus("Supabase Auth sin configurar.");
      setStatus("Sesión cerrada");
    })
  );

  $$("[data-action='magic-link']").forEach((b) => b.addEventListener("click", sendMagicLink));

  // Wizard navigation
  $$("[data-action='next']").forEach((b) =>
    b.addEventListener("click", () => {
      state.wizardData = getWizardDataFromForm();
      if (state.wizardStep === 3) renderWizardSummary();
      setWizardStep(state.wizardStep + 1);
    })
  );

  $$("[data-action='prev']").forEach((b) =>
    b.addEventListener("click", () => setWizardStep(state.wizardStep - 1))
  );

  stepButtons.forEach((b) => {
    b.addEventListener("click", () => {
      state.wizardData = getWizardDataFromForm();
      if (Number(b.dataset.step) === 4) renderWizardSummary();
      setWizardStep(Number(b.dataset.step));
    });
  });

  // Wizard submit
  if (wizardForm) {
    wizardForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.wizardData = getWizardDataFromForm();

      // Permission gate
      if (!hasPermission("EDIT_MODEL")) {
        wizardStatus.textContent = "Sin permisos para generar modelo (requiere Ingeniero/Admin).";
        return;
      }

      buildGeometryModel();
      renderBOMTable();

      wizardStatus.textContent = "Modelo generado. Mirá BOM y exportaciones.";
      setStatus("Modelo listo");
      document.querySelector("#editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Editor actions
  $$("[data-action='build-geometry']").forEach((b) =>
    b.addEventListener("click", () => {
      if (!hasPermission("EDIT_MODEL")) return alert("Sin permisos para calcular geometría.");
      state.wizardData = state.wizardData?.ancho ? state.wizardData : getWizardDataFromForm();
      buildGeometryModel();
      renderBOMTable();
    })
  );

  $$("[data-action='materials']").forEach((b) =>
    b.addEventListener("click", () => {
      if (!state.model) return alert("Primero generá el modelo.");
      renderBOMTable();
    })
  );

  $$("[data-action='progress']").forEach((b) => b.addEventListener("click", updateProgress));

  // Exports
  $$("[data-action='export-bom']").forEach((b) => b.addEventListener("click", exportBOMCsv));
  $$("[data-action='export-json']").forEach((b) => b.addEventListener("click", exportModelJson));
  $$("[data-action='export-summary']").forEach((b) => b.addEventListener("click", exportSummaryTxt));
  $$("[data-action='export-dstv']").forEach((b) => b.addEventListener("click", exportDstvLite));

  // Cost
  $$("[data-action='calc-cost']").forEach((b) => b.addEventListener("click", calcCost));

  // Project / workspace
  if (projectForm) {
    projectForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(projectForm);
      const w = {
        project: String(fd.get("project") || "").trim(),
        location: String(fd.get("location") || "").trim(),
        tonnage: Number(fd.get("tonnage") || 0),
        stage: String(fd.get("stage") || "Conceptual"),
        created_at: nowISO(),
      };
      if (!w.project || !w.location || !w.tonnage) {
        projectStatus.textContent = "Completa los campos.";
        return;
      }
      state.workspace = w;
      saveWorkspace(w);
      renderWorkspace();
      projectStatus.textContent = "Workspace creado.";
      setStatus("Workspace activo");
    });
  }

  // Local versioning
  $$("[data-action='save-project']").forEach((b) =>
    b.addEventListener("click", () => {
      const w = state.workspace || loadWorkspace();
      const model = state.model;
      if (!w || !model) {
        persistenceStatus.textContent = "Primero crea workspace y genera modelo.";
        return;
      }
      const versions = loadVersions();
      versions.push({
        project_name: w.project,
        created_at: nowISO(),
        model,
      });
      saveVersions(versions);
      persistenceStatus.textContent = "Versión guardada (local).";
      renderVersions();
    })
  );

  $$("[data-action='load-project']").forEach((b) =>
    b.addEventListener("click", () => {
      const versions = loadVersions();
      if (!versions.length) {
        persistenceStatus.textContent = "No hay versiones.";
        return;
      }
      const last = versions[versions.length - 1];
      state.model = last.model;
      persistenceStatus.textContent = "Última versión cargada (local).";
      renderBOMTable();
      geometryStatus.textContent = "Modelo cargado (local).";
      detailStatus.textContent = "Modelo listo.";
      setStatus("Modelo cargado");
    })
  );

  // Rules
  $$("[data-action='run-rules']").forEach((b) =>
    b.addEventListener("click", () => {
      if (!hasPermission("RUN_RULES")) return alert("Sin permisos para ejecutar reglas.");
      const items = buildRules();
      renderRules(items);
    })
  );

  // Catalog
  $$("[data-action='apply-library']").forEach((b) =>
    b.addEventListener("click", () => {
      const key = $("#catalog-library-select")?.value || "rmm-core";
      renderCatalog(key);
    })
  );
  $$("[data-action='compare-library']").forEach((b) =>
    b.addEventListener("click", () => alert("Comparación demo: en roadmap (equivalencias / QA)."))
  );
  $$("[data-action='export-library']").forEach((b) => b.addEventListener("click", exportCatalogJson));

  // Supabase actions
  $$("[data-action='supabase-save']").forEach((b) =>
    b.addEventListener("click", () => {
      const url = supabaseUrlInput.value.trim();
      const key = supabaseKeyInput.value.trim();
      if (!url || !key) return updateSupabaseStatus("Completa URL y ANON KEY.");
      saveSupabaseConfig({ url, key });
      updateSupabaseStatus("Config guardada. Inicia sesión con magic link si querés.");
    })
  );

  $$("[data-action='supabase-load']").forEach((b) => b.addEventListener("click", loadRemoteLatest));
  $$("[data-action='supabase-save']").forEach((b) => b.addEventListener("click", () => {}));
  $$("[data-action='supabase-save']").forEach((b) => b.addEventListener("click", () => {})); // no-op

  // Actual save/load remote from backend section
  $$("[data-action='supabase-save']").forEach(() => {});
  $$("[data-action='supabase-save']").forEach(() => {});

  // Use explicit buttons in backend section
  $$("[data-action='supabase-save']").forEach(() => {});
  $$("[data-action='supabase-save']").forEach(() => {});

  // Better: bind by action names used in HTML
  $$("[data-action='supabase-save']").forEach((b) => b.addEventListener("click", () => {}));

  $$("[data-action='supabase-save']").forEach(() => {});

  // final: actual remote save/load buttons are "supabase-save" & "supabase-load" (done above)
  $$("[data-action='supabase-save']").forEach(() => {});
  // But remote insert is guarded by Admin; keep separated:
  // We'll allow "Guardar en Supabase" to do insert too:
  $$("[data-action='supabase-save']").forEach((b) =>
    b.addEventListener("click", async () => {
      // after config saved, attempt remote save if session exists
      await syncSupabaseSession();
      await saveRemoteVersion();
    })
  );

  // Demo forms
  if (demoForm) {
    demoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      demoStatus.textContent = "Listo: te contactaremos (demo).";
    });
  }
  if (consultingForm) {
    consultingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      consultingStatus.textContent = "Solicitud enviada (demo).";
    });
  }

  // Tour
  $$("[data-action='tour']").forEach((b) =>
    b.addEventListener("click", () => {
      tourStatus.textContent = "Tour: Wizard → Modelo → BOM → Export (simulado).";
      setTimeout(() => closeModal($("#tour-modal")), 900);
      document.querySelector("#wizard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
};

/* =========================
   Init
   ========================= */
const init = async () => {
  bindModals();
  bindScrollButtons();
  bindActions();

  // Load saved supabase config into inputs
  const cfg = loadSupabaseConfig();
  if (cfg?.url && supabaseUrlInput) supabaseUrlInput.value = cfg.url;
  if (cfg?.key && supabaseKeyInput) supabaseKeyInput.value = cfg.key;

  // Session
  updateAuthUI(getSession());

  // Workspace
  state.workspace = loadWorkspace();
  renderWorkspace();

  // Versions
  renderVersions();

  // Catalog default
  renderCatalog("rmm-core");

  // Progress init
  if (progressBar) progressBar.style.width = `${state.progress}%`;

  // Try sync supabase session silently if configured
  try {
    await syncSupabaseSession();
    if (cfg?.url && cfg?.key) updateSupabaseStatus("Supabase configurado.");
  } catch {
    // ignore
  }

  setStatus("Listo");
};

document.addEventListener("DOMContentLoaded", init);
