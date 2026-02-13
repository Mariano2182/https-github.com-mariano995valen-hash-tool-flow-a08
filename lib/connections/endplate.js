// lib/connections/endplate.js
import { V, add, mul, orthoX } from "./math.js";

// Endplate “tipo Tekla”: en cumbrera (dos aguas) o en extremos (plana/una_agua)
export function buildEndPlates(b, opts = {}) {
  if (!b) return [];
  const { span, length, height, frames, roof, slope } = b;

  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  const spec = {
    w: opts.end_w ?? 0.22,
    h: opts.end_h ?? 0.18,
    t: opts.end_t ?? 0.012,
    bolt_d: opts.end_bolt_d ?? 0.016,
    bolt_len: opts.end_bolt_len ?? 0.070,
    pattern:
      opts.end_pattern ??
      [
        { x: -0.05, y: -0.05 },
        { x: 0.05, y: -0.05 },
        { x: -0.05, y: 0.05 },
        { x: 0.05, y: 0.05 },
      ],
  };

  const feats = [];

  // Placa perpendicular al pórtico (espesor en Z global) -> “placa de unión” en el plano del frame
  const axisZ = V(0, 0, 1);
  const axisX = orthoX(axisZ, V(1, 0, 0));
  const off = opts.end_off ?? 0.0;

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    if (roof === "dos_aguas") {
      // Cumbrera: punto (0, height + halfSpan*slope, z)
      const ridge = V(0, height + halfSpan * slope, z);
      const org = add(ridge, mul(axisZ, off));

      feats.push({
        kind: "PLATE",
        name: `RIDGE-PLATE-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        w: spec.w,
        h: spec.h,
        t: spec.t,
        meta: { type: "RIDGE_PLATE", frame: i + 1 },
      });

      feats.push({
        kind: "BOLT_GROUP",
        name: `RIDGE-BOLTS-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        pattern: spec.pattern,
        bolt_d: spec.bolt_d,
        bolt_len: spec.bolt_len,
        meta: { type: "RIDGE_BOLTS", frame: i + 1 },
      });
    } else if (roof === "plana") {
      // Viga: extremos en x=±halfSpan, y=height
      const left = V(-halfSpan, height, z);
      const right = V(halfSpan, height, z);

      for (const p of [
        { key: "L", at: left },
        { key: "R", at: right },
      ]) {
        const org = add(p.at, mul(axisZ, off));

        feats.push({
          kind: "PLATE",
          name: `BEAM-END-PLATE-${p.key}-${i + 1}`,
          origin: org,
          axisZ,
          axisX,
          w: spec.w,
          h: spec.h,
          t: spec.t,
          meta: { type: "BEAM_ENDPLATE", side: p.key, frame: i + 1 },
        });

        feats.push({
          kind: "BOLT_GROUP",
          name: `BEAM-END-BOLTS-${p.key}-${i + 1}`,
          origin: org,
          axisZ,
          axisX,
          pattern: spec.pattern,
          bolt_d: spec.bolt_d,
          bolt_len: spec.bolt_len,
          meta: { type: "BEAM_END_BOLTS", side: p.key, frame: i + 1 },
        });
      }
    } else {
      // una_agua: unión en “apoyo alto” (derecha)
      const right = V(halfSpan, height + span * slope, z);
      const org = add(right, mul(axisZ, off));

      feats.push({
        kind: "PLATE",
        name: `RAF-END-PLATE-R-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        w: spec.w,
        h: spec.h,
        t: spec.t,
        meta: { type: "RAF_ENDPLATE", side: "R", frame: i + 1 },
      });

      feats.push({
        kind: "BOLT_GROUP",
        name: `RAF-END-BOLTS-R-${i + 1}`,
        origin: org,
        axisZ,
        axisX,
        pattern: spec.pattern,
        bolt_d: spec.bolt_d,
        bolt_len: spec.bolt_len,
        meta: { type: "RAF_END_BOLTS", side: "R", frame: i + 1 },
      });
    }
  }

  return feats;
}
