/* RMM STRUCTURES - MVP avanzado (Offline + 3D configurador + BOM + costo + export) */

const state = {
  session: null,
  permissions: [],
  config: {
    roofType: "2aguas",
    span: 24,
    length: 40,
    colH: 4.5,
    roofH: 2.0,
    frames: 8,
    steel: "S275",
  },
  bom: [],
  supabase: {
    client: null,
    url: "",
    anonKey: "",
  },
  ui: {
    gridOn: true,
  },
};

/* -------------------------
  Helpers
------------------------- */
const $ = (sel) => document.querySelector(sel);
const fmt = (n, d = 0) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: d });

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* -------------------------
  Demo Roles (offline)
------------------------- */
const ROLE_PERMS = {
  Cliente: ["ver_modelo", "ver_bom", "export_csv"],
  Ingeniero: ["ver_modelo", "ver_bom", "export_csv", "ver_reglas", "editar_parametros"],
  Fabricador: ["ver_modelo", "ver_bom", "export_csv", "ver_reglas", "export_dstv_demo"],
  Admin: ["*"],
};

function setSession(email, role) {
  state.session = { email, role };
  state.permissions = ROLE_PERMS[role] || [];
  $("#auth-status").textContent = `Sesión activa: ${email} (${role})`;
  renderPermissions();
}

function clearSession() {
  state.session = null;
  state.permissions = [];
  $("#auth-status").textContent = "Sin sesión activa.";
  renderPermissions();
}

function hasPerm(p) {
  if (state.permissions.includes("*")) return true;
  return state.permissions.includes(p);
}

function renderPermissions() {
  const ul = $("#auth-permissions");
  ul.innerHTML = "";
  if (!state.session) {
    ul.innerHTML = `<li>Iniciá sesión demo para ver permisos.</li>`;
    return;
  }
  const perms = state.permissions.includes("*") ? ["Acceso total"] : state.permissions;
  perms.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `✓ ${p}`;
    ul.appendChild(li);
  });
}

/* -------------------------
  Modal
------------------------- */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add("active");
  m.setAttribute("aria-hidden", "false");
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("active");
  m.setAttribute("aria-hidden", "true");
}

/* -------------------------
  Configurador BOM (estimación)
  Nota: es un modelo demo para vender el flujo (no cálculo real).
------------------------- */
function buildBOM(cfg) {
  // Suposición simple de pórtico tipo marco:
  // - 2 columnas por pórtico
  // - 2 vigas inclinadas (o 1 viga si 1 agua)
  // - correas longitudinales: aproximación por líneas
  const frames = cfg.frames;
  const span = cfg.span;
  const len = cfg.length;
  const colH = cfg.colH;
  const roofH = cfg.roofH;

  // Aproximación: longitud por viga inclinada
  const halfSpan = span / 2;
  const beamLen = Math.sqrt(halfSpan * halfSpan + roofH * roofH);

  // Conteos
  const colQty = frames * 2;
  const beamQty = cfg.roofType === "2aguas" ? frames * 2 : frames * 1;

  // Correas (purlins): cada 1.5m en techo, a lo largo de la nave
  const purlinLines = Math.max(2, Math.round(beamLen / 1.5));
  const purlinQty = purlinLines * (cfg.roofType === "2aguas" ? 2 : 1); // por faldón
  const purlinEachLen = len; // a lo largo de la nave

  // Longitudes totales
  const colTotalLen = colQty * colH;
  const beamTotalLen = beamQty * beamLen;
  const purlinTotalLen = purlinQty * purlinEachLen;

  // Pesos aproximados kg/m (demo)
  const steelFactor = cfg.steel === "S355" ? 1.02 : 1.0;
  const kgm_column = 42 * steelFactor; // demo
  const kgm_beam = 57 * steelFactor;   // demo
  const kgm_purlin = 18 * steelFactor; // demo

  const items = [
    { name: "Columnas", qty: colQty, lenEach: colH, totalLen: colTotalLen, kgm: kgm_column },
    { name: "Vigas techo", qty: beamQty, lenEach: beamLen, totalLen: beamTotalLen, kgm: kgm_beam },
    { name: "Correas", qty: purlinQty, lenEach: purlinEachLen, totalLen: purlinTotalLen, kgm: kgm_purlin },
  ];

  items.forEach((it) => {
    it.weightKg = it.totalLen * it.kgm;
  });

  const totalWeight = items.reduce((a, b) => a + b.weightKg, 0);

  return { items, totalWeight };
}

