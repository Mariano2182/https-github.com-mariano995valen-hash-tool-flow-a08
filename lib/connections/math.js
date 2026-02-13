// lib/connections/math.js
export const V = (x = 0, y = 0, z = 0) => ({ x, y, z });

export const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a, b) =>
  V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export const len = (a) => Math.hypot(a.x, a.y, a.z);

export const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? V(a.x / l, a.y / l, a.z / l) : V(0, 0, 1);
};

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function makeFrame(axisZ, axisX) {
  const z = norm(axisZ);
  // axisX debe ser perpendicular a Z; si no, lo “limpiamos”
  let x = sub(axisX, mul(z, dot(axisX, z)));
  x = norm(x);
  // si quedó degenerado, elijo un eje cualquiera
  if (len(x) < 1e-8) {
    x = Math.abs(z.y) < 0.9 ? norm(cross(V(0, 1, 0), z)) : norm(cross(V(1, 0, 0), z));
  }
  const y = norm(cross(z, x));
  return { x, y, z };
}

export function ptOnFrame(origin, frame, u = 0, v = 0, w = 0) {
  // origin + u*X + v*Y + w*Z
  return add(origin, add(add(mul(frame.x, u), mul(frame.y, v)), mul(frame.z, w)));
}
