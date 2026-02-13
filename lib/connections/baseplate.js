// lib/connections/baseplate.js
import { V, add, mul, makeFrame } from "./math.js";

export function buildBasePlates({ span, length, frames }, opts = {}) {
  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  // Defaults “Tekla-ish” (ajustables)
  const basePlate = {
    w: 0.35, // ancho placa (X)
    h: 0.35, // alto placa (Y en plano)
    t: 0.025, // espesor (Z normal)
    grout: 0.00, // si querés levantarla del piso
    bolt_d: 0.016,
    bolt_len: 0.18,
    // patrón u/v en plano (u=axisX, v=axisY)
    // típico 4 pernos
    pattern: [
      { u: -0.12, v: -0.12 },
      { u:  0.12, v: -0.12 },
      { u: -0.12, v:  0.12 },
      { u:  0.12, v:  0.12 },
    ],
  };

  // override parcial
  const s = { ...basePlate, ...(opts.basePlate || {}) };

  const feats = [];

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const bases = [
      { name: `BASE-PLATE-L-${i + 1}`, at: V(-halfSpan, 0, z) },
      { name: `BASE-PLATE-R-${i + 1}`, at: V( halfSpan, 0, z) },
    ];

    for (const bp of bases) {
      // Placa horizontal: normal +Y (hacia arriba)
      const axisZ = V(0, 1, 0);
      const axisX = V(1, 0, 0); // alineada con +X

      const frame = makeFrame(axisZ, axisX);

      // centro placa: levantado medio espesor (+ grout opcional)
      const origin = add(bp.at, mul(frame.z, s.grout + s.t / 2));

      feats.push({
        kind: "PLATE",
        name: bp.name,
        origin,
        axisX: frame.x,
        axisY: frame.y,
        axisZ: frame.z,
        w: s.w,
        h: s.h,
        t: s.t,
        meta: { family: "BASE_PLATE", side: bp.name.includes("-L-") ? "L" : "R" },
      });

      feats.push({
        kind: "BOLT_GROUP",
        name: bp.name.replace("PLATE", "BOLTS"),
        origin,            // mismo origen de placa
        axisX: frame.x,
        axisY: frame.y,
        axisZ: frame.z,    // eje del bulón (atraviesa placa)
        pattern: s.pattern,
        bolt_d: s.bolt_d,
        bolt_len: s.bolt_len,
        meta: { family: "ANCHOR_BOLTS" },
      });
    }
  }

  return feats;
}
