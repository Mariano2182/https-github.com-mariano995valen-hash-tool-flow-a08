// lib/profiles/catalog.en.js
// Dimensiones en metros (m). Props incompletas: podés cargar Ix/Iy/Wx/Wy reales después.
export const CATALOG_EN = {
  IPE300: {
    key: "IPE300",
    family: "I",
    standard: "EN 10365",
    country: "EN",
    dims: { h: 0.300, b: 0.150, tw: 0.0071, tf: 0.0107, r: 0.015 },
    mass_kg_m: 42.2,
    props: { A: 0.00538, Ix: 0, Iy: 0, Wx: 0, Wy: 0, rx: 0, ry: 0 },
    meta: { supplier: "EN", notes: "Completar props tabuladas" },
  },

  HEB300: {
    key: "HEB300",
    family: "I",
    standard: "EN 10365",
    country: "EN",
    dims: { h: 0.300, b: 0.300, tw: 0.011, tf: 0.019, r: 0.027 },
    mass_kg_m: 117.0,
    props: { A: 0.0149, Ix: 0, Iy: 0, Wx: 0, Wy: 0, rx: 0, ry: 0 },
    meta: { supplier: "EN", notes: "Completar props tabuladas" },
  },

  // Secundarias (ejemplo tipo Z/C con labios simples)
  C200: {
    key: "C200",
    family: "C",
    standard: "Conformado",
    country: "AR",
    dims: { h: 0.200, b: 0.070, t: 0.003, lip: 0.015 },
    mass_kg_m: 0, // completar
    props: { A: 0, Ix: 0, Iy: 0, Wx: 0, Wy: 0, rx: 0, ry: 0 },
    meta: { supplier: "AR", notes: "Ejemplo: completar masas/props reales" },
  },

  Z200: {
    key: "Z200",
    family: "Z",
    standard: "Conformado",
    country: "AR",
    dims: { h: 0.200, b: 0.070, t: 0.003, lip: 0.015 },
    mass_kg_m: 0,
    props: { A: 0, Ix: 0, Iy: 0, Wx: 0, Wy: 0, rx: 0, ry: 0 },
    meta: { supplier: "AR", notes: "Ejemplo: completar masas/props reales" },
  },
};
