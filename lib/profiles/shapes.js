// Devuelve polígono 2D cerrado [{x,y}, ...] (en metros)
export function shape2DFromProfile(p) {
  const f = p.family;

  if (f === "I") return shapeI(p.dims);
  if (f === "C") return shapeC(p.dims);
  if (f === "Z") return shapeZ(p.dims);
  if (f === "L") return shapeL(p.dims);
  if (f === "RECT") return shapeRECT(p.dims);
  if (f === "CHS") return shapeCHS(p.dims);

  // fallback rect
  return [
    { x: -0.06, y: -0.06 },
    { x: 0.06, y: -0.06 },
    { x: 0.06, y: 0.06 },
    { x: -0.06, y: 0.06 },
    { x: -0.06, y: -0.06 },
  ];
}

// ---- I (simplificado sin radios) ----
function shapeI({ h, b, tw, tf }) {
  const x0 = -b / 2, x1 = -tw / 2, x2 = tw / 2, x3 = b / 2;
  const y0 = -h / 2, y1 = y0 + tf, y2 = h / 2 - tf, y3 = h / 2;

  return [
    { x: x0, y: y0 }, { x: x3, y: y0 }, { x: x3, y: y1 },
    { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y2 },
    { x: x3, y: y3 }, { x: x0, y: y3 }, { x: x0, y: y2 },
    { x: x1, y: y2 }, { x: x1, y: y1 }, { x: x0, y: y1 },
    { x: x0, y: y0 },
  ];
}

// ---- C (U) sólido simplificado ----
function shapeC({ h, b, t }) {
  const x0 = -b / 2, x3 = b / 2;
  const x1 = x0 + t;
  const y0 = -h / 2, y3 = h / 2;
  const y1 = y0 + t, y2 = y3 - t;

  return [
    { x: x0, y: y0 }, { x: x3, y: y0 }, { x: x3, y: y1 },
    { x: x1, y: y1 }, { x: x1, y: y2 }, { x: x3, y: y2 },
    { x: x3, y: y3 }, { x: x0, y: y3 }, { x: x0, y: y0 },
  ];
}

// ---- Z (simplificado) ----
function shapeZ({ h, b, t }) {
  const y0 = -h / 2, y3 = h / 2;
  const y1 = y0 + t, y2 = y3 - t;

  const xTop0 = -t / 2;
  const xTop1 = xTop0 + b;

  const xBot1 = t / 2;
  const xBot0 = xBot1 - b;

  return [
    { x: xBot0, y: y0 }, { x: xBot1, y: y0 }, { x: xBot1, y: y1 },
    { x: t / 2, y: y1 }, { x: t / 2, y: y2 }, { x: -t / 2, y: y2 },
    { x: -t / 2, y: y1 },
    { x: xTop0, y: y2 }, { x: xTop1, y: y2 }, { x: xTop1, y: y3 },
    { x: xTop0, y: y3 }, { x: xTop0, y: y2 },
    { x: -t / 2, y: y2 }, { x: xBot0, y: y2 }, { x: xBot0, y: y0 },
  ];
}

// ---- L (ángulo) sólido ----
function shapeL({ h, b, t }) {
  const x0 = -b / 2, x3 = b / 2;
  const y0 = -h / 2, y3 = h / 2;

  return [
    { x: x0, y: y0 }, { x: x0 + t, y: y0 }, { x: x0 + t, y: y3 - t },
    { x: x3, y: y3 - t }, { x: x3, y: y3 }, { x: x0, y: y3 },
    { x: x0, y: y0 },
  ];
}

// ---- Tubo rectangular ----
function shapeRECT({ h, b, t }) {
  const x0 = -b / 2, x3 = b / 2;
  const y0 = -h / 2, y3 = h / 2;

  // sólido simple: contorno exterior (sin hueco). Si querés hueco real, se hace con Shape + hole.
  return [
    { x: x0, y: y0 }, { x: x3, y: y0 }, { x: x3, y: y3 }, { x: x0, y: y3 }, { x: x0, y: y0 },
  ];
}

// ---- Circular hollow (simplificado como polígono) ----
function shapeCHS({ d }) {
  const r = d / 2;
  const n = 32;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}
