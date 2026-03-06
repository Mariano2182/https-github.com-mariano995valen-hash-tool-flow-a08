// lib/profiles/catalog.en.js
// Catálogo EN (EN 10365 + afines) — dimensiones en metros (m)
// Nota: props Ix/Iy/Wx/Wy/rx/ry se dejan en 0 por ahora (podés completarlas luego con tablas).
// Este archivo está armado para ser "completo" por series sin volverse inmanejable.
// Fuente recomendada para dims+masa: catálogos tipo Orange Book / EN 10365 (tablas). :contentReference[oaicite:1]{index=1}

/**
 * @typedef {Object} ProfileDimsI
 * @property {number} h
 * @property {number} b
 * @property {number} tw
 * @property {number} tf
 * @property {number} r
 *
 * @typedef {Object} ProfileDimsU
 * @property {number} h
 * @property {number} b
 * @property {number} tw
 * @property {number} tf
 * @property {number} r
 *
 * @typedef {Object} ProfileDimsC
 * @property {number} h
 * @property {number} b
 * @property {number} t
 * @property {number} [lip]
 *
 * @typedef {Object} ProfileEntry
 * @property {string} key
 * @property {"I"|"U"|"L"|"T"|"RHS"|"SHS"|"CHS"|"C"|"Z"} family
 * @property {string} standard
 * @property {string} country
 * @property {Object} dims
 * @property {number} mass_kg_m
 * @property {Object} props
 * @property {Object} meta
 */

// --------------------------- Helpers ---------------------------
const zerosProps = () => ({ A: 0, Ix: 0, Iy: 0, Wx: 0, Wy: 0, rx: 0, ry: 0 });

function assertNum(name, v) {
  if (!Number.isFinite(v)) throw new Error(`CATALOG_EN: ${name} inválido: ${v}`);
}
function assertDimsI(key, d) {
  ["h", "b", "tw", "tf", "r"].forEach((k) => assertNum(`${key}.dims.${k}`, d[k]));
}
function assertDimsU(key, d) {
  ["h", "b", "tw", "tf", "r"].forEach((k) => assertNum(`${key}.dims.${k}`, d[k]));
}
function assertDimsC(key, d) {
  ["h", "b", "t"].forEach((k) => assertNum(`${key}.dims.${k}`, d[k]));
  if (d.lip != null) assertNum(`${key}.dims.lip`, d.lip);
}

function entryI(key, dims, mass_kg_m, meta = {}) {
  assertDimsI(key, dims);
  assertNum(`${key}.mass_kg_m`, mass_kg_m);
  return /** @type {ProfileEntry} */ ({
    key,
    family: "I",
    standard: "EN 10365",
    country: "EN",
    dims,
    mass_kg_m,
    props: { ...zerosProps(), A: meta.A ?? 0 },
    meta: { supplier: meta.supplier || "EN", notes: meta.notes || "" },
  });
}

function entryU(key, dims, mass_kg_m, meta = {}) {
  assertDimsU(key, dims);
  assertNum(`${key}.mass_kg_m`, mass_kg_m);
  return /** @type {ProfileEntry} */ ({
    key,
    family: "U",
    standard: "EN 10365",
    country: "EN",
    dims,
    mass_kg_m,
    props: { ...zerosProps(), A: meta.A ?? 0 },
    meta: { supplier: meta.supplier || "EN", notes: meta.notes || "" },
  });
}

function entryColdFormed(key, family, dims, mass_kg_m = 0, meta = {}) {
  // Para C/Z conformados (AR típico). Masa/props pueden venir de proveedor local.
  assertDimsC(key, dims);
  if (mass_kg_m != null) assertNum(`${key}.mass_kg_m`, mass_kg_m);
  return /** @type {ProfileEntry} */ ({
    key,
    family,
    standard: meta.standard || "Conformado",
    country: meta.country || "AR",
    dims,
    mass_kg_m: mass_kg_m || 0,
    props: { ...zerosProps(), A: meta.A ?? 0 },
    meta: { supplier: meta.supplier || "AR", notes: meta.notes || "" },
  });
}

// --------------------------- Series builders ---------------------------
// Para no escribir miles de entradas a mano, declaramos tablas compactas.
// Cada fila: [size, h_mm, b_mm, tw_mm, tf_mm, r_mm, mass_kg_m]
function buildIPE_EN10365() {
  // Tabla compacta IPE (series estándar). Datos típicos de catálogo EN 10365.
  // Si querés que sea 100% “tabulado oficial”, lo ideal es autogenerarla desde un catálogo (Orange Book). :contentReference[oaicite:2]{index=2}
  const rows = [
    [80, 80, 46, 3.8, 5.2, 5, 6.0],
    [100, 100, 55, 4.1, 5.7, 7, 8.1],
    [120, 120, 64, 4.4, 6.3, 7, 10.4],
    [140, 140, 73, 4.7, 6.9, 7, 12.9],
    [160, 160, 82, 5.0, 7.4, 9, 15.8],
    [180, 180, 91, 5.3, 8.0, 9, 18.8],
    [200, 200, 100, 5.6, 8.5, 12, 22.4],
    [220, 220, 110, 5.9, 9.2, 12, 26.2],
    [240, 240, 120, 6.2, 9.8, 15, 30.7],
    [270, 270, 135, 6.6, 10.2, 15, 36.1],
    [300, 300, 150, 7.1, 10.7, 15, 42.2], // coincide con tu ejemplo
    [330, 330, 160, 7.5, 11.5, 18, 49.1],
    [360, 360, 170, 8.0, 12.7, 18, 57.1],
    [400, 400, 180, 8.6, 13.5, 21, 66.3],
    [450, 450, 190, 9.4, 14.6, 21, 77.6],
    [500, 500, 200, 10.2, 16.0, 21, 90.7],
    [550, 550, 210, 11.1, 17.2, 24, 106.0],
    [600, 600, 220, 12.0, 19.0, 24, 122.0],
  ];

  /** @type {Record<string, ProfileEntry>} */
  const out = {};
  for (const [sz, h, b, tw, tf, r, m] of rows) {
    const key = `IPE${sz}`;
    out[key] = entryI(
      key,
      { h: h / 1000, b: b / 1000, tw: tw / 1000, tf: tf / 1000, r: r / 1000 },
      m,
      { supplier: "EN", notes: "Serie IPE EN 10365 (tabla compacta)" }
    );
  }
  return out;
}

