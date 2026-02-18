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

/**
 * Base ortonormal (X,Y,Z) a partir de:
 * - Z (normal / dirección principal)
 * - X preferido
 */
export function orthoBasisFromZX(axisZ, axisXPreferred) {
  const Z = norm(axisZ);

  let Xp = axisXPreferred ? norm(axisXPreferred) : V(1, 0, 0);
  if (Math.abs(dot(Xp, Z)) > 0.98) {
    Xp = Math.abs(Z.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  }

  const proj = dot(Xp, Z);
  let X = sub(Xp, mul(Z, proj));
  const lx = len(X);
  if (lx < 1e-10) {
    const ref = Math.abs(Z.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
    X = cross(ref, Z);
  }
  X = norm(X);

  let Y = cross(Z, X);
  Y = norm(Y);

  X = norm(cross(Y, Z));
  return { X, Y, Z };
}
