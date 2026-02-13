// lib/profiles/props.js
// Helpers de props (por ahora mínimos). Más adelante cargás tablas reales (Ix, Iy, etc.)

export function massKgPerM(entry) {
  const v = Number(entry?.mass_kg_m);
  return Number.isFinite(v) ? v : 0;
}

export function dims(entry) {
  return entry?.dims || {};
}
