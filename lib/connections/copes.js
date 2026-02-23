// lib/connections/copes.js
import { V, add, mul, norm } from "./math.js";

// ---------- helpers ----------
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// Convierte a metros si parece venir en mm
function toMeters(x) {
  if (typeof x !== "number") return 0;
  // heurística: si es > 10, probablemente está en mm
  return x > 10 ? x / 1000 : x;
}

// Intenta extraer dimensiones típicas de perfiles
// Espera algo tipo: { h, b, tw, tf } (en m o mm)
// Si tu getProfileSpec usa otros nombres, ajustá acá.
function profileDims(spec = {}) {
  const h  = toMeters(spec.h  ?? spec.H  ?? spec.depth ?? spec.height ?? 0.3);
  const b  = toMeters(spec.b  ?? spec.B  ?? spec.flange ?? spec.width  ?? 0.15);
  const tw = toMeters(spec.tw ?? spec.Tw ?? spec.web   ?? spec.webThickness ?? 0.006);
  const tf = toMeters(spec.tf ?? spec.Tf ?? spec.flangeThickness ?? 0.010);
  return { h, b, tw, tf };
}

// Base ortonormal: X along member, Z normal inward, Y ~ up
function basisFromXZNearingUp(dirX, normalZ) {
  const X = norm(dirX);
  const Z0 = norm(normalZ);
  const up = V(0, 1, 0);

  const dot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;
  const sub = (a, b) => V(a.x-b.x, a.y-b.y, a.z-b.z);

  let Y = up;
  Y = sub(Y, mul(X, dot(Y, X)));
  Y = sub(Y, mul(Z0, dot(Y, Z0)));

  const lenY = Math.hypot(Y.x, Y.y, Y.z);
  if (lenY < 1e-6) {
    // fallback cross(Z,X)
    Y = V(
      Z0.y * X.z - Z0.z * X.y,
      Z0.z * X.x - Z0.x * X.z,
      Z0.x * X.y - Z0.y * X.x
    );
  }
  Y = norm(Y);

  // Z = X x Y
  const Z = norm(V(
    X.y * Y.z - X.z * Y.y,
    X.z * Y.x - X.x * Y.z,
    X.x * Y.y - X.y * Y.x
  ));

  return { X, Y, Z };
}

// opts: { profiles: { rafter, column }, plate:{t}, cope:{clearance, seatLenFactor, ...} }
export function buildCopes(b, opts = {}) {
  const { span, length, height, frames, roof, slope } = b;
  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  // Perfiles
  const rSpec = opts?.profiles?.rafter || {};
  const cSpec = opts?.profiles?.column || {};
  const r = profileDims(rSpec);
  const c = profileDims(cSpec);

  // Placa (espesor)
  const plateT = toMeters(opts?.plate?.t ?? 0.012); // default 12mm

  // Parámetros de “estilo”
  const user = opts.cope || {};
  const clearance = toMeters(user.clearance ?? 0.006);

  // Derivados “Tekla-like”
  // - seatH ~ ala del cabio + holgura
  const seatH = clamp((r.tf * 1.15) + clearance, 0.010, 0.060);

  // - sideH: cortar bastante alma pero dejar margen de alas
  const webClearTopBot = (r.tf * 1.2) + clearance;
  const sideH = clamp((r.h - 2 * webClearTopBot) * 0.55, 0.08, r.h * 0.75);

  // - profundidad hacia la cara de unión (placa + ala columna + holgura)
  const seatIn = clamp(plateT + (c.tf * 1.05) + clearance * 2, 0.04, 0.30);
  const sideIn = clamp(seatIn * 0.65, 0.03, 0.22);

  // - largo sobre el miembro: proporcional al ancho de ala del cabio
  const seatLen = clamp(r.b * 0.85, 0.16, 0.35);
  const sideLen = seatLen;

  const feats = [];

  function rafDirAtFrame(z, side) {
    if (roof === "plana") {
      return side === "L" ? V(1, 0, 0) : V(-1, 0, 0);
    }
    if (roof === "una_agua") {
      return side === "L"
        ? norm(V(span, span * slope, 0))
        : norm(V(-span, -span * slope, 0));
    }
    const eave = side === "L" ? V(-halfSpan, height, z) : V(halfSpan, height, z);
    const ridge = V(0, height + halfSpan * slope, z);
    return norm(V(ridge.x - eave.x, ridge.y - eave.y, ridge.z - eave.z));
  }

  function targetNames(i) {
    const L =
      roof === "dos_aguas" ? `RAF-L-${i + 1}` :
      roof === "plana"    ? `BEAM-${i + 1}`  : `RAF-${i + 1}`;

    const R =
      roof === "dos_aguas" ? `RAF-R-${i + 1}` :
      roof === "plana"    ? `BEAM-${i + 1}`  : `RAF-${i + 1}`;

    return { L, R };
  }

  function pushCopeTekla(target, org, basis) {
    // 1) COPE asiento (abajo) - quita ala inferior local
    feats.push({
      kind: "CUT",
      cutType: "COPE_SEAT",
      target,
      origin: org,
      axisX: basis.X,
      axisY: basis.Y,
      axisZ: basis.Z,
      shape: "BOX",
      // Box dims: w->X, h->Y, d->Z
      w: seatLen,
      h: seatH,
      d: seatIn,
      // Avanzar medio largo en X, bajar medio alto en Y, entrar medio d en Z
      centerLocal: { x: seatLen * 0.5, y: -seatH * 0.5, z: seatIn * 0.5 }
    });

    // 2) COPE lateral (alma + holgura de placa/ala)
    // Subimos un poco para no “comernos” todo el asiento
    feats.push({
      kind: "CUT",
      cutType: "COPE_SIDE",
      target,
      origin: org,
      axisX: basis.X,
      axisY: basis.Y,
      axisZ: basis.Z,
      shape: "BOX",
      w: sideLen,
      h: sideH,
      d: sideIn,
      centerLocal: { x: sideLen * 0.5, y: sideH * 0.15, z: sideIn * 0.5 }
    });
  }

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const eaveL = V(-halfSpan, height, z);
    const eaveR = V( halfSpan, height, z);

    const dirL = rafDirAtFrame(z, "L");
    const dirR = rafDirAtFrame(z, "R");

    const nL = norm(V( 1, 0, 0));
    const nR = norm(V(-1, 0, 0));

    const orgL = add(eaveL, mul(dirL, clearance));
    const orgR = add(eaveR, mul(dirR, clearance));

    const basisL = basisFromXZNearingUp(dirL, nL);
    const basisR = basisFromXZNearingUp(dirR, nR);

    const { L: targetL, R: targetR } = targetNames(i);

    if (roof === "dos_aguas") {
      pushCopeTekla(targetL, orgL, basisL);
      pushCopeTekla(targetR, orgR, basisR);
    } else {
      // plana/una_agua: mismo target, pero igual generamos "L y R"
      pushCopeTekla(targetL, orgL, basisL);
      pushCopeTekla(targetR, orgR, basisR);
    }
  }

  return feats;
}
