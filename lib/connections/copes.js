// lib/connections/copes.js
// Cortes tipo "cope/notch" estilo Tekla (volúmenes a sustraer)
// Genera 2 cuts por extremo: asiento + lateral
// Usa base con Y ~ vertical para que el cope se vea "industrial" y consistente

import { V, add, mul, norm } from "./math.js";

// Construye un sistema ortonormal (X,Y,Z) donde:
// X = dir (a lo largo del miembro)
// Z = normal hacia "adentro" (hacia la columna)
// Y = lo más cercano posible a globalUp (0,1,0)
function basisFromXZNearingUp(dirX, normalZ) {
  const X = norm(dirX);
  const Z = norm(normalZ);

  // Y ≈ up proyectado ortogonal a X y Z
  const up = V(0, 1, 0);

  // upOrtho = up - (up·X)X - (up·Z)Z
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);

  let Y = up;
  Y = sub(Y, mul(X, dot(Y, X)));
  Y = sub(Y, mul(Z, dot(Y, Z)));

  // si quedó degenerado, fallback a cross(Z,X)
  const lenY = Math.hypot(Y.x, Y.y, Y.z);
  if (lenY < 1e-6) {
    // cross(Z, X)
    Y = V(
      Z.y * X.z - Z.z * X.y,
      Z.z * X.x - Z.x * X.z,
      Z.x * X.y - Z.y * X.x
    );
  }
  Y = norm(Y);

  // Re-ortogonalizar Z para que sea exacto: Z = X x Y
  const ZZ = V(
    X.y * Y.z - X.z * Y.y,
    X.z * Y.x - X.x * Y.z,
    X.x * Y.y - X.y * Y.x
  );

  return { X, Y, Z: norm(ZZ) };
}

// opts: { cope: { seatLen, seatH, seatIn, sideLen, sideH, sideIn, clearance, yUp } }
export function buildCopes(b, opts = {}) {
  const { span, length, height, frames, roof, slope } = b;
  const halfSpan = span / 2;
  const step = frames > 1 ? length / (frames - 1) : length;

  // Parámetros “tipo Tekla” (ajustables)
  const cope = {
    // asiento (corte inferior)
    seatLen: 0.22,     // largo del corte sobre el miembro (m)  -> axisX
    seatH:   0.10,     // altura del corte (m)                  -> axisY
    seatIn:  0.20,     // cuánto penetra hacia la columna (m)   -> axisZ

    // lateral (corte para que entre placa/ala + holgura)
    sideLen: 0.22,
    sideH:   0.18,     // más alto que el asiento
    sideIn:  0.12,     // menos penetración que el asiento

    clearance: 0.006,  // holgura
    ...((opts.cope) || {}),
  };

  const feats = [];

  // dirección del cabio por lado (para orientar cope)
  function rafDirAtFrame(z, side) {
    if (roof === "plana") {
      return side === "L" ? V(1, 0, 0) : V(-1, 0, 0);
    }
    if (roof === "una_agua") {
      return side === "L"
        ? norm(V(span, span * slope, 0))
        : norm(V(-span, -span * slope, 0));
    }
    // dos aguas
    const eave = side === "L" ? V(-halfSpan, height, z) : V(halfSpan, height, z);
    const ridge = V(0, height + halfSpan * slope, z);
    return norm(V(ridge.x - eave.x, ridge.y - eave.y, ridge.z - eave.z));
  }

  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const eaveL = V(-halfSpan, height, z);
    const eaveR = V( halfSpan, height, z);

    const dirL = rafDirAtFrame(z, "L");
    const dirR = rafDirAtFrame(z, "R");

    // normal hacia interior (hacia la nave/columna)
    const nL = norm(V( 1, 0, 0));
    const nR = norm(V(-1, 0, 0));

    // “origen” del cope: apenas hacia adentro por holgura, sobre el eje del miembro
    const orgL = add(eaveL, mul(dirL, cope.clearance));
    const orgR = add(eaveR, mul(dirR, cope.clearance));

    // Base orientada con Y ~ vertical (se ve más “Tekla”)
    const basisL = basisFromXZNearingUp(dirL, nL);
    const basisR = basisFromXZNearingUp(dirR, nR);

    // naming (igual que el tuyo)
    const targetL =
      roof === "dos_aguas" ? `RAF-L-${i + 1}` :
      roof === "plana"    ? `BEAM-${i + 1}`  : `RAF-${i + 1}`;

    const targetR =
      roof === "dos_aguas" ? `RAF-R-${i + 1}` :
      roof === "plana"    ? `BEAM-${i + 1}`  : `RAF-${i + 1}`;

    // helper para empujar feats
    function pushCopePair(target, org, basis) {
      // 1) Asiento: cortamos “abajo”
      feats.push({
        kind: "CUT",
        cutType: "COPE_SEAT",
        target,
        origin: org,
        axisX: basis.X,
        axisY: basis.Y,
        axisZ: basis.Z,
        shape: "BOX",
        // Box dims: w->X, h->Y, d->Z
        w: cope.seatLen,
        h: cope.seatH,
        d: cope.seatIn,
        // Centro: avanzamos medio largo sobre X, y bajamos medio alto sobre Y
        // (bajar = -Y)
        centerLocal: { x: cope.seatLen * 0.5, y: -cope.seatH * 0.5, z: cope.seatIn * 0.5 }
      });

      // 2) Lateral: “muerde” el costado para placa/ala
      feats.push({
        kind: "CUT",
        cutType: "COPE_SIDE",
        target,
        origin: org,
        axisX: basis.X,
        axisY: basis.Y,
        axisZ: basis.Z,
        shape: "BOX",
        w: cope.sideLen,
        h: cope.sideH,
        d: cope.sideIn,
        // Centro: avanzamos medio largo, y subimos un poco para que no mate todo el asiento
        centerLocal: { x: cope.sideLen * 0.5, y: cope.sideH * 0.15, z: cope.sideIn * 0.5 }
      });
    }

    if (roof === "dos_aguas") {
      pushCopePair(targetL, orgL, basisL);
      pushCopePair(targetR, orgR, basisR);
    } else {
      // plana / una_agua: mismo target en ambos extremos
      // igual mantenemos 2 copes para asegurar cortes en ambos lados
      pushCopePair(targetL, orgL, basisL);
      pushCopePair(targetR, orgR, basisR);
    }
  }

  return feats;
}
