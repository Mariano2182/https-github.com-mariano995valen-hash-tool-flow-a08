// lib/connections/copes.js
// Copes estilo Tekla: seat + web cope, dimensionados por perfil real.

import { V, add, mul, norm, orthoBasisFromZX } from "./math.js";

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// Lee dims reales según tu PROFILE_CATALOG
function dimsFromSpec(spec = {}) {
  const kind = spec.kind;

  if (kind === "I") {
    return {
      kind,
      h: spec.h,
      b: spec.b,
      tw: spec.tw,
      tf: spec.tf,
      // “espesor equivalente” para reglas genéricas
      t: Math.max(spec.tw, spec.tf),
    };
  }

  if (kind === "C" || kind === "Z") {
    return {
      kind,
      h: spec.h,
      b: spec.b,
      t: spec.t,
      lip: spec.lip || 0,
      // aproximaciones útiles
      tw: spec.t,
      tf: spec.t,
    };
  }

  // fallback
  return {
    kind: kind || "I",
    h: spec.h ?? 0.3,
    b: spec.b ?? 0.15,
    tw: spec.tw ?? spec.t ?? 0.006,
    tf: spec.tf ?? spec.t ?? 0.010,
    t: spec.t ?? Math.max(spec.tw ?? 0.006, spec.tf ?? 0.010),
    lip: spec.lip || 0,
  };
}

// Para que el box de corte quede “hacia interior”
function inwardNormal(side) {
  return side === "L" ? norm(V(1, 0, 0)) : norm(V(-1, 0, 0));
}

// Dirección del cabio según techo
function rafterDirAtFrame({ roof, span, slope, halfSpan, height, z }, side) {
  if (roof === "plana") {
    return side === "L" ? V(1, 0, 0) : V(-1, 0, 0);
  }
  if (roof === "una_agua") {
    // cabio único de izquierda a derecha
    return side === "L" ? norm(V(span, span * slope, 0)) : norm(V(-span, -span * slope, 0));
  }
  // dos aguas
  const eave = side === "L" ? V(-halfSpan, height, z) : V(halfSpan, height, z);
  const ridge = V(0, height + halfSpan * slope, z);
  return norm(V(ridge.x - eave.x, ridge.y - eave.y, ridge.z - eave.z));
}

// Nombres target: deben coincidir EXACTO con memberName en addMember(...)
function targetName({ roof }, i, side) {
  if (roof === "dos_aguas") return side === "L" ? `RAF-L-${i + 1}` : `RAF-R-${i + 1}`;
  if (roof === "plana") return `BEAM-${i + 1}`;
  return `RAF-${i + 1}`; // una_agua
}

// Crea 2 cortes: asiento (ala inferior) + cope del alma
function pushTeklaLikeCopes(feats, { target, origin, basis, rafterDims, colDims, plateT, clearance }) {
  // --- Reglas Tekla-like basadas en perfil ---
  // Seat (muerde ala inferior)
  const seatH = clamp(rafterDims.tf * 1.25 + clearance, 0.010, 0.060); // alto corte (Y)
  const seatW = clamp(rafterDims.b * 0.90, 0.12, 0.45);                // ancho en sección (X del miembro)
  const seatD = clamp(plateT + colDims.tf * 1.10 + clearance * 2, 0.035, 0.28); // profundidad hacia interior (Z del corte)

  // Web cope (muerde el alma) – menos alto que todo el perfil
  const webHAvail = Math.max(0.06, rafterDims.h - 2 * (rafterDims.tf + clearance));
  const webH = clamp(webHAvail * 0.55, 0.08, rafterDims.h * 0.75);
  const webW = seatW;
  const webD = clamp(seatD * 0.70, 0.025, 0.20);

  // --- CUT 1: SEAT ---
  feats.push({
    kind: "CUT",
    cutType: "COPE_SEAT",
    target,
    origin,
    axisX: basis.X,
    axisY: basis.Y,
    axisZ: basis.Z,
    shape: "BOX",
    w: seatW,
    h: seatH,
    d: seatD,
    // Avanza sobre el cabio, baja para comer ala inferior, entra hacia columna
    centerLocal: { x: seatW * 0.5, y: -seatH * 0.55, z: seatD * 0.5 },
  });

  // --- CUT 2: WEB COPE ---
  feats.push({
    kind: "CUT",
    cutType: "COPE_WEB",
    target,
    origin,
    axisX: basis.X,
    axisY: basis.Y,
    axisZ: basis.Z,
    shape: "BOX",
    w: webW,
    h: webH,
    d: webD,
    // Subimos un poco para que el asiento quede “limpio”
    centerLocal: { x: webW * 0.5, y: webH * 0.10, z: webD * 0.5 },
  });
}

// opts: { profiles:{rafter,column}, plate:{t}, cope:{clearance} }
export function buildCopes(b, opts = {}) {
  const { span, length, height, frames, roof, slope } = b;
  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  const plateT = opts?.plate?.t ?? 0.012;
  const clearance = opts?.cope?.clearance ?? 0.006;

  const rafterSpec = opts?.profiles?.rafter || {};
  const colSpec = opts?.profiles?.column || {};

  const rafterDims = dimsFromSpec(rafterSpec);
  const colDims = dimsFromSpec(colSpec);

  const feats = [];

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const eaveL = V(-halfSpan, height, z);
    const eaveR = V( halfSpan, height, z);

    const dirL = rafterDirAtFrame({ roof, span, slope, halfSpan, height, z }, "L");
    const dirR = rafterDirAtFrame({ roof, span, slope, halfSpan, height, z }, "R");

    const nL = inwardNormal("L");
    const nR = inwardNormal("R");

    // Origen del cope: “un poquito adentro” para que no quede a ras
    const orgL = add(eaveL, mul(dirL, clearance));
    const orgR = add(eaveR, mul(dirR, clearance));

    // Base: X = dirección miembro, Z = normal hacia interior
    const basisL = orthoBasisFromZX(nL, dirL);
    const basisR = orthoBasisFromZX(nR, dirR);

    const tL = targetName({ roof }, i, "L");
    const tR = targetName({ roof }, i, "R");

    if (roof === "dos_aguas") {
      pushTeklaLikeCopes(feats, {
        target: tL,
        origin: orgL,
        basis: basisL,
        rafterDims,
        colDims,
        plateT,
        clearance,
      });

      pushTeklaLikeCopes(feats, {
        target: tR,
        origin: orgR,
        basis: basisR,
        rafterDims,
        colDims,
        plateT,
        clearance,
      });
    } else {
      // plana / una_agua -> mismo target, hacemos dos extremos iguales
      pushTeklaLikeCopes(feats, {
        target: tL,
        origin: orgL,
        basis: basisL,
        rafterDims,
        colDims,
        plateT,
        clearance,
      });

      pushTeklaLikeCopes(feats, {
        target: tR,
        origin: orgR,
        basis: basisR,
        rafterDims,
        colDims,
        plateT,
        clearance,
      });
    }
  }

  return feats;
}
