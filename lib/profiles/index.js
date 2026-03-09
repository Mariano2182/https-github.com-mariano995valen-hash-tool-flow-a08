// lib/profiles/index.js
import { CATALOG_EN } from "./catalog.en.js";
import { CATALOG_AR } from "./catalog.ar.js";

export const PROFILE_CATALOG = {
  ...CATALOG_EN,
  ...CATALOG_AR,
};

export function getProfileByKey(key) {
  return PROFILE_CATALOG[key] || null;
}

export function getAllProfiles() {
  return Object.values(PROFILE_CATALOG);
}

export function getProfilesByFamily(family) {
  return Object.values(PROFILE_CATALOG).filter((p) => p.family === family);
}

export function getProfilesByCountry(country) {
  return Object.values(PROFILE_CATALOG).filter((p) => p.country === country);
}

export function getProfileSpec(type, model = null) {
  const selected = model?.building?.profiles || {};

  if (type === "columna") {
    return PROFILE_CATALOG[selected.column] || PROFILE_CATALOG.HEB300;
  }

  if (type === "cabio" || type === "viga") {
    return PROFILE_CATALOG[selected.rafter] || PROFILE_CATALOG.IPE300;
  }

  if (type === "correas") {
    return PROFILE_CATALOG[selected.purlin] || PROFILE_CATALOG["Z200x70x15x3"];
  }

  if (type === "correas_columna") {
    return PROFILE_CATALOG[selected.girt] || PROFILE_CATALOG["C200x70x15x3"];
  }

  return PROFILE_CATALOG.IPE300;
}

export function getMassKgM(type, model = null) {
  const spec = getProfileSpec(type, model);
  return Number(spec?.mass_kg_m || 0);
}

// ---------------- Helpers geométricos ----------------
const V2 = (x, y) => ({ x, y });

export function profilePolygon(spec) {
  if (!spec?.family && !spec?.kind) throw new Error("profilePolygon: spec inválido");

  const kind = spec.family || spec.kind;
  const d = spec.dims || spec;

  if (kind === "I") return polyI(d);
  if (kind === "C") return polyC(d);
  if (kind === "Z") return polyZ(d);
  if (kind === "U") return polyC({ ...d, lip: 0 });
  if (kind === "TR" || kind === "TC") return polyTubeRect(d);

  throw new Error(`profilePolygon: family/kind no soportado: ${kind}`);
}

function polyI({ h, b, tw, tf }) {
  const hh = h / 2;
  const bb = b / 2;
  const tw2 = tw / 2;

  return [
    V2(-bb, -hh),
    V2(+bb, -hh),
    V2(+bb, -hh + tf),
    V2(+tw2, -hh + tf),
    V2(+tw2, +hh - tf),
    V2(+bb, +hh - tf),
    V2(+bb, +hh),
    V2(-bb, +hh),
    V2(-bb, +hh - tf),
    V2(-tw2, +hh - tf),
    V2(-tw2, -hh + tf),
    V2(-bb, -hh + tf),
  ];
}

function polyC({ h, b, t, lip = 0.0 }) {
  const hh = h / 2;
  const x0 = -b;
  const x1 = 0;
  const x3 = x0 + t;

  return [
    V2(x0, -hh),
    V2(x1, -hh),
    V2(x1, -hh + t),
    V2(x0 + lip, -hh + t),
    V2(x0 + lip, -hh + 2 * t),
    V2(x3, -hh + 2 * t),
    V2(x3, +hh - 2 * t),
    V2(x0 + lip, +hh - 2 * t),
    V2(x0 + lip, +hh - t),
    V2(x1, +hh - t),
    V2(x1, +hh),
    V2(x0, +hh),
  ];
}

function polyZ({ h, b, t, lip = 0.0 }) {
  const hh = h / 2;
  const bx = b;

  return [
    V2(-bx, -hh),
    V2(-t, -hh),
    V2(-t, -hh + t),
    V2(-bx + lip, -hh + t),
    V2(-bx + lip, -hh + 2 * t),
    V2(-bx + t, -hh + 2 * t),
    V2(-bx + t, +hh - 2 * t),
    V2(+bx - t, +hh - 2 * t),
    V2(+bx - lip, +hh - 2 * t),
    V2(+bx - lip, +hh - t),
    V2(+t, +hh - t),
    V2(+t, +hh),
    V2(+bx, +hh),
    V2(+bx, +hh - t),
    V2(+t, +hh - t),
    V2(+t, +hh - 2 * t),
    V2(+t, -hh + 2 * t),
    V2(-t, -hh + 2 * t),
    V2(-t, -hh),
  ];
}

function polyTubeRect({ h, b, t }) {
  const hh = h / 2;
  const bb = b / 2;
  const hi = Math.max(0.001, hh - t);
  const bi = Math.max(0.001, bb - t);

  // contorno exterior
  const outer = [
    V2(-bb, -hh),
    V2(+bb, -hh),
    V2(+bb, +hh),
    V2(-bb, +hh),
  ];

  // para Shape con hole esto se resuelve afuera si querés refinar;
  // por ahora devolvemos sólido macizo para no romper preview/IFC.
  return outer;
}
