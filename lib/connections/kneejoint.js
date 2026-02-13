// lib/connections/kneejoint.js
import { V, add, sub, mul, norm, makeFrame } from "./math.js";

function roofY({ roof, height, slope, halfSpan, span }, x) {
  if (roof === "plana") return height;
  if (roof === "una_agua") {
    const t = (x + halfSpan) / span;
    return height + t * (span * slope);
  }
  const t = Math.abs(x) / halfSpan;
  return height + (1 - t) * (halfSpan * slope);
}

export function buildKneeJoints(building, opts = {}) {
  const { span, length, height, frames, roof, slope } = building;

  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  // Defaults “Tekla-ish”
  const knee = {
    w: 0.30,   // ancho placa (eje X local)
    h: 0.22,   // alto placa (eje Y local)
    t: 0.012,  // espesor (normal)
    // separación para evitar z-fighting y “pegarla” a la columna
    offset: 0.02,

    bolt_d: 0.016,
    bolt_len: 0.10,

    // patrón típico: 2 columnas x 4 filas (mejor que 2x3 para “tekla feel”)
    pattern: [
      { u: -0.07, v: -0.09 },
      { u:  0.07, v: -0.09 },
      { u: -0.07, v: -0.03 },
      { u:  0.07, v: -0.03 },
      { u: -0.07, v:  0.03 },
      { u:  0.07, v:  0.03 },
      { u: -0.07, v:  0.09 },
      { u:  0.07, v:  0.09 },
    ],
  };

  const s = { ...knee, ...(opts.kneePlate || {}) };

  const feats = [];

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const eaveL = V(-halfSpan, height, z);
    const eaveR = V( halfSpan, height, z);

    // Dirección del cabio en ese pórtico (aprox, suficiente para preview)
    let rafDirL, rafDirR;

    if (roof === "plana") {
      rafDirL = V(1, 0, 0);
      rafDirR = V(-1, 0, 0);
    } else if (roof === "una_agua") {
      // cabio único topL->topR, pero en la unión izquierda/derecha lo usamos como dirección global
      rafDirL = norm(V(span, span * slope, 0));
      rafDirR = norm(V(-span, -span * slope, 0));
    } else {
      // dos aguas: eave -> ridge
      const ridge = V(0, height + halfSpan * slope, z);
      rafDirL = norm(sub(ridge, eaveL));
      rafDirR = norm(sub(ridge, eaveR));
    }

    // Normal hacia interior
    const nL = V(1, 0, 0);
    const nR = V(-1, 0, 0);

    // Frame placa: Z=normal, X=dir cabio (pero lo ortogonalizamos)
    const frameL = makeFrame(nL, rafDirL);
    const frameR = makeFrame(nR, rafDirR);

    // Origen: alero + offset hacia interior + leve subida (opcional)
    const originL = add(eaveL, mul(frameL.z, s.offset));
    const originR = add(eaveR, mul(frameR.z, s.offset));

    feats.push({
      kind: "PLATE",
      name: `KNEE-PLATE-L-${i + 1}`,
      origin: originL,
      axisX: frameL.x,
      axisY: frameL.y,
      axisZ: frameL.z,
      w: s.w,
      h: s.h,
      t: s.t,
      meta: { family: "KNEE_PLATE", side: "L" },
    });

    feats.push({
      kind: "BOLT_GROUP",
      name: `KNEE-BOLTS-L-${i + 1}`,
      origin: originL,
      axisX: frameL.x,
      axisY: frameL.y,
      axisZ: frameL.z,
      pattern: s.pattern,
      bolt_d: s.bolt_d,
      bolt_len: s.bolt_len,
      meta: { family: "KNEE_BOLTS", side: "L" },
    });

    feats.push({
      kind: "PLATE",
      name: `KNEE-PLATE-R-${i + 1}`,
      origin: originR,
      axisX: frameR.x,
      axisY: frameR.y,
      axisZ: frameR.z,
      w: s.w,
      h: s.h,
      t: s.t,
      meta: { family: "KNEE_PLATE", side: "R" },
    });

    feats.push({
      kind: "BOLT_GROUP",
      name: `KNEE-BOLTS-R-${i + 1}`,
      origin: originR,
      axisX: frameR.x,
      axisY: frameR.y,
      axisZ: frameR.z,
      pattern: s.pattern,
      bolt_d: s.bolt_d,
      bolt_len: s.bolt_len,
      meta: { family: "KNEE_BOLTS", side: "R" },
    });
  }

  return feats;
}
