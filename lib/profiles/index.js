// lib/profiles/index.js
// Unidades: METROS (m)
// Sistema 2D: X horizontal, Y vertical (sección). La extrusión va en Z (largo).

export const PROFILE_CATALOG = {
  // Ejemplos típicos (ajustables)
  IPE300: { code: "IPE300", kind: "I", h: 0.300, b: 0.150, tw: 0.0071, tf: 0.0107, r: 0.0 },
  HEB300: { code: "HEB300", kind: "I", h: 0.300, b: 0.300, tw: 0.0110, tf: 0.0190, r: 0.0 },

  C200:   { code: "C200",   kind: "C", h: 0.200, b: 0.075, t: 0.0032, lip: 0.018, r: 0.0 },
  Z200:   { code: "Z200",   kind: "Z", h: 0.200, b: 0.075, t: 0.0032, lip: 0.018, r: 0.0 },
};

// Mapeo simple por tipo de elemento del modelo
// (después lo refinamos a “según luz”, “según separación”, etc.)
export function getProfileSpec(type) {
  if (type === "columna") return PROFILE_CATALOG.HEB300;
  if (type === "cabio") return PROFILE_CATALOG.IPE300;
  if (type === "viga") return PROFILE_CATALOG.IPE300;
  if (type === "correas") return PROFILE_CATALOG.Z200;
  if (type === "correas_columna") return PROFILE_CATALOG.C200;
  return PROFILE_CATALOG.IPE300;
}

// Helpers
const V2 = (x, y) => ({ x, y });

// Polígono 2D (cerrado) para extruir.
// Importante: NO hace falta repetir el último punto igual al primero para THREE.Shape.
export function profilePolygon(spec) {
  if (!spec?.kind) throw new Error("profilePolygon: spec inválido");

  if (spec.kind === "I") return polyI(spec);
  if (spec.kind === "C") return polyC(spec);
  if (spec.kind === "Z") return polyZ(spec);

  throw new Error(`profilePolygon: kind no soportado: ${spec.kind}`);
}

/**
 * Perfil I (IPE/HEB) simplificado sin radios.
 * h: altura total, b: ala, tw: alma, tf: espesor ala
 * Centroide aproximado: centrado en (0,0)
 */
function polyI({ h, b, tw, tf }) {
  const hh = h / 2;
  const bb = b / 2;
  const tw2 = tw / 2;

  // Recorremos el contorno exterior + entrantes del alma (forma “I”)
  return [
    V2(-bb, -hh),
    V2(+bb, -hh),
    V2(+bb, -hh + tf),
    V2(+tw2, -hh + tf),
    V2(+tw2, +hh - tf),
    V2(+bb, +hh - tf),
    V2(+bb, +hh),
    V2(-bb, +hh),
    V2(-bb, +hh - tf),
    V2(-tw2, +hh - tf),
    V2(-tw2, -hh + tf),
    V2(-bb, -hh + tf),
  ];
}

/**
 * Perfil C (canal con labio) simplificado.
 * h: altura, b: ala, t: espesor, lip: pestaña/labio
 */
function polyC({ h, b, t, lip = 0.0 }) {
  const hh = h / 2;
  const x0 = -b;      // ala exterior izquierda (abrimos hacia +X)
  const x1 = 0;       // cara del alma
  const x2 = x1 + t;  // espesor alma hacia +X
  const x3 = x0 + t;  // espesor ala interior

  // Canal “abierto” hacia +X, con labio en extremos
  // Nota: esto es un contorno, no paredes. Sirve perfecto para extruir “sólido”.
  return [
    V2(x0, -hh),
    V2(x1, -hh),
    V2(x1, -hh + t),
    V2(x0 + lip, -hh + t),
    V2(x0 + lip, -hh + t + t), // pequeño escalón (opcional visual)
    V2(x3, -hh + t + t),
    V2(x3, +hh - t - t),
    V2(x0 + lip, +hh - t - t),
    V2(x0 + lip, +hh - t),
    V2(x1, +hh - t),
    V2(x1, +hh),
    V2(x0, +hh),
  ];
}

/**
 * Perfil Z simplificado (Zeta con labios).
 * h: altura, b: ala, t: espesor, lip: pestaña
 */
function polyZ({ h, b, t, lip = 0.0 }) {
  const hh = h / 2;

  // Z: ala superior hacia +X, ala inferior hacia -X
  // Centramos alrededor del (0,0) de la sección.
  const bx = b;

  return [
    // Arrancamos abajo ala inferior hacia -X
    V2(-bx, -hh),
    V2(-t, -hh),
    V2(-t, -hh + t),
    V2(-bx + lip, -hh + t),
    V2(-bx + lip, -hh + 2 * t),
    V2(-bx + t, -hh + 2 * t),

    // Subimos por el “alma” aproximada (en el centro)
    V2(-bx + t, +hh - 2 * t),
    V2(+bx - t, +hh - 2 * t),

    // Ala superior hacia +X
    V2(+bx - lip, +hh - 2 * t),
    V2(+bx - lip, +hh - t),
    V2(+t, +hh - t),
    V2(+t, +hh),
    V2(+bx, +hh),
    V2(+bx, +hh - t),
    V2(+t, +hh - t),
    V2(+t, +hh - 2 * t),

    // Cerramos hacia abajo por el lado opuesto (queda sólido)
    V2(+t, -hh + 2 * t),
    V2(-t, -hh + 2 * t),
    V2(-t, -hh),
  ];
}