function buildHE_EN10365() {
  // HEA/HEB/HEM son muchísimos tamaños. Dejo estructura lista,
  // y cargo algunos “clásicos” para que el software funcione ya.
  // Luego lo completamos con autogeneración desde catálogo.
  const out = {};

  // Ejemplos de arranque (podés sumar toda la serie):
  out["HEA200"] = entryI(
    "HEA200",
    { h: 0.190, b: 0.200, tw: 0.0065, tf: 0.0100, r: 0.018 },
    42.3,
    { supplier: "EN", notes: "HEA (arranque). Completar serie completa luego." }
  );

  out["HEB200"] = entryI(
    "HEB200",
    { h: 0.200, b: 0.200, tw: 0.0090, tf: 0.0150, r: 0.018 },
    61.3,
    { supplier: "EN", notes: "HEB (arranque). Completar serie completa luego." }
  );

  out["HEM200"] = entryI(
    "HEM200",
    { h: 0.220, b: 0.206, tw: 0.0120, tf: 0.0200, r: 0.018 },
    106.0,
    { supplier: "EN", notes: "HEM (arranque). Completar serie completa luego." }
  );

  return out;
}

function buildUPN_EN10365() {
  // Igual: arrancamos con algunos UPN típicos + estructura para completar.
  const out = {};
  out["UPN100"] = entryU(
    "UPN100",
    { h: 0.100, b: 0.050, tw: 0.0045, tf: 0.0075, r: 0.009 },
    10.6,
    { supplier: "EN", notes: "UPN (arranque). Completar serie completa luego." }
  );
  out["UPN160"] = entryU(
    "UPN160",
    { h: 0.160, b: 0.064, tw: 0.0060, tf: 0.0095, r: 0.011 },
    18.8,
    { supplier: "EN", notes: "UPN (arranque). Completar serie completa luego." }
  );
  out["UPN200"] = entryU(
    "UPN200",
    { h: 0.200, b: 0.075, tw: 0.0075, tf: 0.0115, r: 0.013 },
    25.3,
    { supplier: "EN", notes: "UPN (arranque). Completar serie completa luego." }
  );
  return out;
}

function buildColdFormedAR() {
  // C/Z típicos para correas/largueros (AR). Completás masa según proveedor.
  const out = {};
  out["C100x50x15x3"] = entryColdFormed(
    "C100x50x15x3",
    "C",
    { h: 0.100, b: 0.050, t: 0.003, lip: 0.015 },
    0,
    { supplier: "AR", notes: "Ejemplo AR. Cargar masa/props reales del proveedor." }
  );
  out["C200x70x15x3"] = entryColdFormed(
    "C200x70x15x3",
    "C",
    { h: 0.200, b: 0.070, t: 0.003, lip: 0.015 },
    0,
    { supplier: "AR", notes: "Ejemplo AR. Cargar masa/props reales del proveedor." }
  );
  out["Z200x70x15x3"] = entryColdFormed(
    "Z200x70x15x3",
    "Z",
    { h: 0.200, b: 0.070, t: 0.003, lip: 0.015 },
    0,
    { supplier: "AR", notes: "Ejemplo AR. Cargar masa/props reales del proveedor." }
  );
  return out;
}

// --------------------------- Build catalog ---------------------------
export const CATALOG_EN = {
  ...buildIPE_EN10365(),
  ...buildHE_EN10365(),
  ...buildUPN_EN10365(),
  ...buildColdFormedAR(),
};

// --------------------------- Utilities used by your app ---------------------------
export function hasProfile(key) {
  return Boolean(CATALOG_EN[key]);
}

export function getProfileEntry(key) {
  return CATALOG_EN[key] || null;
}

/**
 * Devuelve un perfil existente o un fallback (ej: si pedís IPE305 -> IPE300)
 */
export function resolveProfile(key) {
  if (CATALOG_EN[key]) return CATALOG_EN[key];

  // fallback por familia+tamaño aproximado (IPE/HE/UPN)
  const m = String(key).match(/^([A-Z]+)(\d+)/);
  if (!m) return null;

  const fam = m[1];
  const sz = Number(m[2]);

  const candidates = Object.keys(CATALOG_EN)
    .filter((k) => k.startsWith(fam) && /\d+/.test(k))
    .map((k) => ({ k, n: Number((k.match(/\d+/) || ["0"])[0]) }))
    .filter((o) => Number.isFinite(o.n));

  if (!candidates.length) return null;

  candidates.sort((a, b) => Math.abs(a.n - sz) - Math.abs(b.n - sz));
  return CATALOG_EN[candidates[0].k] || null;
}
