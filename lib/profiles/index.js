import { CATALOG_EN } from "./catalog.en.js";
import { CATALOG_ASTM } from "./catalog.astm.js";
import { CATALOG_AR } from "./catalog.ar.js";
import { normalizeKey } from "./normalize.js";
import { shape2DFromProfile } from "./shapes.js";
import { derivePropsIfMissing } from "./props.js";

const CATALOGS = [CATALOG_AR, CATALOG_EN, CATALOG_ASTM];

// Busca por key normalizada en todos los catálogos
export function getProfile(profileKeyOrType) {
  const key = normalizeKey(profileKeyOrType);

  for (const cat of CATALOGS) {
    if (cat[key]) return cat[key];
  }

  // fallback: default por tipo “columna/cabio/correas…”
  const fallbackKey = defaultKeyForElementType(profileKeyOrType);
  const fb = normalizeKey(fallbackKey);

  for (const cat of CATALOGS) {
    if (cat[fb]) return cat[fb];
  }

  // última salida: algo mínimo para no romper
  return {
    key: "RECT_120x60x4",
    family: "RECT",
    standard: "RMM_FALLBACK",
    country: "AR",
    dims: { h: 0.12, b: 0.06, t: 0.004 },
    mass_kg_m: 10,
    props: { A: 0.0005, Ix: 1e-6, Iy: 4e-7, Wx: 1e-5, Wy: 7e-6, rx: 0.04, ry: 0.02 },
    meta: { supplier: "RMM", notes: "Fallback" },
  };
}

export function getShape2D(profileKeyOrType) {
  const p = getProfile(profileKeyOrType);
  return shape2DFromProfile(p);
}

export function getProps(profileKeyOrType) {
  const p = getProfile(profileKeyOrType);
  return derivePropsIfMissing(p);
}

function defaultKeyForElementType(type) {
  // Podés afinarlo después (por ejemplo: columnas HEA vs HEB según altura)
  if (type === "columna") return "HEB300";
  if (type === "viga") return "IPE300";
  if (type === "cabio") return "IPE300";
  if (type === "correas") return "Z200";
  if (type === "correas_columna") return "C200";
  return "IPE300";
}
