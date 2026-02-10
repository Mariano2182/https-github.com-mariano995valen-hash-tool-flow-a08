// ifc_exporter.js — IFC4 real (STEP) with geometry (IfcExtrudedAreaSolid)
// Compatible con GitHub Pages (sin dependencias).

// ===================== GUID IFC (22 chars) =====================
const IFC64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

function bytesToIfcGuid(bytes16) {
  // IFC GUID uses a custom base64 encoding (22 chars) from 16 bytes.
  // This is a widely-used approach: encode 128-bit into 22 chars with IFC64 alphabet.
  const b = bytes16;
  const toUInt32 = (i) => (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];

  const num = [
    toUInt32(0) >>> 0,
    toUInt32(4) >>> 0,
    toUInt32(8) >>> 0,
    toUInt32(12) >>> 0,
  ];

  // Pack into 22 chars
  const chars = [];
  let n = BigInt(num[0]);
  n = (n << 32n) | BigInt(num[1]);
  n = (n << 32n) | BigInt(num[2]);
  n = (n << 32n) | BigInt(num[3]);

  // 22 chars * 6 bits = 132 bits (we store 128 bits -> leading zeros allowed)
  for (let i = 0; i < 22; i++) {
    const shift = BigInt((21 - i) * 6);
    const idx = Number((n >> shift) & 63n);
    chars.push(IFC64[idx]);
  }

  return chars.join("");
}

function newGuid() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return bytesToIfcGuid(a);
}