function renderBOM(bom) {
  const tbody = $("#elementsTable");
  tbody.innerHTML = "";

  bom.items.forEach((it) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.name}</td>
      <td>${fmt(it.qty)}</td>
      <td>${fmt(it.totalLen, 1)} m</td>
      <td>${fmt(it.weightKg, 0)} kg</td>
    `;
    tbody.appendChild(tr);
  });

  $("#kpiFrames").textContent = fmt(state.config.frames);
  $("#kpiLen").textContent = `${fmt(state.config.length)} m`;
  $("#kpiWeight").textContent = `${fmt(bom.totalWeight, 0)} kg`;
}

/* -------------------------
  Export BOM CSV
------------------------- */
function exportCSV(bom) {
  const rows = [
    ["Elemento", "Cantidad", "Longitud_total_m", "Peso_kg"].join(","),
    ...bom.items.map((it) => [it.name, it.qty, it.totalLen.toFixed(2), it.weightKg.toFixed(0)].join(",")),
    ["TOTAL", "", "", bom.totalWeight.toFixed(0)].join(","),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `RMM_BOM_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------
  Costeo
------------------------- */
function calcCostUSD(bom, priceKg, coefFab, coefMont) {
  const mat = bom.totalWeight * priceKg;
  const fab = mat * coefFab;
  const mont = mat * coefMont;
  return { mat, fab, mont, total: mat + fab + mont };
}

/* -------------------------
  Reglas demo
------------------------- */
function runRules(cfg, bom) {
  const out = [];

  // R1
  out.push({
    id: "R1",
    title: "Rangos mínimos",
    status: cfg.span >= 10 && cfg.length >= 20 ? "OK" : "ERROR",
    detail: `Luz=${cfg.span} (>=10), Longitud=${cfg.length} (>=20)`,
  });

  // R2
  const spacing = cfg.length / Math.max(1, cfg.frames - 1);
  out.push({
    id: "R2",
    title: "Separación entre pórticos (demo)",
    status: spacing >= 3 && spacing <= 8 ? "OK" : "WARNING",
    detail: `Separación ≈ ${fmt(spacing, 2)} m (recomendado 3–8 m).`,
  });

  // R3
  out.push({
    id: "R3",
    title: "Peso estimado",
    status: bom.totalWeight > 0 ? "OK" : "ERROR",
    detail: `Peso total ≈ ${fmt(bom.totalWeight, 0)} kg.`,
  });

  return out;
}

function renderRules(rules) {
  const list = $("#rulesList");
  list.innerHTML = "";
  rules.forEach((r) => {
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.style.justifyContent = "space-between";
    btn.style.width = "100%";
    btn.innerHTML = `<span>${r.id} — ${r.title}</span><strong>${r.status}</strong>`;
    btn.addEventListener("click", () => {
      $("#rulesDetail").textContent = `${r.id} — ${r.title}\nEstado: ${r.status}\n\n${r.detail}`;
    });
    list.appendChild(btn);
  });

  const summary = rules.map((r) => r.status);
  const hasErr = summary.includes("ERROR");
  const hasWarn = summary.includes("WARNING");
  $("#rulesSummary").textContent = hasErr ? "Hay errores." : hasWarn ? "Hay advertencias." : "Todo OK.";
}

/* -------------------------
  Three.js (visor 3D)
------------------------- */
let renderer, scene, camera, controls;
let modelGroup;
let gridHelper;

function init3D() {
  const canvas = $("#scene");

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);

  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(40, 22, 55);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const amb = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(amb);

  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(40, 80, 20);
  scene.add(dir);

  gridHelper = new THREE.GridHelper(200, 50, 0x334155, 0x1f2937);
  scene.add(gridHelper);

  modelGroup = new THREE.Group();
  scene.add(modelGroup);

  resize3D();
  rebuild3D(state.config);

  window.addEventListener("resize", () => {
    resize3D();
  });

  animate();
}

