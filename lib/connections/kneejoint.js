// lib/connections/kneejoint.js
import { V, add, sub, mul, norm, orthoX } from "./math.js";

export function buildKneeJoints(b, opts = {}) {
  if (!b) return [];
  const { span, length, height, frames, roof, slope } = b;

  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  // “Tekla argentino” demo: placa rodilla 260x200x12 con 6 bulones M16
  const spec = {
    w: opts.knee_w ?? 0.26,
    h: opts.knee_h ?? 0.20,
    t: opts.knee_t ?? 0.012,
    bolt_d: opts.knee_bolt_d ?? 0.016,
    bolt_len: opts.knee_bolt_len ?? 0.070,
    pattern:
      opts.knee_pattern ??
      [
        { x: -0.06, y: -0.06 },
        { x: 0.06, y: -0.06 },
        { x: -0.06, y: 0.0 },
        { x: 0.06, y: 0.0 },
        { x: -0.06, y: 0.06 },
        { x: 0.06, y: 0.06 },
      ],
  };

  const feats = [];

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const eaveL = V(-halfSpan, height, z);
    const eaveR = V(halfSpan, height, z);

    // Dirección de cabio para orientar la placa (como Tekla: la placa sigue la línea del cabio)
    let rafDirL, rafDirR;

    if (roof === "plana") {
      rafDirL = V(1, 0, 0);
      rafDirR = V(-1, 0, 0);
    } else if (roof === "una_agua") {
      rafDirL = norm(V(span, span * slope, 0));
      rafDirR = norm(V(-span, -span * slope, 0));
    } else {
      const ridge = V(0, height + halfSpan * slope, z);
      rafDirL = norm(sub(ridge, eaveL));
      rafDirR = norm(sub(ridge, eaveR));
    }

    // Normal hacia interior: L -> +X, R -> -X
    const nL = V(1, 0, 0);
    const nR = V(-1, 0, 0);

    const off = opts.knee_off ?? 0.025;

    // L
    {
      const axisZ = nL; // espesor sale hacia interior
      const axisX = orthoX(axisZ, rafDirL);
      const org = add(eaveL, mul(nL, off));

      feats.push({
        kind: "PLATE",
        name: `KNEE-PLATE-L-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        w: spec.w,
        h: spec.h,
        t: spec.t,
        meta: { type: "KNEE_PLATE", side: "L", frame: i + 1 },
      });

      feats.push({
        kind: "BOLT_GROUP",
        name: `KNEE-BOLTS-L-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        pattern: spec.pattern,
        bolt_d: spec.bolt_d,
        bolt_len: spec.bolt_len,
        meta: { type: "KNEE_BOLTS", side: "L", frame: i + 1 },
      });

      // Rigidizador de rodilla (simple, visual)
      if (opts.knee_stiffeners ?? true) {
        feats.push({
          kind: "PLATE",
          name: `KNEE-STIFF-L-${i + 1}`,
          origin: add(org, mul(axisZ, 0.008)),
          axisZ,
          axisX: orthoX(axisZ, V(0, 1, 0)),
          w: opts.knee_stiff_w ?? 0.18,
          h: opts.knee_stiff_h ?? 0.14,
          t: opts.knee_stiff_t ?? 0.010,
          meta: { type: "KNEE_STIFFENER", side: "L", frame: i + 1 },
        });
      }
    }

    // R
    {
      const axisZ = nR;
      const axisX = orthoX(axisZ, rafDirR);
      const org = add(eaveR, mul(nR, off));

      feats.push({
        kind: "PLATE",
        name: `KNEE-PLATE-R-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        w: spec.w,
        h: spec.h,
        t: spec.t,
        meta: { type: "KNEE_PLATE", side: "R", frame: i + 1 },
      });

      feats.push({
        kind: "BOLT_GROUP",
        name: `KNEE-BOLTS-R-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        pattern: spec.pattern,
        bolt_d: spec.bolt_d,
        bolt_len: spec.bolt_len,
        meta: { type: "KNEE_BOLTS", side: "R", frame: i + 1 },
      });

      if (opts.knee_stiffeners ?? true) {
        feats.push({
          kind: "PLATE",
          name: `KNEE-STIFF-R-${i + 1}`,
          origin: add(org, mul(axisZ, 0.008)),
          axisZ,
          axisX: orthoX(axisZ, V(0, 1, 0)),
          w: opts.knee_stiff_w ?? 0.18,
          h: opts.knee_stiff_h ?? 0.14,
          t: opts.knee_stiff_t ?? 0.010,
          meta: { type: "KNEE_STIFFENER", side: "R", frame: i + 1 },
        });
      }
    }
  }

  return feats;
}
