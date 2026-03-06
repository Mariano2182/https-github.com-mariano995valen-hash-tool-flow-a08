// lib/profiles/index.js
import { CATALOG_EN, getProfileEntry, resolveProfile } from "./catalog.en.js";

// -------------------- API principal --------------------
export function getProfileSpec(typeOrKey, model = null) {
  // 1) si viene una key directa del catálogo
  const direct = getProfileEntry(typeOrKey) || resolveProfile(typeOrKey);
  if (direct) return normalizeCatalogEntry(direct);

  // 2) si viene un tipo lógico del modelo
  const profiles = model?.building?.profiles || {};

  if (typeOrKey === "columna") {
    return normalizeCatalogEntry(
      resolveProfile(profiles.column || "HEB300")
    );
  }

  if (typeOrKey === "cabio" || typeOrKey === "viga") {
    return normalizeCatalogEntry(
      resolveProfile(profiles.rafter || "IPE300")
    );
  }

  if (typeOrKey === "correas") {
    return normalizeCatalogEntry(
      resolveProfile(profiles.purlin || "Z200x70x15x3")
    );
  }

  if (typeOrKey === "correas_columna") {
    return normalizeCatalogEntry(
      resolveProfile(profiles.girt || "C200x70x15x3")
    );
  }

  // fallback general
  return normalizeCatalogEntry(resolveProfile("IPE300"));
}

export function getMassKgM(typeOrKey, model = null) {
  const spec = getProfileSpec(typeOrKey, model);
  return Number(spec?.mass_kg_m || 0);
}

function normalizeCatalogEntry(entry) {
  if (!entry) throw new Error("Perfil no encontrado en catálogo.");

  const d = entry.dims || {};

  if (entry.family === "I") {
    return {
      code: entry.key,
      kind: "I",
      h: d.h,
      b: d.b,
      tw: d.tw,
      tf: d.tf,
      r: d.r || 0,
      mass_kg_m: entry.mass_kg_m || 0,
      props: entry.props || {},
      meta: entry.meta || {},
    };
  }

  if (entry.family === "C") {
    return {
      code: entry.key,
      kind: "C",
      h: d.h,
      b: d.b,
      t: d.t,
      lip: d.lip || 0,
      r: d.r || 0,
      mass_kg_m: entry.mass_kg_m || 0,
      props: entry.props || {},
      meta: entry.meta || {},
    };
  }

  if (entry.family === "Z") {
    return {
      code: entry.key,
      kind: "Z",
      h: d.h,
      b: d.b,
      t: d.t,
      lip: d.lip || 0,
      r: d.r || 0,
      mass_kg_m: entry.mass_kg_m || 0,
      props: entry.props || {},
      meta: entry.meta || {},
    };
  }

  if (entry.family === "U") {
    // si más adelante querés dibujar UPN/UPE distinto, podés hacer polyU
    // por ahora lo dejamos como canal tipo C visualmente
    return {
      code: entry.key,
      kind: "C",
      h: d.h,
      b: d.b,
      t: d.tw,
      lip: 0,
      r: d.r || 0,
      mass_kg_m: entry.mass_kg_m || 0,
      props: entry.props || {},
      meta: entry.meta || {},
    };
  }

  throw new Error(`Familia de perfil no soportada: ${entry.family}`);
}

// -------------------- Helpers 2D --------------------
const V2 = (x, y) => ({ x, y });

// Polígono 2D para extrusión
export function profilePolygon(spec) {
  if (!spec?.kind) throw new Error("profilePolygon: spec inválido");

  if (spec.kind === "I") return polyI(spec);
  if (spec.kind === "C") return polyC(spec);
  if (spec.kind === "Z") return polyZ(spec);

  throw new Error(`profilePolygon: kind no soportado: ${spec.kind}`);
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