function resize3D() {
  const wrap = $(".canvas-wrap");
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function clearGroup(g) {
  while (g.children.length) {
    const c = g.children.pop();
    c.geometry?.dispose?.();
    c.material?.dispose?.();
  }
}

function rebuild3D(cfg) {
  clearGroup(modelGroup);

  // Materiales
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, metalness: 0.2, roughness: 0.45 });
  const matCols  = new THREE.MeshStandardMaterial({ color: 0xa78bfa, metalness: 0.2, roughness: 0.45 });
  const matBase  = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.0, roughness: 0.9 });

  const span = cfg.span;
  const length = cfg.length;
  const colH = cfg.colH;
  const roofH = cfg.roofH;
  const frames = cfg.frames;

  const halfSpan = span / 2;
  const spacing = length / Math.max(1, frames - 1);

  // Escala visual
  const th = 0.12; // espesor visual

  // Bases (simple)
  const baseGeo = new THREE.BoxGeometry(0.9, 0.4, 0.9);

  // Columnas
  const colGeo = new THREE.BoxGeometry(th, colH, th);

  // Vigas
  const beamLen = Math.sqrt(halfSpan * halfSpan + roofH * roofH);
  const beamGeo = new THREE.BoxGeometry(beamLen, th, th);

  for (let i = 0; i < frames; i++) {
    const z = -length / 2 + i * spacing;

    // bases
    const b1 = new THREE.Mesh(baseGeo, matBase);
    b1.position.set(-halfSpan, 0.2, z);
    modelGroup.add(b1);

    const b2 = new THREE.Mesh(baseGeo, matBase);
    b2.position.set(halfSpan, 0.2, z);
    modelGroup.add(b2);

    // columnas
    const c1 = new THREE.Mesh(colGeo, matCols);
    c1.position.set(-halfSpan, colH / 2, z);
    modelGroup.add(c1);

    const c2 = new THREE.Mesh(colGeo, matCols);
    c2.position.set(halfSpan, colH / 2, z);
    modelGroup.add(c2);

    // techo
    if (cfg.roofType === "2aguas") {
      // viga izquierda
      const bl = new THREE.Mesh(beamGeo, matFrame);
      bl.position.set(-halfSpan / 2, colH + roofH / 2, z);
      bl.rotation.z = Math.atan2(roofH, halfSpan);
      modelGroup.add(bl);

      // viga derecha
      const br = new THREE.Mesh(beamGeo, matFrame);
      br.position.set(halfSpan / 2, colH + roofH / 2, z);
      br.rotation.z = -Math.atan2(roofH, halfSpan);
      modelGroup.add(br);
    } else {
      // una agua: una viga desde -halfSpan a +halfSpan con pendiente
      const fullLen = Math.sqrt(span * span + roofH * roofH);
      const bg = new THREE.BoxGeometry(fullLen, th, th);
      const b = new THREE.Mesh(bg, matFrame);
      b.position.set(0, colH + roofH / 2, z);
      b.rotation.z = -Math.atan2(roofH, span);
      modelGroup.add(b);
    }
  }

  $("#cfgStatus").textContent = `Modelo generado. Separación aprox: ${fmt(spacing, 2)} m`;
}

/* -------------------------
  Persistencia local (versiones)
------------------------- */
function localKey() {
  return "rmm_versions_v1";
}

function loadLocalVersions() {
  try {
    return JSON.parse(localStorage.getItem(localKey()) || "[]");
  } catch {
    return [];
  }
}

function saveLocalVersions(list) {
  localStorage.setItem(localKey(), JSON.stringify(list));
}