// ===================== STEP Builder =====================
class StepWriter {
  constructor() {
    this.lines = [];
    this.nextId = 1;
  }
  add(line) {
    const id = this.nextId++;
    this.lines.push(`#${id}=${line};`);
    return id;
  }
  ref(id) {
    return `#${id}`;
  }
  str(s) {
    if (s === null || s === undefined) return "$";
    const clean = String(s).replace(/'/g, "''");
    return `'${clean}'`;
  }
  num(n) {
    if (!Number.isFinite(n)) return "0.";
    // IFC likes trailing dot for REAL sometimes
    const x = Number(n);
    return (Math.round(x * 1000000) / 1000000).toString() + (String(x).includes(".") ? "" : ".");
  }
  bool(b) {
    return b ? ".T." : ".F.";
  }
  list(items) {
    return `(${items.join(",")})`;
  }
  enum(e) {
    return `.${e}.`;
  }
}

// ===================== Math / Vectors =====================
function v3(x, y, z) {
  return { x, y, z };
}
function sub(a, b) {
  return v3(a.x - b.x, a.y - b.y, a.z - b.z);
}
function len(a) {
  return Math.hypot(a.x, a.y, a.z);
}
function norm(a) {
  const l = len(a);
  if (l < 1e-9) return v3(0, 0, 1);
  return v3(a.x / l, a.y / l, a.z / l);
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a, b) {
  return v3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}
function pickPerp(zAxis) {
  // choose a stable perpendicular vector
  const up = Math.abs(zAxis.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  let x = cross(up, zAxis);
  if (len(x) < 1e-9) x = cross(v3(0, 0, 1), zAxis);
  return norm(x);
}

// ===================== Parametric to Members (with positions) =====================
function roofY(roof, height, span, slope, x) {
  const halfSpan = span / 2;
  if (roof === "plana") return height;
  if (roof === "una_agua") {
    const t = (x + halfSpan) / span;
    return height + t * (span * slope);
  }
  // dos_aguas
  const t = Math.abs(x) / halfSpan;
  return height + (1 - t) * (halfSpan * slope);
}

function buildMembersFromModel(model) {
  const b = model.building;
  const span = Number(b.span || 24);
  const lengthM = Number(b.length || 60);
  const height = Number(b.height || 8);
  const frames = Math.max(2, Number(b.frames || 10));
  const roof = b.roof || "dos_aguas";
  const slope = Number(b.slope || 0.1);
  const purlinSpacing = Number(b.purlinSpacing || 1.5);
  const girtSpacing = Number(b.girtSpacing || 1.5);

  const halfSpan = span / 2;
  const step = frames > 1 ? lengthM / (frames - 1) : lengthM;

  // sizes (m) — consistentes con tu preview
  const colSize = Math.max(0.12, span * 0.006);
  const rafterSize = Math.max(0.10, span * 0.005);
  const purlinSize = Math.max(0.06, span * 0.0035);
  const girtSize = Math.max(0.05, span * 0.003);

  const members = [];

  // Frames: columns + rafters/beams
  for (let i = 0; i < frames; i++) {
    const z = i * step;

    const baseL = v3(-halfSpan, 0, z);
    const baseR = v3(halfSpan, 0, z);

    let topL = v3(-halfSpan, height, z);
    let topR = v3(halfSpan, height, z);

    if (roof === "una_agua") topR = v3(halfSpan, height + span * slope, z);

    members.push({
      name: `COL-L-${i + 1}`,
      ifcType: "IfcColumn",
      a: baseL,
      b: topL,
      w: colSize,
      h: colSize,
    });

    members.push({
      name: `COL-R-${i + 1}`,
      ifcType: "IfcColumn",
      a: baseR,
      b: topR,
      w: colSize,
      h: colSize,
    });

    if (roof === "plana") {
      members.push({
        name: `BEAM-${i + 1}`,
        ifcType: "IfcBeam",
        a: v3(-halfSpan, roofY(roof, height, span, slope, -halfSpan), z),
        b: v3(halfSpan, roofY(roof, height, span, slope, halfSpan), z),
        w: rafterSize,
        h: rafterSize,
      });
    } else if (roof === "una_agua") {
      members.push({
        name: `RAF-${i + 1}`,
        ifcType: "IfcBeam",
        a: topL,
        b: topR,
        w: rafterSize,
        h: rafterSize,
      });
    } else {
      // dos aguas
      const eaveL = v3(-halfSpan, height, z);
      const eaveR = v3(halfSpan, height, z);
      const ridge = v3(0, height + halfSpan * slope, z);

      members.push({
        name: `RAF-L-${i + 1}`,
        ifcType: "IfcBeam",
        a: eaveL,
        b: ridge,
        w: rafterSize,
        h: rafterSize,
      });

      members.push({
        name: `RAF-R-${i + 1}`,
        ifcType: "IfcBeam",
        a: ridge,
        b: eaveR,
        w: rafterSize,
        h: rafterSize,
      });
    }
  }

  // Purlins (members along Z between frames)
  const linesAcross = Math.max(2, Math.floor(span / Math.max(0.1, purlinSpacing)) + 1);

  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const addPurl = (x) => {
      const y = roofY(roof, height, span, slope, x);
      members.push({
        name: `PURL-${bay + 1}-${x.toFixed(3)}`,
        ifcType: "IfcMember",
        a: v3(x, y, z0),
        b: v3(x, y, z1),
        w: purlinSize,
        h: purlinSize,
      });
    };

    if (roof === "dos_aguas") {
      const halfLines = Math.max(1, Math.floor(linesAcross / 2));

      for (let k = 0; k <= halfLines; k++) {
        const x = -halfSpan + (k / halfLines) * halfSpan;
        addPurl(x);
      }
      for (let k = 1; k <= halfLines; k++) {
        const x = (k / halfLines) * halfSpan;
        addPurl(x);
      }
      addPurl(0);
    } else {
      for (let k = 0; k <= linesAcross; k++) {
        const x = -halfSpan + (k / linesAcross) * span;
        addPurl(x);
      }
    }
  }

  // Girts (members along Z at side walls)
  for (let bay = 0; bay < frames - 1; bay++) {
    const z0 = bay * step;
    const z1 = (bay + 1) * step;

    const topL = height;
    const topR = roof === "una_agua" ? height + span * slope : height;

    const startY = 1.2;
    const maxYL = Math.max(startY, topL - 0.30);
    const maxYR = Math.max(startY, topR - 0.30);

    const levelsL = Math.max(2, Math.floor((maxYL - startY) / Math.max(0.1, girtSpacing)) + 1);
    const levelsR = Math.max(2, Math.floor((maxYR - startY) / Math.max(0.1, girtSpacing)) + 1);

    for (let i = 0; i < levelsL; i++) {
      const y = Math.min(maxYL, startY + i * girtSpacing);
      members.push({
        name: `GIRT-L-${bay + 1}-${i + 1}`,
        ifcType: "IfcMember",
        a: v3(-halfSpan, y, z0),
        b: v3(-halfSpan, y, z1),
        w: girtSize,
        h: girtSize,
      });
    }

    for (let i = 0; i < levelsR; i++) {
      const y = Math.min(maxYR, startY + i * girtSpacing);
      members.push({
        name: `GIRT-R-${bay + 1}-${i + 1}`,
        ifcType: "IfcMember",
        a: v3(halfSpan, y, z0),
        b: v3(halfSpan, y, z1),
        w: girtSize,
        h: girtSize,
      });
    }
  }

  return { members, step, span, lengthM, height };
}

// ===================== IFC Export =====================
export function exportIFCFromModel(model, opts = {}) {
  if (!model?.building) throw new Error("Modelo inválido: falta building.");

  const w = new StepWriter();

  const projectName = opts.projectName || "RMM Project";
  const clientName = opts.clientName || "";
  const author = opts.author || "demo@rmmstructures.com";

  // ---- Header (IFC4) ----
  const time = new Date().toISOString();
  const header =
`ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME(${w.str("rmm_structures.ifc")},${w.str(time)},(${w.str(author)}),(${w.str(clientName || "RMM")}),${w.str("RMM STRUCTURES")},${w.str("RMM IFC Exporter")},${w.str("")});
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;`;

  // ---- Basic owner/app ----
  const person = w.add(`IFCPERSON($,${w.str(author)},$, $, $, $, $, $)`);
  const org = w.add(`IFCORGANIZATION($,${w.str("RMM STRUCTURES")},$, $, $)`);
  const personOrg = w.add(`IFCPERSONANDORGANIZATION(${w.ref(person)},${w.ref(org)},$)`);
  const appOrg = w.add(`IFCORGANIZATION($,${w.str("RMM")},$, $, $)`);
  const app = w.add(`IFCAPPLICATION(${w.ref(appOrg)},${w.str("1.0")},${w.str("RMM IFC Exporter")},${w.str("RMM")})`);
  const ownerHistory = w.add(`IFCOWNERHISTORY(${w.ref(personOrg)},${w.ref(app)},$,${w.enum("ADDED")},$,${w.ref(personOrg)},${w.ref(app)},${Math.floor(Date.now()/1000)})`);

  // ---- Units (meters) ----
  const unitLength = w.add(`IFCSIUNIT(*,${w.enum("LENGTHUNIT")},$,${w.enum("METRE")})`);
  const unitArea = w.add(`IFCSIUNIT(*,${w.enum("AREAUNIT")},$,${w.enum("SQUARE_METRE")})`);
  const unitVol = w.add(`IFCSIUNIT(*,${w.enum("VOLUMEUNIT")},$,${w.enum("CUBIC_METRE")})`);
  const unitMass = w.add(`IFCSIUNIT(*,${w.enum("MASSUNIT")},$,${w.enum("KILOGRAM")})`);
  const unitSet = w.add(`IFCUNITASSIGNMENT((${w.ref(unitLength)},${w.ref(unitArea)},${w.ref(unitVol)},${w.ref(unitMass)}))`);

  // ---- Geometry context ----
  const p0 = w.add(`IFCCARTESIANPOINT((0.,0.,0.))`);
  const dirZ = w.add(`IFCDIRECTION((0.,0.,1.))`);
  const dirX = w.add(`IFCDIRECTION((1.,0.,0.))`);
  const worldAxis = w.add(`IFCAXIS2PLACEMENT3D(${w.ref(p0)},${w.ref(dirZ)},${w.ref(dirX)})`);
  const context = w.add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,${w.str("Model")},3,1.E-5,${w.ref(worldAxis)},$)`);

  // ---- Project / spatial structure ----
  const project = w.add(`IFCPROJECT(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str(projectName)},$, $, $, $, (${w.ref(context)}),${w.ref(unitSet)})`);

  const sitePlacement = w.add(`IFCLOCALPLACEMENT($,${w.ref(worldAxis)})`);
  const site = w.add(`IFCSITE(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Site")},$, $,${w.ref(sitePlacement)},$, $,${w.enum("ELEMENT")},$, $, $, $, $)`);

  const buildingPlacement = w.add(`IFCLOCALPLACEMENT(${w.ref(sitePlacement)},${w.ref(worldAxis)})`);
  const building = w.add(`IFCBUILDING(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Building")},$, $,${w.ref(buildingPlacement)},$, $,${w.enum("ELEMENT")},$, $, $, $)`);

  const storeyPlacement = w.add(`IFCLOCALPLACEMENT(${w.ref(buildingPlacement)},${w.ref(worldAxis)})`);
  const storey = w.add(`IFCBUILDINGSTOREY(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Storey 00")},$, $,${w.ref(storeyPlacement)},$, $,${w.enum("ELEMENT")},0.)`);

  // Aggregate relationships
  w.add(`IFCRELAGGREGATES(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Project->Site")},$,${w.ref(project)},(${w.ref(site)}))`);
  w.add(`IFCRELAGGREGATES(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Site->Building")},$,${w.ref(site)},(${w.ref(building)}))`);
  w.add(`IFCRELAGGREGATES(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Building->Storey")},$,${w.ref(building)},(${w.ref(storey)}))`);

  // ---- Material ----
  const steelMat = w.add(`IFCMATERIAL(${w.str("Steel")})`);

  // ---- Build members geometry ----
  const { members } = buildMembersFromModel(model);

  // Cache directions/points to reduce file size
  const dirCache = new Map(); // key "x,y,z"
  const ptCache = new Map();

  const dirId = (d) => {
    const k = `${d.x.toFixed(6)},${d.y.toFixed(6)},${d.z.toFixed(6)}`;
    const got = dirCache.get(k);
    if (got) return got;
    const id = w.add(`IFCDIRECTION((${w.num(d.x)},${w.num(d.y)},${w.num(d.z)}))`);
    dirCache.set(k, id);
    return id;
  };

  const ptId = (p) => {
    const k = `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
    const got = ptCache.get(k);
    if (got) return got;
    const id = w.add(`IFCCARTESIANPOINT((${w.num(p.x)},${w.num(p.y)},${w.num(p.z)}))`);
    ptCache.set(k, id);
    return id;
  };

  // Representation helper
  const makeProfile = (wDim, hDim) => {
    // 2D placement in profile plane
    const o2 = w.add(`IFCCARTESIANPOINT((0.,0.))`);
    const d2x = w.add(`IFCDIRECTION((1.,0.))`);
    const profPos = w.add(`IFCAXIS2PLACEMENT2D(${w.ref(o2)},${w.ref(d2x)})`);
    return w.add(`IFCRECTANGLEPROFILEDEF(${w.enum("AREA")},$,${w.ref(profPos)},${w.num(wDim)},${w.num(hDim)})`);
  };

  const shapeForMember = (a, b, wDim, hDim) => {
    const axisVec = norm(sub(b, a)); // local Z
    const xVec = pickPerp(axisVec);  // local X
    const z = dirId(axisVec);
    const x = dirId(xVec);

    const loc = ptId(a);
    const axis = w.add(`IFCAXIS2PLACEMENT3D(${w.ref(loc)},${w.ref(z)},${w.ref(x)})`);

    const placement = w.add(`IFCLOCALPLACEMENT(${w.ref(storeyPlacement)},${w.ref(axis)})`);

    const profile = makeProfile(wDim, hDim);

    const extrDir = dirId(v3(0, 0, 1));
    const depth = len(sub(b, a));

    const solid = w.add(`IFCEXTRUDEDAREASOLID(${w.ref(profile)},${w.ref(worldAxis)},${w.ref(extrDir)},${w.num(depth)})`);
    const bodyRep = w.add(`IFCSHAPEREPRESENTATION(${w.ref(context)},${w.str("Body")},${w.str("SweptSolid")},(${w.ref(solid)}))`);
    const pdef = w.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${w.ref(bodyRep)}))`);

    return { placement, pdef };
  };

  const productIds = [];

  for (const m of members) {
    const guid = newGuid();
    const { placement, pdef } = shapeForMember(m.a, m.b, m.w, m.h);

    const name = m.name;
    const ifcType = m.ifcType;

    let prod;
    if (ifcType === "IfcColumn") {
      prod = w.add(`IFCCOLUMN(${w.str(guid)},${w.ref(ownerHistory)},${w.str(name)},$, $,${w.ref(placement)},${w.ref(pdef)},$, $)`);
    } else if (ifcType === "IfcBeam") {
      prod = w.add(`IFCBEAM(${w.str(guid)},${w.ref(ownerHistory)},${w.str(name)},$, $,${w.ref(placement)},${w.ref(pdef)},$, $)`);
    } else {
      // IfcMember
      prod = w.add(`IFCMEMBER(${w.str(guid)},${w.ref(ownerHistory)},${w.str(name)},$, $,${w.ref(placement)},${w.ref(pdef)},$, $)`);
    }

    productIds.push(prod);

    // Material association per element (lightweight)
    w.add(`IFCRELASSOCIATESMATERIAL(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Steel")},$,(${w.ref(prod)}),${w.ref(steelMat)})`);
  }

  // Containment in storey
  w.add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${w.str(newGuid())},${w.ref(ownerHistory)},${w.str("Storey containment")},$,(${productIds.map((id) => w.ref(id)).join(",")}),${w.ref(storey)})`);

  // ---- Close ----
  const footer =
`ENDSEC;
END-ISO-10303-21;`;

  return header + "\n" + w.lines.join("\n") + "\n" + footer;
}
