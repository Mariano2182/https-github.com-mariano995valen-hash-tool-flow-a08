// lib/connections/copes.js
// Genera cortes tipo "cope/notch" estilo Tekla (volúmenes a sustraer)
// Se apoya en ejes locales: axisZ = normal principal, axisX = referencia en el plano

import { V, add, mul, norm, orthoBasisFromZX } from "./math.js";

// opts: { cope: { depth, width, height, clearance } }
export function buildCopes(b, opts = {}) {
  const { span, length, height, frames, roof, slope } = b;
  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  const cope = {
    depth: 0.18,     // cuánto "muerde" en el miembro (m)
    width: 0.22,     // ancho del vaciado (m)
    height: 0.16,    // alto del vaciado (m)
    clearance: 0.006,// holgura de taller (m)
    ...((opts.cope) || {}),
  };

  const feats = [];

  // dirección del cabio por lado (para orientar cope)
  function rafDirAtFrame(z, side) {
    if (roof === "plana") {
      return side === "L" ? V(1, 0, 0) : V(-1, 0, 0);
    }
    if (roof === "una_agua") {
      return side === "L" ? norm(V(span, span * slope, 0)) : norm(V(-span, -span * slope, 0));
    }
    // dos aguas
    const eave = side === "L" ? V(-halfSpan, height, z) : V(halfSpan, height, z);
    const ridge = V(0, height + halfSpan * slope, z);
    return norm({ x: ridge.x - eave.x, y: ridge.y - eave.y, z: ridge.z - eave.z });
  }

  // cope de rodilla: cortar el extremo del cabio en la unión con la columna
  // targets: RAF-L-i y RAF-R-i (o BEAM/RAF según tu naming actual)
  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const eaveL = V(-halfSpan, height, z);
    const eaveR = V( halfSpan, height, z);

    const dirL = rafDirAtFrame(z, "L");
    const dirR = rafDirAtFrame(z, "R");

    // normal hacia interior
    const nL = norm(V( 1, 0, 0));
    const nR = norm(V(-1, 0, 0));

    // donde “arranca” el cope (un pelín adentro y con holgura)
    const orgL = add(eaveL, mul(dirL, cope.clearance));
    const orgR = add(eaveR, mul(dirR, cope.clearance));

    // Base ortonormal del volumen a sustraer:
    // axisZ = normal del corte hacia interior (para meter el vaciado dentro del cabio)
    // axisX = dirección del cabio (para alinear el cope con el miembro)
    const basisL = orthoBasisFromZX(nL, dirL);
    const basisR = orthoBasisFromZX(nR, dirR);

    // Target names: ajustalos a tu naming real
    // En tu modelo: dos aguas usa RAF-L-i y RAF-R-i; plana usa BEAM-i; una_agua usa RAF-i
    const targetL = (roof === "dos_aguas") ? `RAF-L-${i + 1}` : (roof === "plana") ? `BEAM-${i + 1}` : `RAF-${i + 1}`;
    const targetR = (roof === "dos_aguas") ? `RAF-R-${i + 1}` : (roof === "plana") ? `BEAM-${i + 1}` : `RAF-${i + 1}`;

    // Para dos aguas: cope en cada lado
    if (roof === "dos_aguas") {
      feats.push({
        kind: "CUT",
        cutType: "COPE_KNEE",
        target: targetL,
        origin: orgL,
        axisX: basisL.X,
        axisY: basisL.Y,
        axisZ: basisL.Z,
        // volumen a sustraer (Box)
        shape: "BOX",
        w: cope.width,
        h: cope.height,
        d: cope.depth,
        // offset local opcional (centro del box en el eje del miembro)
        centerLocal: { x: cope.depth * 0.5, y: 0, z: 0 },
      });

      feats.push({
        kind: "CUT",
        cutType: "COPE_KNEE",
        target: targetR,
        origin: orgR,
        axisX: basisR.X,
        axisY: basisR.Y,
        axisZ: basisR.Z,
        shape: "BOX",
        w: cope.width,
        h: cope.height,
        d: cope.depth,
        centerLocal: { x: cope.depth * 0.5, y: 0, z: 0 },
      });
    }

    // Para plana / una_agua (un solo beam/raf): aplicá cope en ambos extremos
    if (roof !== "dos_aguas") {
      feats.push({
        kind: "CUT",
        cutType: "COPE_END_L",
        target: targetL,
        origin: orgL,
        axisX: basisL.X,
        axisY: basisL.Y,
        axisZ: basisL.Z,
        shape: "BOX",
        w: cope.width,
        h: cope.height,
        d: cope.depth,
        centerLocal: { x: cope.depth * 0.5, y: 0, z: 0 },
      });

      feats.push({
        kind: "CUT",
        cutType: "COPE_END_R",
        target: targetR,
        origin: orgR,
        axisX: basisR.X,
        axisY: basisR.Y,
        axisZ: basisR.Z,
        shape: "BOX",
        w: cope.width,
        h: cope.height,
        d: cope.depth,
        centerLocal: { x: cope.depth * 0.5, y: 0, z: 0 },
      });
    }
  }

  return feats;
}