function renderLocalVersions() {
  const list = loadLocalVersions();
  const box = $("#localVersions");
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<div class="version-item"><strong>Sin versiones</strong><small>Guardá una versión local.</small></div>`;
    return;
  }
  list.slice().reverse().slice(0, 8).forEach((v) => {
    const div = document.createElement("div");
    div.className = "version-item";
    div.innerHTML = `<strong>${v.name}</strong><small>${new Date(v.ts).toLocaleString("es-AR")}</small>`;
    div.addEventListener("click", () => {
      state.config = { ...v.config };
      syncControlsFromState();
      recomputeAll(true);
      $("#localStatus").textContent = `Cargada versión: ${v.name}`;
    });
    box.appendChild(div);
  });
}

function localSave() {
  const list = loadLocalVersions();
  const name = `Nave ${state.config.span}x${state.config.length} (${state.config.frames} pórticos)`;
  list.push({ ts: Date.now(), name, config: { ...state.config } });
  saveLocalVersions(list);
  renderLocalVersions();
  $("#localStatus").textContent = "Versión guardada (local).";
}

function localLoadLast() {
  const list = loadLocalVersions();
  const last = list[list.length - 1];
  if (!last) {
    $("#localStatus").textContent = "No hay versiones.";
    return;
  }
  state.config = { ...last.config };
  syncControlsFromState();
  recomputeAll(true);
  $("#localStatus").textContent = `Cargada última versión: ${last.name}`;
}

/* -------------------------
  Supabase (opcional)
------------------------- */
function sbConnect() {
  const url = ($("#sbUrl").value || "").trim();
  const key = ($("#sbKey").value || "").trim();

  if (!url || !key) {
    $("#sbStatus").textContent = "Completá URL y ANON KEY.";
    return;
  }

  try {
    state.supabase.client = window.supabase.createClient(url, key);
    state.supabase.url = url;
    state.supabase.anonKey = key;
    $("#sbStatus").textContent = "Conectado (cliente creado).";
  } catch (e) {
    $("#sbStatus").textContent = "Error conectando Supabase.";
  }
}

// Nota: guardar/cargar real requiere sesión auth.uid() válida.
// Esto queda como “hook” para la etapa B.
async function sbSave() {
  if (!state.supabase.client) return ($("#sbStatus").textContent = "Conectá Supabase primero.");
  $("#sbStatus").textContent = "Para guardar real necesitás login Supabase (etapa B).";
}
async function sbLoad() {
  if (!state.supabase.client) return ($("#sbStatus").textContent = "Conectá Supabase primero.");
  $("#sbStatus").textContent = "Para cargar real necesitás login Supabase (etapa B).";
}

/* -------------------------
  UI bindings
------------------------- */
function syncOutputs() {
  $("#spanOut").textContent = state.config.span;
  $("#lengthOut").textContent = state.config.length;
  $("#colHOut").textContent = state.config.colH;
  $("#roofHOut").textContent = state.config.roofH;
  $("#framesOut").textContent = state.config.frames;
}

function syncControlsFromState() {
  $("#roofType").value = state.config.roofType;
  $("#span").value = state.config.span;
  $("#length").value = state.config.length;
  $("#colH").value = state.config.colH;
  $("#roofH").value = state.config.roofH;
  $("#frames").value = state.config.frames;
  $("#steel").value = state.config.steel;
  syncOutputs();
}

function recomputeAll(rebuild3d = false) {
  syncOutputs();

  const bom = buildBOM(state.config);
  state.bom = bom;

  renderBOM(bom);
  if (rebuild3d) rebuild3D(state.config);
}

function bindConfigurator() {
  // inputs
  $("#roofType").addEventListener("change", (e) => { state.config.roofType = e.target.value; recomputeAll(true); });
  $("#span").addEventListener("input", (e) => { state.config.span = Number(e.target.value); recomputeAll(true); });
  $("#length").addEventListener("input", (e) => { state.config.length = Number(e.target.value); recomputeAll(true); });
  $("#colH").addEventListener("input", (e) => { state.config.colH = Number(e.target.value); recomputeAll(true); });
  $("#roofH").addEventListener("input", (e) => { state.config.roofH = Number(e.target.value); recomputeAll(true); });
  $("#frames").addEventListener("input", (e) => { state.config.frames = Number(e.target.value); recomputeAll(true); });
  $("#steel").addEventListener("change", (e) => { state.config.steel = e.target.value; recomputeAll(false); });

  // actions
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");

    if (action === "scroll") {
      const target = btn.getAttribute("data-target");
      document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
    }

    if (action === "open-demo") openModal("demo-modal");
    if (action === "close-modal") closeModal("demo-modal");

    if (action === "rebuild") recomputeAll(true);
    if (action === "export-bom") exportCSV(state.bom);

    if (action === "calc-cost") {
      const priceKg = Number($("#priceKg").value);
      const coefFab = Number($("#coefFab").value);
      const coefMont = Number($("#coefMont").value);

      const c = calcCostUSD(state.bom, priceKg, coefFab, coefMont);
      $("#costBox").innerHTML = `
        <div class="kpi"><span>Material</span><strong>USD ${fmt(c.mat, 0)}</strong></div>
        <div class="kpi"><span>Fabricación</span><strong>USD ${fmt(c.fab, 0)}</strong></div>
        <div class="kpi"><span>Montaje</span><strong>USD ${fmt(c.mont, 0)}</strong></div>
        <hr style="border:none;border-top:1px solid rgba(15,23,42,0.12);margin:10px 0;">
        <div class="kpi"><span>Total</span><strong>USD ${fmt(c.total, 0)}</strong></div>
      `;
    }

    if (action === "run-rules") {
      const rules = runRules(state.config, state.bom);
      renderRules(rules);
    }

    if (action === "reset-camera") {
      camera.position.set(40, 22, 55);
      controls.target.set(0, 6, 0);
      controls.update();
    }

    if (action === "toggle-grid") {
      state.ui.gridOn = !state.ui.gridOn;
      gridHelper.visible = state.ui.gridOn;
    }

    if (action === "local-save") localSave();
    if (action === "local-load") localLoadLast();

    if (action === "sb-connect") sbConnect();
    if (action === "sb-save") sbSave();
    if (action === "sb-load") sbLoad();

    if (action === "logout") clearSession();
    if (action === "magic-link") {
      $("#auth-supabase-status").textContent = "Magic link requiere configurar Supabase y auth real (etapa B).";
    }
  });

  // auth demo submit
  $("#auth-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#auth-email").value.trim();
    const role = $("#auth-role").value;
    if (!email) return;
    setSession(email, role);
  });

  // demo form
  $("#demo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    $("#demo-status").textContent = "Enviado (demo). Te vamos a contactar.";
    setTimeout(() => closeModal("demo-modal"), 800);
  });
}

/* -------------------------
  Animation loop
------------------------- */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/* -------------------------
  Init
------------------------- */
function init() {
  // initial UI
  syncControlsFromState();
  renderPermissions();

  // initial compute
  recomputeAll(false);
  renderLocalVersions();

  // bind
  bindConfigurator();

  // 3D
  init3D();
  recomputeAll(true);
}

document.addEventListener("DOMContentLoaded", init);
