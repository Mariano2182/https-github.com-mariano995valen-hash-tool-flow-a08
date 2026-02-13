// lib/profiles/shapes.js
// Devuelve polígono 2D cerrado (x,y) centrado, en metros.
// Usado por IFC (IfcArbitraryClosedProfileDef) y por Preview 3D (THREE.Shape).

export function profilePolygon(profile) {
  const family = profile?.family;

  if (family === "I") {
    const { h, b, tw, tf } = profile.dims;

    const x0 = -b / 2,
      x1 = -tw / 2,
      x2 = tw / 2,
      x3 = b / 2;

    const y0 = -h / 2,
      y1 = y0 + tf,
      y2 = h / 2 - tf,
      y3 = h / 2;

    return [
      { x: x0, y: y0 },
      { x: x3, y: y0 },
      { x: x3, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y2 },
      { x: x3, y: y3 },
      { x: x0, y: y3 },
      { x: x0, y: y2 },
      { x: x1, y: y2 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 },
    ];
  }

  if (family === "C") {
    const { h, b, t, lip = 0 } = profile.dims;

    const x0 = -b / 2;
    const x3 = b / 2;

    const y0 = -h / 2;
    const y3 = h / 2;

    // C con labios simples (más “tekla-like” visualmente)
    const xIn = x0 + t;
    const yBot = y0 + t;
    const yTop = y3 - t;

    return [
      { x: x0, y: y0 },
      { x: x3, y: y0 },
      { x: x3, y: y0 + t },
      { x: x0 + lip, y: y0 + t },
      { x: x0 + lip, y: yBot },
      { x: xIn, y: yBot },
      { x: xIn, y: yTop },
      { x: x0 + lip, y: yTop },
      { x: x0 + lip, y: y3 - t },
      { x: x3, y: y3 - t },
      { x: x3, y: y3 },
      { x: x0, y: y3 },
      { x: x0, y: y0 },
    ];
  }

  if (family === "Z") {
    const { h, b, t, lip = 0 } = profile.dims;

    const y0 = -h / 2;
    const y3 = h / 2;

    const y1 = y0 + t;
    const y2 = y3 - t;

    // Z con labios simples (ala sup +X, ala inf -X)
    const xTop0 = -t / 2;
    const xTop1 = xTop0 + b;
    const xBot1 = t / 2;
    const xBot0 = xBot1 - b;

    return [
      // ala inferior (hacia -X)
      { x: xBot0, y: y0 },
      { x: xBot1, y: y0 },
      { x: xBot1, y: y0 + t },
      { x: xBot0 + lip, y: y0 + t },
      { x: xBot0 + lip, y: y1 },

      // alma
      { x: t / 2, y: y1 },
      { x: t / 2, y: y2 },
      { x: -t / 2, y: y2 },
      { x: -t / 2, y: y1 },

      // ala superior (hacia +X)
      { x: xTop0, y: y2 },
      { x: xTop1, y: y2 },
      { x: xTop1, y: y3 },
      { x: xTop0, y: y3 },
      { x: xTop0, y: y3 - t },
      { x: xTop1 - lip, y: y3 - t },
      { x: xTop1 - lip, y: y2 },

      // cierre “por atrás”
      { x: -t / 2, y: y2 },
      { x: xBot0, y: y2 },
      { x: xBot0, y: y0 },
    ];
  }

  // fallback: rectángulo
  const w = Math.max(0.08, profile?.dims?.b || 0.12);
  const hh = Math.max(0.08, profile?.dims?.h || 0.12);

  return [
    { x: -w / 2, y: -hh / 2 },
    { x: w / 2, y: -hh / 2 },
    { x: w / 2, y: hh / 2 },
    { x: -w / 2, y: hh / 2 },
    { x: -w / 2, y: -hh / 2 },
  ];
}
