// lib/connections/baseplate.js
import { V, add, mul, orthoBasisFromZX } from "./math.js";

export function buildBasePlates(b, opts = {}) {
  if (!b) return [];
  const { span, length, frames } = b;

  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  // demo “tekla argentino”: 300x300x20 + 4 anclajes M16
  const spec = {
    w: opts.base_w ?? 0.30,
    h: opts.base_h ?? 0.30,
    t: opts.base_t ?? 0.020,
    bolt_d: opts.base_bolt_d ?? 0.016,
    bolt_len: opts.base_bolt_len ?? 0.080,
    pattern:
      opts.base_pattern ??
      [
        { x: -0.10, y: -0.10 },
        { x: 0.10, y: -0.10 },
        { x: -0.10, y: 0.10 },
        { x: 0.10, y: 0.10 },
      ],
  };

  const feats = [];
  const axisZ = V(0, 1, 0); // vertical
  const { X: axisX } = orthoBasisFromZX(axisZ, V(1, 0, 0)); // X global preferido

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const bases = [
      { side: "L", at: V(-halfSpan, 0, z) },
      { side: "R", at: V(halfSpan, 0, z) },
    ];

    for (const bp of bases) {
      const plateName = `BASE-PLATE-${bp.side}-${i + 1}`;
      const boltsName = `BASE-BOLTS-${bp.side}-${i + 1}`;

      const org = add(bp.at, V(0, spec.t / 2, 0)); // centro placa

      feats.push({
        kind: "PLATE",
        name: plateName,
        origin: org,
        axisZ,
        axisX,
        w: spec.w,
        h: spec.h,
        t: spec.t,
        meta: { type: "BASEPLATE", side: bp.side, frame: i + 1 },
      });

      feats.push({
        kind: "BOLT_GROUP",
        name: boltsName,
        origin: org,
        axisZ,
        axisX,
        pattern: spec.pattern,
        bolt_d: spec.bolt_d,
        bolt_len: spec.bolt_len,
        meta: { type: "ANCHOR_BOLTS", side: bp.side, frame: i + 1 },
      });

      // stiffeners visual (opcional)
      if (opts.base_stiffeners ?? true) {
        const stiff = {
          w: opts.base_stiff_w ?? 0.18,
          h: opts.base_stiff_h ?? 0.16,
          t: opts.base_stiff_t ?? 0.010,
        };

        const n = bp.side === "L" ? V(1, 0, 0) : V(-1, 0, 0); // hacia interior
        const { X: xLocal } = orthoBasisFromZX(n, V(0, 1, 0)); // preferimos “subir”
        const off = 0.01;

        feats.push({
          kind: "PLATE",
          name: `BASE-STIFF-${bp.side}-${i + 1}-A`,
          origin: add(org, mul(n, off)),
          axisZ: n,
          axisX: xLocal,
          w: stiff.w,
          h: stiff.h,
          t: stiff.t,
          meta: { type: "BASE_STIFFENER", side: bp.side, frame: i + 1 },
        });

        feats.push({
          kind: "PLATE",
          name: `BASE-STIFF-${bp.side}-${i + 1}-B`,
          origin: add(org, mul(n, off)),
          axisZ: n,
          axisX: xLocal,
          w: stiff.w,
          h: stiff.h,
          t: stiff.t,
          meta: { type: "BASE_STIFFENER", side: bp.side, frame: i + 1 },
        });
      }
    }
  }

  return feats;
}
