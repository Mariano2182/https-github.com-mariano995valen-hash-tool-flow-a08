// lib/connections/math.js
// Math utilitario para ejes locales de uniones (estable y sin dependencia de script.js)

export const V = (x = 0, y = 0, z = 0) => ({ x, y, z });

export const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);

export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a, b) =>
  V(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );

export const len = (a) => Math.hypot(a.x, a.y, a.z);

export const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? V(a.x / l, a.y / l, a.z / l) : V(0, 0, 1);
};

// Ortonormaliza axisX respecto a axisZ (evita degenerados y “placas giradas raro”)
export function orthoX(axisZ, axisX) {
  const z = norm(axisZ);
  let x = axisX ? norm(axisX) : V(1, 0, 0);

  // quitar componente en Z
  const proj = dot(x, z);
  x = sub(x, mul(z, proj));

  // si quedó casi cero, elegimos un perpendicular
  if (len(x) < 1e-8) {
    const ref = Math.abs(z.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
    x = cross(ref, z);
  }
  return norm(x);
}

// Helper cubierta (misma lógica que tu modelo)
export function roofY({ roof, height, halfSpan, span, slope }, x) {
  if (roof === "plana") return height;
  if (roof === "una_agua") {
    const t = (x + halfSpan) / span;
    return height + t * (span * slope);
  }
  // dos_aguas
  const t = Math.abs(x) / halfSpan;
  return height + (1 - t) * (halfSpan * slope);
}
