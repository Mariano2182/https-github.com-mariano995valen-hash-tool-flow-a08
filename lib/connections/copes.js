// lib/connections/copes.js
import { V, sub, norm, orthoBasisFromZX, add } from "./math.js";

export function buildCopesFromBuilding(b, opts = {}) {
  if (!b) return [];

  const { span, length, height, frames, roof, slope } = b;

  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  // Parámetros típicos de cope (ajustables)
  const copeDepth = opts.cope_depth ?? 0.18; // cuánto entra el corte en el cabio (m)
  const copeW = opts.cope_w ?? 0.22;         // ancho del corte (m)
  const copeH = opts.cope_h ?? 0.18;         // alto del corte (m)

  const feats = [];

  // helper para crear CUT box apuntando al eje del miembro
  function addCut({ target, origin, axisZ, axisX }) {
    const basis = orthoBasisFromZX(axisZ, axisX);
    feats.push({
      kind: "CUT",
      name: `CUT-${target}-${feats.length + 1}`,
      target,            // <- nombre exacto del mesh
      shape: "BOX",
      origin,            // punto “base” (mundo)
      axisX: basis.X,
      axisY: basis.Y,
      axisZ: basis.Z,
      // dimensiones del box (m)
      w: copeW,
      h: copeH,
      d: copeDepth,
      // centro local respecto a origin en ejes X/Y/Z
      // Lo empujamos hacia adentro del cabio: -Z * (copeDepth*0.5)
      centerLocal: { x: 0, y: -copeH * 0.35, z: -copeDepth * 0.5 },
      meta: { type: "COPE_EAVE" },
    });
  }

  // Sólo aplicamos en dos aguas (por ahora), porque el “tekla style” típico arranca ahí
  if (roof !== "dos_aguas") return feats;

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    // Puntos del pórtico (dos aguas)
    const eaveL = V(-halfSpan, height, z);
    const eaveR = V(halfSpan, height, z);
    const ridge = V(0, height + halfSpan * slope, z);

    // Direcciones de cabios (eave -> ridge) y (ridge -> eave)
    const dirL = norm(sub(ridge, eaveL)); // cabio izquierdo
    const dirR = norm(sub(eaveR, ridge)); // cabio derecho (de ridge a eave)

    // ✅ Coping en rodilla: al inicio del cabio (zona del alero)
    // target debe coincidir con el nombre del miembro en el preview:
    const targetL = `RAF-L-${i + 1}`;
    const targetR = `RAF-R-${i + 1}`;

    // Para que “corte” en el extremo correcto:
    // - en RAF-L extruimos eave->ridge, así que el extremo del alero es el START (eaveL)
    // - en RAF-R extruimos ridge->eave, el extremo del alero es el END (eaveR)
    // Como nuestro boolean box está en mundo, lo ubicamos en el punto del alero
    // y alineamos axisZ en la dirección “hacia adentro del cabio”.
    addCut({
      target: targetL,
      origin: add(eaveL, V(0, 0.00, 0)), // leve offset si querés
      axisZ: dirL,                       // hacia la cumbrera
      axisX: V(1, 0, 0),                 // preferencia global
    });

    // Para el derecho, queremos axisZ apuntando desde eave hacia ridge también
    // pero el miembro lo construimos ridge->eave; igual funciona porque es CSG global,
    // lo importante es orientar el box “hacia adentro” del extremo.
    const dirR_in = norm(sub(ridge, eaveR)); // eaveR -> ridge
    addCut({
      target: targetR,
      origin: add(eaveR, V(0, 0.00, 0)),
      axisZ: dirR_in,
      axisX: V(1, 0, 0),
    });
  }

  return feats;
}
