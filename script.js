 estado const = { 
 progreso: 62, 
 espectadoresPiezas: 1420, 
 espectadorPrecisión: 98, 
const state = {
  wizardStep: 1,
  wizardData: {},
  rulesResults: [],
  catalogProfiles: [],
  activeCatalogLibrary: "rmm-core",
};

const formatNumber = (valor) = > valor.toLocaleString("es-CL"); 
const defaultCatalogProfiles = [
  { name: "HEA 260", type: "I", rMinMm: 55, weightKgM: 76, h: 0.26, b: 0.26, tw: 0.0085, tf: 0.013 },
  { name: "HEA 300", type: "I", rMinMm: 64, weightKgM: 90, h: 0.29, b: 0.3, tw: 0.009, tf: 0.014 },
  { name: "HEB 260", type: "I", rMinMm: 63, weightKgM: 93, h: 0.26, b: 0.26, tw: 0.01, tf: 0.016 },
  { name: "HEB 300", type: "I", rMinMm: 73, weightKgM: 110, h: 0.3, b: 0.3, tw: 0.011, tf: 0.018 },
  { name: "IPE 300", type: "I", rMinMm: 68, weightKgM: 42, h: 0.3, b: 0.15, tw: 0.0071, tf: 0.0107 },
  { name: "IPE 360", type: "I", rMinMm: 82, weightKgM: 57, h: 0.36, b: 0.17, tw: 0.008, tf: 0.013 },
  { name: "Z 200", type: "RECT", rMinMm: 25, weightKgM: 18, h: 0.2, b: 0.06, tw: null, tf: null },
  { name: "Z 250", type: "RECT", rMinMm: 30, weightKgM: 22, h: 0.25, b: 0.07, tw: null, tf: null },
  { name: "L 60x6", type: "RECT", rMinMm: 18, weightKgM: 5, h: 0.06, b: 0.06, tw: null, tf: null },
  { name: "L 75x6", type: "RECT", rMinMm: 22, weightKgM: 6.5, h: 0.075, b: 0.075, tw: null, tf: null },
  { name: "W 200x21", type: "I", rMinMm: 50, weightKgM: 21, h: 0.203, b: 0.133, tw: 0.0058, tf: 0.0086 },
  { name: "W 310x60", type: "I", rMinMm: 76, weightKgM: 60, h: 0.31, b: 0.165, tw: 0.0075, tf: 0.012 },
  { name: "TUBO 200x100x8", type: "RECT", rMinMm: 40, weightKgM: 39, h: 0.2, b: 0.1, tw: null, tf: null },
  { name: "TUBO 120x60x6", type: "RECT", rMinMm: 28, weightKgM: 16, h: 0.12, b: 0.06, tw: null, tf: null },
  { name: "TUBO 80x80x4", type: "RECT", rMinMm: 22, weightKgM: 11, h: 0.08, b: 0.08, tw: null, tf: null },
];

const openModal = (modal) => { 
 modal.ListaClase.add("activo"); 
 modal.setAttribute("aria-oculta", "falsa"); 
const catalogLibraries = [
  {
    id: "rmm-core",
    name: "RMM Core (LatAm)",
    region: "LatAm",
    norm: "CIRSOC/IRAM",
    profiles: defaultCatalogProfiles.map((profile) => ({ ...profile, norm: "IRAM / CIRSOC" })),
  },
  {
    id: "eu-steel",
    name: "Eurocode Steel (EU)",
    region: "EU",
    norm: "EN 1993",
    profiles: defaultCatalogProfiles.map((profile) => ({ ...profile, norm: "EN 10365" })),
  },
  {
    id: "aisc-us",
    name: "AISC Shapes (US)",
    region: "US",
    norm: "AISC 360",
    profiles: defaultCatalogProfiles.map((profile) => ({ ...profile, norm: "AISC" })),
  },
  {
    id: "custom-plant",
    name: "Catálogo Planta (custom)",
    region: "Custom",
    norm: "Interno",
    profiles: defaultCatalogProfiles.map((profile) => ({ ...profile, norm: "Interno QA" })),
  },
];

const sampleModel = {
  building: { length: 60 },
  elements: [],
  geometryElements: [],
  detailElements: [],
  bracing: {
    longitudinal: [{ id: "BL-01", type: "cross", from: 0, to: 50 }],
  },
  geometry: {
    spansOk: true,
    heightsOk: true,
    portalSpacingOk: true,
  },
  stability: {
    lateralSystemOk: true,
    loadPathOk: true,
  },
  roof: {
    diaphragmContinuous: false,
  },
  foundation: {
    columnsAnchored: true,
    columnsWithFoundation: true,
  },
  fabrication: {
    maxPieceLength: 18,
    maxPieceWeightKg: 2800,
    profilesCatalogOk: true,
    jointsDefined: false,
  },
  cost: {
    totalWeightKg: 42000,
  },
  export: {
    canExport: false,
  },
  versioning: {
    status: "draft",
  },
  permissions: {
    role: "Ingeniero",
    allowed: ["edit", "validate"],
  },
};

const rulesCatalog = [
  {
    id: 1,
    title: "Regla 1: Esbeltez de columnas (CIRSOC 101)",
    description:
      "Detecta columnas excesivamente esbeltas. Error si L/r > 200, warning si 150 < L/r ≤ 200.",
    code: `function validateColumnSlenderness(model) {
  const results = [];

  model.elements
    .filter(e => e.type === 'column')
    .forEach(col => {
      if (!col.length_mm || !col.profile?.r_min_mm) {
        results.push({ status: 'error', message: 'Datos insuficientes' });
        return;
      }

      const slenderness = col.length_mm / col.profile.r_min_mm;

      if (slenderness > 200) {
        results.push({ status: 'error', message: 'Esbeltez crítica' });
      } else if (slenderness > 150) {
        results.push({ status: 'warning', message: 'Esbeltez a revisar' });
      } else {
        results.push({ status: 'ok', message: 'Esbeltez OK' });
      }
    });

  return results;
}`,
    run: (model) => {
      const results = model.elements
        .filter((e) => e.type === "column")
        .map((col) => {
          if (!col.length_mm || !col.profile?.r_min_mm) {
            return { status: "error", message: "Datos insuficientes" };
          }
          const slenderness = col.length_mm / col.profile.r_min_mm;
          if (slenderness > 200) {
            return { status: "error", message: `L/r = ${slenderness.toFixed(1)} > 200` };
          }
          if (slenderness > 150) {
            return { status: "warning", message: `L/r = ${slenderness.toFixed(1)} revisar` };
          }
          return { status: "ok", message: `L/r = ${slenderness.toFixed(1)}` };
        });
      return summarizeResults(results, "Columnas evaluadas");
    },
  },
  {
    id: 2,
    title: "Regla 2: Coherencia geométrica básica",
    description:
      "Valida que las dimensiones principales y la modulación del pórtico sean coherentes.",
    code: `function validateGeometry(model) {
  const { spansOk, heightsOk, portalSpacingOk } = model.geometry;
  if (!spansOk || !heightsOk) return { status: 'error' };
  if (!portalSpacingOk) return { status: 'warning' };
  return { status: 'ok' };
}`,
    run: (model) => {
      const { spansOk, heightsOk, portalSpacingOk } = model.geometry;
      if (!spansOk || !heightsOk) {
        return { status: "error", message: "Dimensiones fuera de rango" };
      }
      if (!portalSpacingOk) {
        return { status: "warning", message: "Modulación de pórticos a revisar" };
      }
      return { status: "ok", message: "Geometría coherente" };
    },
  },
  {
    id: 3,
    title: "Regla 3: Estabilidad estructural global",
    description:
      "Chequea presencia de sistema lateral y camino de cargas estable.",
    code: `function validateGlobalStability(model) {
  const { lateralSystemOk, loadPathOk } = model.stability;
  if (!lateralSystemOk || !loadPathOk) {
    return { status: 'error', message: 'Sistema inestable' };
  }
  return { status: 'ok', message: 'Estabilidad global OK' };
}`,
    run: (model) => {
      const { lateralSystemOk, loadPathOk } = model.stability;
      if (!lateralSystemOk || !loadPathOk) {
        return { status: "error", message: "Sistema lateral incompleto" };
      }
      return { status: "ok", message: "Estabilidad global OK" };
    },
  },
  {
    id: 4,
    title: "Regla 4: Arriostramiento longitudinal (CIRSOC 101)",
    description:
      "Valida existencia y continuidad del sistema resistente longitudinal.",
    code: `function validateLongitudinalBracing(model) {
  const length = model.building.length;
  const bracings = model.bracing?.longitudinal || [];

  if (bracings.length === 0) {
    return { status: 'error', message: 'No hay arriostramiento' };
  }

  const covered = bracings.some(b => b.from <= 0 && b.to >= length);
  return covered
    ? { status: 'ok', message: 'Sistema continuo' }
    : { status: 'warning', message: 'No cubre toda la nave' };
}`,
    run: (model) => {
      const bracings = model.bracing?.longitudinal || [];
      if (bracings.length === 0) {
        return { status: "error", message: "Sin arriostramiento longitudinal" };
      }
      const covered = bracings.some((b) => b.from <= 0 && b.to >= model.building.length);
      return covered
        ? { status: "ok", message: "Sistema longitudinal continuo" }
        : { status: "warning", message: "Arriostramiento incompleto" };
    },
  },
  {
    id: 5,
    title: "Regla 5: Presencia de diafragma de cubierta",
    description:
      "Verifica que exista un diafragma continuo de cubierta para transmitir cargas.",
    code: `function validateRoofDiaphragm(model) {
  return model.roof.diaphragmContinuous
    ? { status: 'ok', message: 'Diafragma continuo' }
    : { status: 'warning', message: 'Diafragma discontinuo' };
}`,
    run: (model) =>
      model.roof.diaphragmContinuous
        ? { status: "ok", message: "Diafragma de cubierta continuo" }
        : { status: "warning", message: "Diafragma de cubierta incompleto" },
  },
  {
    id: 6,
    title: "Regla 6: Fundaciones mínimas compatibles",
    description: "Verifica que todas las columnas tengan fundación y anclajes.",
    code: `estructura.columnas.forEach(col => {
  if (!col.fundacion) {
    error('Columna sin fundación definida');
  }
  if (col.tomaCargasHorizontales && !col.fundacion.anclada) {
    error('Columna sin anclaje adecuado');
  }
});`,
    run: (model) => {
      if (!model.foundation.columnsWithFoundation) {
        return { status: "error", message: "Columnas sin fundación" };
      }
      if (!model.foundation.columnsAnchored) {
        return { status: "error", message: "Columnas sin anclaje" };
      }
      return { status: "ok", message: "Fundaciones coherentes" };
    },
  },
  {
    id: 7,
    title: "Regla 7: Fabricabilidad real",
    description: "Controla longitud, peso, perfiles y uniones fabricables.",
    code: `pieza.forEach(p => {
  if (p.longitud > 18) error('Pieza no transportable');
  if (p.peso > 3000) error('Pieza no manipulable');
  if (!catalogo.perfiles.includes(p.perfil)) error('Perfil no normalizado');
  if (!p.unionDefinida) warning('Unión sin definir');
});`,
    run: (model) => {
      const { fabrication } = model;
      if (fabrication.maxPieceLength > 18) {
        return { status: "error", message: "Pieza no transportable" };
      }
      if (fabrication.maxPieceWeightKg > 3000) {
        return { status: "error", message: "Pieza no manipulable" };
      }
      if (!fabrication.profilesCatalogOk) {
        return { status: "error", message: "Perfil fuera de catálogo" };
      }
      if (!fabrication.jointsDefined) {
        return { status: "warning", message: "Uniones pendientes" };
      }
      return { status: "ok", message: "Fabricación viable" };
    },
  },
  {
    id: 8,
    title: "Regla 8: Costeo automático preliminar",
    description: "Calcula costos con peso total, coeficientes y montaje.",
    code: `const costoMaterial = pesoTotal * precioKg;
const costoFabricacion = pesoTotal * coefFabricacion;
const costoMontaje = (costoMaterial + costoFabricacion) * coefMontaje;
const costoTotal = costoMaterial + costoFabricacion + costoMontaje;`,
    run: (model) => ({
      status: "ok",
      message: `Peso total ${model.cost.totalWeightKg.toLocaleString("es-AR")} kg`,
    }),
  },
  {
    id: 9,
    title: "Regla 9: Exportables industriales",
    description: "Habilita exportación si no hay errores críticos.",
    code: `if (erroresCriticos) {
  exportacion = 'bloqueada';
} else {
  exportacion = 'habilitada';
}`,
    run: (model) => ({
      status: model.export.canExport ? "ok" : "warning",
      message: model.export.canExport ? "Exportación habilitada" : "Exportación bloqueada",
    }),
  },
  {
    id: 10,
    title: "Regla 10: Versionado y trazabilidad",
    description: "Controla estados de versión y congelado para fabricación.",
    code: `function nuevaVersion(proyecto, cambios) {
  return {
    version: proyecto.version + 0.1,
    estado: 'borrador',
    cambios,
  };
}`,
    run: (model) => ({
      status: model.versioning.status === "frozen" ? "ok" : "warning",
      message: `Estado de versión: ${model.versioning.status}`,
    }),
  },
  {
    id: 11,
    title: "Regla 11: Colaboración multiusuario",
    description: "Permisos por rol con acciones habilitadas.",
    code: `function puede(usuario, accion) {
  return permisos[usuario.rol].includes(accion);
}`,
    run: (model) => ({
      status: model.permissions.allowed.includes("validate") ? "ok" : "error",
      message: `Rol ${model.permissions.role} con permisos ${model.permissions.allowed.join(", ")}`,
    }),
  },
  {
    id: 12,
    title: "Regla 12: Auditoría final Go / No-Go",
    description: "Bloquea exportación con errores críticos.",
    code: `function auditoriaFinal(proyecto) {
  const reglasCriticas = [3,4,5,6,7];
  return reglasCriticas.some(r => proyecto.reglas[r].estado === 'ERROR')
    ? 'NO-GO'
    : 'GO';
}`,
    run: () => ({
      status: "warning",
      message: "Pendiente de auditoría completa (reglas críticas) ",
    }),
  },
];

const buildProfileCatalogMap = (profiles) =>
  profiles.reduce((acc, profile) => {
    if (!profile.name) {
      return acc;
    }
    acc[profile.name] = {
      type: profile.type || "RECT",
      rMinMm: Number(profile.rMinMm) || 0,
      weightKgM: Number(profile.weightKgM) || 0,
      h: Number(profile.h) || 0,
      b: Number(profile.b) || 0,
      tw: profile.tw !== null && profile.tw !== "" ? Number(profile.tw) : null,
      tf: profile.tf !== null && profile.tf !== "" ? Number(profile.tf) : null,
    };
    return acc;
  }, {});

const getCatalogProfilesFromTable = () =>
  state.catalogProfiles.length ? state.catalogProfiles : [...defaultCatalogProfiles];

const renderCatalogTable = () => {
  if (!catalogTableBody) {
    return;
  }
  const profiles = state.catalogProfiles.length ? state.catalogProfiles : [...defaultCatalogProfiles];
  catalogTableBody.innerHTML = profiles
    .map(
      (profile, index) => `
      <tr data-index="${index}">
        <td>${profile.name || ""}</td>
        <td>${profile.norm || "-"}</td>
        <td>${profile.type || ""}</td>
        <td>${profile.h ?? ""}</td>
        <td>${profile.b ?? ""}</td>
        <td>${profile.tw ?? ""}</td>
        <td>${profile.tf ?? ""}</td>
        <td>${profile.rMinMm ?? ""}</td>
        <td>${profile.weightKgM ?? ""}</td>
      </tr>
    `
    )
    .join("");
};

const closeModal = (modal) => { 
 modal.ListaClase.remove("activo"); 
 modal.setAttribute("aria-oculta", "verdadero"); 
const updateCatalogStatus = (message) => {
  if (catalogStatus) {
    catalogStatus.textContent = message;
  }
};

const updateViewer = () => { 
 estado.viewerPieces += Matemáticas.Planta (Matemáticas.aleatorio() * 20 + 5); 
 estado.espectadorPrecisión = Matemáticas.min(99, estado).espectadorPrecisión + 1); 
 documentar.getElementById("piezas de visualización").textContent = formatoNúmero(estado.viewerPieces); 
 documentar.getElementById("precisión de visualización").textContent = '${state.viewerPrecision}%'; 
const renderCatalogVersions = () => {
  if (!catalogVersionList) {
    return;
  }
  const items = catalogLibraries.map(
    (library) => `
      <div class="version-item">
        <strong>${library.name}</strong>
        <span>${library.profiles.length} perfiles · ${library.norm}</span>
        <small>Región ${library.region}</small>
      </div>
    `
  );
  catalogVersionList.innerHTML = items.join("");
};

const updateProgress = () => { 
 estado.progreso = Matemáticas.min(100, estado).progreso + 6); 
 barra const = documento.getElementById("barra de progreso"); 
 etiqueta const = documento.getElementById("etiqueta-progreso"); 
 bar.estilo.ancho = '${state.progress}%'; 
 etiqueta.textContent = 'Avance actual: ${state.progress}%'; 
const applyCatalogLibrary = (libraryId) => {
  const selected = catalogLibraries.find((library) => library.id === libraryId) || catalogLibraries[0];
  state.activeCatalogLibrary = selected.id;
  state.catalogProfiles = selected.profiles;
  renderCatalogTable();
  renderCatalogVersions();
  updateCatalogStatus(
    `Biblioteca activa: ${selected.name} · ${selected.profiles.length} perfiles (${selected.norm}).`
  );
};

const generateMaterials = () => { 
  materiales const = [ 
  { nombre: "Viga IPE 300", cantidad: 120, peso: "24 t", estado: "Listo" }, 
    { name: "Columna HEB 260", qty: 80, weight: "18 t", status: "En fabricación" },
    { name: "Placas de anclaje", qty: 300, weight: "4 t", status: "Corte CNC" },
    { name: "Pernos A325", qty: 2400, weight: "1.2 t", status: "Recepcionado" },
  ];
 const tbody = documento.getElementById("materials-table"); 
 Tbody.innerHTML = ""; 
 materiales.forEach((row) => { 
 const tr = document.createElement("tr"); 
 tr.innerHTML = ' 
      <td>${row.name}</td>
      <td>${row.qty}</td>
      <td>${row.weight}</td>
      <td>${row.status}</td>
    `;
 Tbody.appendChild(tr); 
const compareCatalogLibraries = () => {
  const active = catalogLibraries.find((library) => library.id === state.activeCatalogLibrary);
  if (!active) {
    updateCatalogStatus("Seleccioná una biblioteca para comparar.");
    return;
  }
  const counts = catalogLibraries.map((library) => `${library.name}: ${library.profiles.length}`).join(" · ");
  updateCatalogStatus(`Comparativa rápida: ${counts}. Activa: ${active.name}.`);
};

const exportCatalogLibrary = () => {
  const active = catalogLibraries.find((library) => library.id === state.activeCatalogLibrary);
  if (!active) {
    updateCatalogStatus("Seleccioná una biblioteca para exportar.");
    return;
  }
  const payload = {
    id: active.id,
    name: active.name,
    norm: active.norm,
    profiles: active.profiles,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rmm-catalog-${active.id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  updateCatalogStatus(`Biblioteca ${active.name} exportada.`);
};

const flowStages = [
  {
    title: "1️⃣ Cliente – Idea / Preventa",
    items: [
      "Define ancho, largo, altura y uso.",
      "Genera proyecto en estado IDEA.",
      "Métricas instantáneas: peso y costo estimado.",
      "No puede cambiar perfiles ni uniones.",
    ],
    goal: "Decisión comercial rápida y clara.",
  },
  {
    title: "2️⃣ Ingeniería – Definición Técnica",
    items: [
      "Cambia estado a INGENIERÍA.",
      "Define sistema estructural, perfiles y uniones.",
      "Valida reglas geométricas y dimensionales.",
    ],
    goal: "Modelo estructural correcto y fabricable.",
  },
  {
    title: "3️⃣ BIM / Coordinación",
    items: ["Revisión del modelo.", "Exportaciones IFC, DXF y PDF."],
    goal: "Modelo interoperable y limpio.",
  },
  {
    title: "4️⃣ Fabricación – Despiece",
    items: [
      "Consulta listados y ajusta uniones.",
      "Congela versión.",
      "Listado de materiales definitivo.",
    ],
    goal: "Fabricar sin reinterpretar.",
  },
  {
    title: "5️⃣ Obra / Montaje (Futuro)",
    items: ["Secuencia de montaje.", "Fases y revisión en obra."],
  },
  {
    title: "6️⃣ Versionado y trazabilidad",
    items: ["Nueva versión por cada cambio.", "Historial de decisiones."],
    goal: "Nunca se pierde información.",
  },
];

const industrialModules = [
  {
    id: "uniones_avanzadas",
    title: "Uniones industriales avanzadas",
    description: "Plantillas parametrizadas, rigidizadores y soldaduras detalladas.",
    status: "done",
  },
  {
    id: "planos_taller",
    title: "Planos de taller y montaje",
    description: "Generación automática de planos por pieza y conjunto.",
    status: "done",
  },
  {
    id: "dstv_cnc",
    title: "Export CNC / DSTV",
    description: "Salida directa para corte y taladrado automático.",
    status: "done",
  },
  {
    id: "control_calidad",
    title: "Control de calidad y trazabilidad",
    description: "Trazabilidad de piezas y registro de inspecciones.",
    status: "done",
  },
  {
    id: "montaje",
    title: "Secuencia de montaje",
    description: "Fases de montaje y logística de obra.",
    status: "done",
  },
];

const jointLibrary = [
  {
    id: "J-RIG-1",
    name: "Rigidizada con doble placa",
    type: "moment_connection",
    bolts: "M24",
    plate: "PL 12-20",
    stiffeners: true,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 8,
      minPlateThicknessMm: 12,
      requireStiffeners: true,
      notes: "Unión rígida con verificación de momento y cortante.",
    },
  },
  {
    id: "J-PIN-1",
    name: "Articulada con placa simple",
    type: "pinned_connection",
    bolts: "M20",
    plate: "PL 10-16",
    stiffeners: false,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 4,
      minPlateThicknessMm: 10,
      requireStiffeners: false,
      notes: "Permite rotación; controla cortante.",
    },
  },
  {
    id: "J-SHEAR-1",
    name: "Corte con ángulos",
    type: "shear_connection",
    bolts: "M20",
    plate: "L 75x6",
    stiffeners: false,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 4,
      minPlateThicknessMm: 6,
      requireStiffeners: false,
      notes: "Unión de corte con ángulos o placas simples.",
    },
  },
  {
    id: "J-SPL-1",
    name: "Empalme de columna",
    type: "splice_connection",
    bolts: "M24",
    plate: "PL 12-20",
    stiffeners: true,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 8,
      minPlateThicknessMm: 12,
      requireStiffeners: true,
      notes: "Empalme con control de compresión y tracción.",
    },
  },
  {
    id: "J-END-1",
    name: "Placa de extremo atornillada",
    type: "end_plate_connection",
    bolts: "M22",
    plate: "PL 12-20",
    stiffeners: true,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 6,
      minPlateThicknessMm: 12,
      requireStiffeners: true,
      notes: "Placa de extremo con rigidez elevada.",
    },
  },
  {
    id: "J-BASE-1",
    name: "Placa base con rigidizadores",
    type: "base_plate_connection",
    bolts: "M24",
    plate: "PL 20-30",
    stiffeners: true,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 4,
      minPlateThicknessMm: 20,
      requireStiffeners: true,
      notes: "Placa base con anclaje y rigidizadores.",
    },
  },
  {
    id: "J-HAUNCH-1",
    name: "Cartela de refuerzo",
    type: "haunch_connection",
    bolts: "M20",
    plate: "PL 10-16",
    stiffeners: true,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 4,
      minPlateThicknessMm: 10,
      requireStiffeners: true,
      notes: "Cartela para refuerzo en nudos.",
    },
  },
  {
    id: "J-ANG-1",
    name: "Unión con ángulo doble",
    type: "double_angle_connection",
    bolts: "M20",
    plate: "L 90x8",
    stiffeners: false,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 4,
      minPlateThicknessMm: 8,
      requireStiffeners: false,
      notes: "Ángulo doble para cargas de corte moderadas.",
    },
  },
  {
    id: "J-TS-1",
    name: "Placa de asiento (seat)",
    type: "seat_connection",
    bolts: "M20",
    plate: "PL 12-20",
    stiffeners: true,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 4,
      minPlateThicknessMm: 12,
      requireStiffeners: true,
      notes: "Soporte de viga con asiento y ala superior.",
    },
  },
  {
    id: "J-TS-2",
    name: "Shear tab",
    type: "shear_tab_connection",
    bolts: "M20",
    plate: "PL 10-16",
    stiffeners: false,
    norms: ["CIRSOC 101", "AISC 360"],
    rules: {
      minBolts: 4,
      minPlateThicknessMm: 10,
      requireStiffeners: false,
      notes: "Placa de alma para cortante (shear tab).",
    },
  },
];

const bimTreeData = [
  {
    title: "Proyecto",
    children: [
      {
        title: "Naves",
        children: [
          {
            title: "Pórticos",
            children: ["Columnas", "Vigas"],
          },
          "Correas",
          "Arriostramientos",
        ],
      },
    ],
  },
];

const stepButtons = document.querySelectorAll(".step");
const stepPanels = document.querySelectorAll(".step-panel");
const wizardSummary = document.getElementById("wizard-summary");
const wizardStatus = document.getElementById("wizard-status");
const wizardForm = document.getElementById("wizard-form");
const rulesList = document.getElementById("rules-list");
const rulesDetail = document.getElementById("rules-detail");
const rulesSummary = document.getElementById("rules-summary");
const shareStatus = document.getElementById("share-status");
const exportStatus = document.getElementById("export-status");
const flowCards = document.getElementById("flow-cards");
const versionList = document.getElementById("version-list");
const persistenceStatus = document.getElementById("persistence-status");
const geometryStatus = document.getElementById("geometry-status");
const detailStatus = document.getElementById("detail-status");
const catalogTableBody = document.getElementById("catalog-table-body");
const catalogStatus = document.getElementById("catalog-status");
const catalogCompanyInput = document.getElementById("catalog-company");
const catalogLibrarySelect = document.getElementById("catalog-library-select");
const catalogVersionList = document.getElementById("catalog-version-list");
const authStatus = document.getElementById("auth-status");
const authSupabaseStatus = document.getElementById("auth-supabase-status");
const authPermissions = document.getElementById("auth-permissions");
const authEmail = document.getElementById("auth-email");
const authRole = document.getElementById("auth-role");
const authForm = document.getElementById("auth-form");
const supabaseUrlInput = document.getElementById("supabase-url");
const supabaseKeyInput = document.getElementById("supabase-key");
const supabaseStatus = document.getElementById("supabase-status");
const orgIdInput = document.getElementById("org-id");
const projectIdInput = document.getElementById("project-id");
const analysisStatus = document.getElementById("analysis-status");
const analysisNormInput = document.getElementById("analysis-norm");
const analysisUseInput = document.getElementById("analysis-use");
const analysisWindInput = document.getElementById("analysis-wind");
const analysisSnowInput = document.getElementById("analysis-snow");
const analysisSeismicInput = document.getElementById("analysis-seismic");
const analysisImportanceInput = document.getElementById("analysis-importance");
const analysisResults = document.getElementById("analysis-results");
const drawingsStatus = document.getElementById("drawings-status");
const cncStatus = document.getElementById("cnc-status");
const fabricationStatus = document.getElementById("fabrication-status");

let supabaseClient = null;

const rolePermissions = {
  Cliente: ["view"],
  Ingeniero: ["view", "edit", "validate", "export"],
  Fabricador: ["view", "export"],
  Admin: ["view", "edit", "validate", "export", "manage"],
};

const getSession = () => {
  const raw = localStorage.getItem("rmm-session");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  localStorage.setItem("rmm-session", JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem("rmm-session");
};

const renderPermissions = (role) => {
  if (!authPermissions) {
    return;
  }
  const permissions = rolePermissions[role] || [];
  authPermissions.innerHTML = permissions.length
    ? permissions.map((perm) => `<li>${perm}</li>`).join("")
    : "<li>Sin permisos</li>";
};

const updateAuthUI = (session) => {
  if (!authStatus) {
    return;
  }
  if (!session) {
    authStatus.textContent = "Sin sesión activa.";
    renderPermissions(null);
    return;
  }
  authStatus.textContent = `Sesión activa: ${session.email} (${session.role}).`;
  renderPermissions(session.role);
};

const updateSupabaseAuthStatus = (message) => {
  if (!authSupabaseStatus) {
    return;
  }
  authSupabaseStatus.textContent = message;
};

const normalizeRole = (role) => {
  if (rolePermissions[role]) {
    return role;
  }
  return "Cliente";
};

const applySupabaseSession = (session) => {
  if (!session) {
    updateSupabaseAuthStatus("Sin sesión Supabase activa.");
    return;
  }
  const role = normalizeRole(session.user?.user_metadata?.role || "Cliente");
  const localSession = {
    email: session.user?.email || "usuario@empresa.com",
    role,
  };
  saveSession(localSession);
  updateAuthUI(localSession);
  updateSupabaseAuthStatus(`Supabase Auth: ${localSession.email}`);
};

const sendMagicLink = async () => {
  const client = ensureSupabase();
  if (!client) {
    updateSupabaseAuthStatus("Configura Supabase para usar magic link.");
    return;
  }
  const email = authEmail.value.trim();
  if (!email) {
    updateSupabaseAuthStatus("Ingresá un email válido.");
    return;
  }
  const { error } = await client.auth.signInWithOtp({ email });
  updateSupabaseAuthStatus(
    error ? `Error de autenticación: ${error.message}` : "Magic link enviado."
  );
};

const hasPermission = (permission) => {
  const session = getSession();
  if (!session) {
    return false;
  }
  const permissions = rolePermissions[session.role] || [];
  return permissions.includes(permission);
};

const setWizardStep = (step) => {
  state.wizardStep = step;
  stepButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.step) === step);
  });
  stepPanels.forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.step) === step);
  });
};

const updateWorkspace = (data) => { 
 documentar.getElementById("proyecto-espacio de trabajo").textoContenido = datos.proyecto; 
 documentar.getElementById("workspace-location").textoContenido = datos.ubicación; 
 documentar.getElementById("tonelada-espacio de trabajo").textContent = '${data.tonnage} t'; 
 documentar.getElementById("etapa de espacio de trabajo").textoContenido = datos.prácticas; 
const collectWizardData = () => {
  const data = Object.fromEntries(new FormData(wizardForm).entries());
  state.wizardData = data;
  wizardSummary.innerHTML = `
    <p><strong>Tipo:</strong> ${data.tipo}</p>
    <p><strong>Ubicación:</strong> ${data.ubicacion}</p>
    <p><strong>Dimensiones:</strong> ${data.ancho}m x ${data.largo}m · Altura ${data.altura}m</p>
    <p><strong>Pórticos:</strong> ${data.porticos}</p>
    <p><strong>Sistema:</strong> ${data.portico}, ${data.perfil}</p>
    <p><strong>Cubierta:</strong> ${data.cubierta} · Cerramientos ${data.cerramiento}</p>
  `;
};

const saveWorkspace = (data) => { 
 localStorage.setItem("rmm-workspace", JSON.stringify(data)); 
const summarizeResults = (results, title) => {
  const stats = results.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { ok: 0, warning: 0, error: 0 }
  );
  const status = stats.error > 0 ? "error" : stats.warning > 0 ? "warning" : "ok";
  return {
    status,
    message: `${title}: ${stats.ok} OK · ${stats.warning} warning · ${stats.error} error`,
  };
};

const loadWorkspace = () => { 
 const almacenado = localAlmacenamiento.getItem("rmm-workspace"); 
 si (!almacenado) devuelve null; 
  Prueba {
 devuelvo a JSON.analizar (almacenar); 
  } atrapar {
 return null; 
const renderBimTree = () => {
  const treeRoot = document.getElementById("bim-tree");
  treeRoot.innerHTML = "";
  const renderNode = (node, depth = 0) => {
    const wrapper = document.createElement("div");
    wrapper.className = "tree-item";
    wrapper.style.marginLeft = `${depth * 16}px`;
    wrapper.textContent = node.title || node;
    treeRoot.appendChild(wrapper);
    if (node.children) {
      node.children.forEach((child) => renderNode(child, depth + 1));
    }
  };
  bimTreeData.forEach((node) => renderNode(node));
};

const renderFlow = () => {
  flowCards.innerHTML = "";
  flowStages.forEach((stage) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${stage.title}</h3>
      <ul>${stage.items.map((item) => `<li>${item}</li>`).join("")}</ul>
      ${stage.goal ? `<p class="helper"><strong>Objetivo:</strong> ${stage.goal}</p>` : ""}
    `;
    flowCards.appendChild(card);
  });
};

const renderIndustrialModules = () => {
  const container = document.getElementById("industrial-modules");
  if (!container) {
    return;
  }
  const statusLabel = (status) => {
    if (status === "done") return "Completo";
    if (status === "in_progress") return "En curso";
    return "Pendiente";
  };
  container.innerHTML = industrialModules
    .map(
      (module) => `
      <div class="module-item">
        <div>
          <strong>${module.title}</strong>
          <p class="helper">${module.description}</p>
        </div>
        <span class="module-status ${module.status}">${statusLabel(module.status)}</span>
      </div>
    `
    )
    .join("");
  const total = industrialModules.length;
  const done = industrialModules.filter((module) => module.status === "done").length;
  const progress = document.getElementById("industrial-progress");
  if (progress) {
    progress.textContent = `Industrial BIM: ${done}/${total} módulos completos.`;
  }
};

documentar.addEventListener("DOMContentLoaded", () => { 
 documentar.querySelectorAll("[data-modal]").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const modal = documento.getElementById(botón.conjunto de datos.modal); 
 if (modal) openModal(modal); 
const renderJointLibrary = () => {
  const container = document.getElementById("joint-library");
  if (!container) {
    return;
  }
  const formatRules = (rules) => {
    if (!rules) {
      return "Reglas pendientes";
    }
    return `min bulones ${rules.minBolts} · espesor ≥ ${rules.minPlateThicknessMm}mm · ${
      rules.requireStiffeners ? "rigidizador" : "sin rigidizador"
    }`;
  };
  container.innerHTML = jointLibrary
    .map(
      (joint) => `
      <div class="module-item">
        <div>
          <strong>${joint.name}</strong>
          <p class="helper">${joint.type} · ${joint.bolts} · ${joint.plate}</p>
          <p class="helper">Normas: ${(joint.norms || []).join(", ")}</p>
          <p class="helper">${formatRules(joint.rules)}${joint.rules?.notes ? ` · ${joint.rules.notes}` : ""}</p>
        </div>
        <span class="module-status done">Lista</span>
      </div>
    `
    )
    .join("");
};

const renderRules = (results = []) => {
  rulesList.innerHTML = "";
  results.forEach((result, index) => {
    const rule = rulesCatalog[index];
    const item = document.createElement("div");
    item.className = "rule-item";
    item.innerHTML = `
      <div class="rule-status ${result.status}">${result.status}</div>
      <strong>${rule.title}</strong>
      <p>${result.message}</p>
    `;
    item.addEventListener("click", () => {
      document.querySelectorAll(".rule-item").forEach((el) =>
        el.classList.remove("active")
      );
      item.classList.add("active");
      rulesDetail.innerHTML = `
        <h3>${rule.title}</h3>
        <p>${rule.description}</p>
        <pre><code>${rule.code}</code></pre>
      `;
    });
    if (index === 0) {
      item.classList.add("active");
      rulesDetail.innerHTML = `
        <h3>${rule.title}</h3>
        <p>${rule.description}</p>
        <pre><code>${rule.code}</code></pre>
      `;
    }
    rulesList.appendChild(item);
  });
};

 documentar.querySelectorAll("[data-close]").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const modal = botón.el más cercano(".modal"); 
 si (modal) closeModal(modal); 
    });
const getStoredProjects = () => {
  const raw = localStorage.getItem("rmm-projects");
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const saveProjects = (projects) => {
  localStorage.setItem("rmm-projects", JSON.stringify(projects));
};

const buildProjectSnapshot = () => ({
  name: document.getElementById("project-name").value || "Proyecto sin nombre",
  client: document.getElementById("project-client").value || "Cliente no definido",
  orgId: orgIdInput?.value || "",
  projectId: projectIdInput?.value || "",
  wizard: state.wizardData,
  model: sampleModel,
  rules: state.rulesResults,
  catalogProfiles: state.catalogProfiles,
  savedAt: new Date().toISOString(),
});

const renderVersions = (projects) => {
  if (!versionList) {
    return;
  }
  if (projects.length === 0) {
    versionList.innerHTML = "<p class=\"helper\">No hay versiones guardadas.</p>";
    return;
  }
  versionList.innerHTML = projects
    .map(
      (project, index) => `
      <div class="version-card">
        <strong>v${projects.length - index}</strong>
        <span>${project.name}</span>
        <span>${new Date(project.savedAt).toLocaleString("es-AR")}</span>
      </div>
    `
    )
    .join("");
};

const saveProjectVersion = () => {
  collectWizardData();
  const projects = getStoredProjects();
  const snapshot = buildProjectSnapshot();
  projects.push(snapshot);
  saveProjects(projects);
  persistenceStatus.textContent = `Versión guardada: ${snapshot.name}.`;
  renderVersions(projects);
};

const loadLatestProject = () => {
  const projects = getStoredProjects();
  if (projects.length === 0) {
    return;
  }
  const latest = projects[projects.length - 1];
  document.getElementById("project-name").value = latest.name;
  document.getElementById("project-client").value = latest.client;
  if (orgIdInput) {
    orgIdInput.value = latest.orgId || "";
  }
  if (projectIdInput) {
    projectIdInput.value = latest.projectId || "";
  }
  if (latest.catalogProfiles?.length) {
    state.catalogProfiles = latest.catalogProfiles;
    renderCatalogTable();
  }
  persistenceStatus.textContent = `Última versión cargada: ${latest.name}.`;
  renderVersions(projects);
};

const exportProjectJson = () => {
  const snapshot = buildProjectSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${snapshot.name.replace(/\s+/g, "-").toLowerCase()}-bim.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  persistenceStatus.textContent = "JSON exportado.";
};

 documento.querySelectorAll(".modal").forEach((modal) => { 
 modal.addEventListener("click", (event) => { 
 si (evento.objetivo === capital) cerrarModal(capital); 
const loadSupabaseConfig = () => {
  const raw = localStorage.getItem("rmm-supabase");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveSupabaseConfig = (config) => {
  localStorage.setItem("rmm-supabase", JSON.stringify(config));
};

const initSupabase = () => {
  if (!window.supabase) {
    supabaseStatus.textContent = "SDK de Supabase no disponible.";
    updateSupabaseAuthStatus("SDK de Supabase no disponible.");
    return null;
  }
  const url = supabaseUrlInput.value.trim();
  const key = supabaseKeyInput.value.trim();
  if (!url || !key) {
    supabaseStatus.textContent = "Completa URL y Anon Key.";
    updateSupabaseAuthStatus("Completa URL y Anon Key.");
    return null;
  }
  supabaseClient = window.supabase.createClient(url, key);
  saveSupabaseConfig({ url, key });
  supabaseStatus.textContent = "Supabase conectado.";
  updateSupabaseAuthStatus("Supabase Auth listo.");
  return supabaseClient;
};

const ensureSupabase = () => supabaseClient || initSupabase();

const saveProjectRemote = async () => {
  if (!hasPermission("edit")) {
    supabaseStatus.textContent = "Permiso insuficiente para guardar en Supabase.";
    return;
  }
  const client = ensureSupabase();
  if (!client) {
    return;
  }
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (sessionError || !userId) {
    supabaseStatus.textContent = "Inicia sesión en Supabase para guardar versiones.";
    return;
  }
  collectWizardData();
  const snapshot = buildProjectSnapshot();
  const { error } = await client.from("project_versions").insert({
    owner_id: userId,
    org_id: snapshot.orgId || null,
    project_id: snapshot.projectId || null,
    project_name: snapshot.name,
    client_name: snapshot.client,
    bim_json: snapshot,
  });
  supabaseStatus.textContent = error
    ? `Error al guardar: ${error.message}`
    : "Versión guardada en Supabase.";
};

const loadProjectRemote = async () => {
  const client = ensureSupabase();
  if (!client) {
    return;
  }
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (sessionError || !userId) {
    supabaseStatus.textContent = "Inicia sesión en Supabase para cargar versiones.";
    return;
  }
  let query = client
    .from("project_versions")
    .select("bim_json, created_at")
    .eq("owner_id", userId);
  const projectId = projectIdInput?.value?.trim();
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) {
    supabaseStatus.textContent = `Error al cargar: ${error.message}`;
    return;
  }
  if (!data || data.length === 0) {
    supabaseStatus.textContent = "Sin versiones remotas.";
    return;
  }
  const snapshot = data[0].bim_json;
  document.getElementById("project-name").value = snapshot.name || "";
  document.getElementById("project-client").value = snapshot.client || "";
  if (orgIdInput) {
    orgIdInput.value = snapshot.orgId || "";
  }
  if (projectIdInput) {
    projectIdInput.value = snapshot.projectId || "";
  }
  if (snapshot.catalogProfiles?.length) {
    state.catalogProfiles = snapshot.catalogProfiles;
    renderCatalogTable();
  }
  supabaseStatus.textContent = `Última versión cargada (${new Date(
    data[0].created_at
  ).toLocaleString("es-AR")}).`;
};

const saveCatalogRemote = async () => {
  if (!hasPermission("edit")) {
    updateCatalogStatus("Permiso insuficiente para guardar el catálogo.");
    return;
  }
  const client = ensureSupabase();
  if (!client) {
    return;
  }
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (sessionError || !userId) {
    updateCatalogStatus("Inicia sesión en Supabase para guardar el catálogo.");
    return;
  }
  const profiles = getCatalogProfilesFromTable();
  state.catalogProfiles = profiles;
  const projectName = document.getElementById("project-name").value || "Proyecto";
  const orgId = orgIdInput?.value?.trim() || null;
  const projectId = projectIdInput?.value?.trim() || null;
  const companyName = catalogCompanyInput?.value || "";
  const { error } = await client.from("catalog_versions").insert({
    owner_id: userId,
    org_id: orgId,
    project_id: projectId,
    project_name: projectName,
    company_name: companyName,
    catalog_json: { profiles },
  });
  updateCatalogStatus(
    error ? `Error al guardar catálogo: ${error.message}` : "Catálogo guardado en Supabase."
  );
};

const loadCatalogRemote = async () => {
  const client = ensureSupabase();
  if (!client) {
    return;
  }
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (sessionError || !userId) {
    updateCatalogStatus("Inicia sesión en Supabase para cargar el catálogo.");
    return;
  }
  let query = client
    .from("catalog_versions")
    .select("catalog_json, created_at")
    .eq("owner_id", userId);
  const projectId = projectIdInput?.value?.trim();
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) {
    updateCatalogStatus(`Error al cargar catálogo: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    updateCatalogStatus("Sin catálogos remotos.");
    return;
  }
  const snapshot = data[0].catalog_json;
  state.catalogProfiles = snapshot?.profiles?.length ? snapshot.profiles : [...defaultCatalogProfiles];
  renderCatalogTable();
  updateCatalogStatus(
    `Catálogo cargado (${new Date(data[0].created_at).toLocaleString("es-AR")}).`
  );
};

const loadSupabaseSession = async () => {
  const client = ensureSupabase();
  if (!client) {
    return;
  }
  const { data } = await client.auth.getSession();
  applySupabaseSession(data?.session);
};

const normalizeVector = (vector) => {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!length) {
    return [0, 0, 0];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
};

const vectorSubtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const vectorCross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const vectorDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const buildLocalAxes = (start, end) => {
  const axisX = normalizeVector(vectorSubtract(end, start));
  const reference = Math.abs(axisX[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
  const axisY = normalizeVector(vectorCross(reference, axisX));
  const axisZ = normalizeVector(vectorCross(axisX, axisY));
  return { axisX, axisY, axisZ };
};

const toLocalCoords = (point, start, axes) => {
  const delta = vectorSubtract(point, start);
  return {
    u: vectorDot(delta, axes.axisX),
    v: vectorDot(delta, axes.axisY),
    w: vectorDot(delta, axes.axisZ),
  };
};

const buildSectionDefinition = (profileProps) => {
  const base = {
    h: profileProps.h || 0.2,
    b: profileProps.b || 0.1,
    tw: profileProps.tw || null,
    tf: profileProps.tf || null,
  };
  if (profileProps.type === "I") {
    return {
      type: "I",
      ...base,
      faces: {
        TOP_FLANGE: { width: base.b, thickness: base.tf || 0.01 },
        BOTTOM_FLANGE: { width: base.b, thickness: base.tf || 0.01 },
        WEB: { thickness: base.tw || 0.008, depth: base.h - 2 * (base.tf || 0.01) },
      },
    };
  }
  return {
    type: "RECT",
    ...base,
    faces: {
      TOP: { width: base.b, thickness: base.h },
      SIDE: { width: base.h, thickness: base.b },
    },
  };
};

const buildMachiningOperations = (element, profileProps) => {
  const [x1, y1, z1] = element.start;
  const [x2, y2, z2] = element.end;
  const length = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
  const axes = buildLocalAxes(element.start, element.end);
  const section = buildSectionDefinition(profileProps);
  const holes = (element.holes || []).map((hole) => {
    const local = toLocalCoords([hole.x || x1, hole.y || y1, hole.z || z1], element.start, axes);
    return {
      ...hole,
      face: hole.face || "WEB",
      diameter: hole.diameter || 0.018,
      local,
    };
  });
  const cuts = (element.cuts || []).map((cut) => {
    const side = cut.side || "end";
    const offset = side === "start" ? 0 : length;
    const face = cut.face || (cut.type === "cope" ? "TOP_FLANGE" : cut.type === "bevel" ? "END" : "WEB");
    return {
      ...cut,
      side,
      face,
      depth: cut.depth || 0.02,
      angle: cut.angle || 0,
      offset,
      local: {
        u: offset,
        v: 0,
        w: 0,
      },
    };
  });
  const welds = (element.welds || []).map((weld) => ({
    ...weld,
    face: weld.face || "WEB",
    size: weld.size || 0.006,
    length: weld.length || Math.min(0.2, length),
  }));
  return {
    length,
    axes,
    section,
    operations: {
      holes,
      cuts,
      welds,
    },
  };
};

const buildGeometry = () => {
  const { ancho, largo, altura, porticos } = state.wizardData;
  const width = Number(ancho || 24);
  const length = Number(largo || 60);
  const height = Number(altura || 8);
  const frames = Number(porticos || 10);
  const spacing = frames > 1 ? length / (frames - 1) : length;
  const elements = [];
  const details = [];
  const material = "S275";
  state.catalogProfiles = getCatalogProfilesFromTable();
  const profileCatalog = buildProfileCatalogMap(state.catalogProfiles);
  const fallbackProfile = Object.values(profileCatalog)[0] || {
    rMinMm: 0,
    weightKgM: 10,
  };
  const getProfileProps = (name) => profileCatalog[name] || fallbackProfile;
  const profileSelection = (state.wizardData.perfil || "ipe").toLowerCase();
  const profileSets = {
    ipe: {
      column: "IPE 300",
      beam: "IPE 360",
      purlin: "Z 200",
      bracing: "L 60x6",
    },
    hea: {
      column: "HEA 260",
      beam: "HEA 300",
      purlin: "Z 250",
      bracing: "L 75x6",
    },
    tubo: {
      column: "TUBO 200x100x8",
      beam: "TUBO 200x100x8",
      purlin: "TUBO 120x60x6",
      bracing: "TUBO 80x80x4",
    },
  };
  const fallbackProfiles = profileSets.ipe;
  const selectedProfiles = profileSets[profileSelection] || fallbackProfiles;
  const columnProfile = selectedProfiles.column;
  const beamProfile = selectedProfiles.beam;
  const purlinProfile = selectedProfiles.purlin;
  const bracingProfile = selectedProfiles.bracing;
  const ruleElements = [];

  const connectionCatalog = {
    rigido: {
      type: "moment_connection",
      plate: { thickness: 0.02, width: 0.28, height: 0.32 },
      stiffener: { thickness: 0.012, length: 0.2 },
      bolts: { size: "M20", count: 8 },
    },
    articulado: {
      type: "pinned_connection",
      plate: { thickness: 0.016, width: 0.26, height: 0.3 },
      stiffener: { thickness: 0.01, length: 0.18 },
      bolts: { size: "M20", count: 6 },
    },
    mixto: {
      type: "semi_rigid_connection",
      plate: { thickness: 0.018, width: 0.27, height: 0.31 },
      stiffener: { thickness: 0.011, length: 0.19 },
      bolts: { size: "M20", count: 7 },
    },
  };
  const portalType = (state.wizardData.portico || "rigido").toLowerCase();
  const connectionTemplate = connectionCatalog[portalType] || connectionCatalog.rigido;
  const connectionAxes = {
    left: [0, -1, 0],
    right: [0, 1, 0],
  };
  const assemblies = [];
  const pieceCounters = {
    column: 1,
    beam: 1,
    purlin: 1,
    bracing: 1,
    plate: 1,
    stiffener: 1,
    gusset: 1,
    splice: 1,
  };
  const buildPieceMark = (type) => {
    const prefix =
      type === "column"
        ? "C"
        : type === "beam"
          ? "B"
          : type === "purlin"
            ? "P"
            : type === "bracing"
              ? "BR"
              : type === "plate"
                ? "PL"
                : type === "stiffener"
                  ? "ST"
                  : type === "gusset"
                    ? "GS"
                    : "SP";
    const count = pieceCounters[type] || 1;
    pieceCounters[type] = count + 1;
    return `${prefix}-${String(count).padStart(2, "0")}`;
  };

  for (let i = 0; i < frames; i += 1) {
    const x = i * spacing;
    const assemblyId = `ASM-FR-${i + 1}`;
    const assemblyPieces = [];
    elements.push({
      id: `COL-${i + 1}-L`,
      type: "column",
      profile: columnProfile,
      material,
      mark: buildPieceMark("column"),
      assemblyId,
      finish: "Pintura industrial",
      qaStatus: "Pendiente",
      start: [x, 0, 0],
      end: [x, 0, height],
    });
    elements.push({
      id: `COL-${i + 1}-R`,
      type: "column",
      profile: columnProfile,
      material,
      mark: buildPieceMark("column"),
      assemblyId,
      cuts: [
        { type: "cope", side: "top", depth: 0.04, face: "TOP_FLANGE" },
        { type: "bevel", side: "top", angle: 0.12, depth: 0.02, face: "END" },
      ],
      finish: "Pintura industrial",
      qaStatus: "Pendiente",
      start: [x, width, 0],
      end: [x, width, height],
    });
    elements.push({
      id: `BEAM-${i + 1}`,
      type: "beam",
      profile: beamProfile,
      material,
      mark: buildPieceMark("beam"),
      assemblyId,
      cuts: [
        { type: "bevel", side: "start", angle: 0.17, depth: 0.02, face: "END" },
        { type: "bevel", side: "end", angle: 0.17, depth: 0.02, face: "END" },
      ],
      finish: "Pintura industrial",
      qaStatus: "Pendiente",
      holes: [
        { x: x + 0.4, y: 0.05, z: height, diameter: 0.018, face: "WEB", type: "drill" },
        { x: x + 0.4, y: width - 0.05, z: height, diameter: 0.018, face: "WEB", type: "drill" },
        { x: x + 0.6, y: 0.08, z: height, diameter: 0.016, face: "TOP_FLANGE", type: "slot" },
        { x: x + 0.6, y: width - 0.08, z: height, diameter: 0.016, face: "BOTTOM_FLANGE", type: "slot" },
      ],
      welds: [{ type: "filete", size: 0.006, length: 0.12 }],
      start: [x, 0, height],
      end: [x, width, height],
    });
    assemblyPieces.push(`COL-${i + 1}-L`, `COL-${i + 1}-R`, `BEAM-${i + 1}`);
    assemblies.push({
      id: assemblyId,
      name: `Marco ${i + 1}`,
      pieces: assemblyPieces,
      sequence: i + 1,
    });
    details.push({
      id: `BASE-${i + 1}-L`,
      type: "base_plate",
      profile: "PL 300x300x20",
      material,
      host: `COL-${i + 1}-L`,
      assemblyId,
      mark: buildPieceMark("plate"),
      origin: [x, 0, 0],
      width: 0.3,
      height: 0.3,
      thickness: 0.02,
      holes: [
        { x: x - 0.06, y: -0.06, diameter: 0.024, face: "TOP" },
        { x: x + 0.06, y: -0.06, diameter: 0.024, face: "TOP" },
        { x: x - 0.06, y: 0.06, diameter: 0.024, face: "TOP" },
        { x: x + 0.06, y: 0.06, diameter: 0.024, face: "TOP" },
      ],
      welds: [{ type: "filete", size: 0.008, length: 0.3 }],
    });
    details.push({
      id: `BASE-${i + 1}-R`,
      type: "base_plate",
      profile: "PL 300x300x20",
      material,
      host: `COL-${i + 1}-R`,
      assemblyId,
      mark: buildPieceMark("plate"),
      origin: [x, width, 0],
      width: 0.3,
      height: 0.3,
      thickness: 0.02,
      holes: [
        { x: x - 0.06, y: width - 0.06, diameter: 0.024, face: "TOP" },
        { x: x + 0.06, y: width - 0.06, diameter: 0.024, face: "TOP" },
        { x: x - 0.06, y: width + 0.06, diameter: 0.024, face: "TOP" },
        { x: x + 0.06, y: width + 0.06, diameter: 0.024, face: "TOP" },
      ],
      welds: [{ type: "filete", size: 0.008, length: 0.3 }],
    });
    details.push({
      id: `BOLTS-${i + 1}-L`,
      type: "bolt_group",
      profile: "M20 x 4",
      material: "A325",
      host: `COL-${i + 1}-L`,
      assemblyId,
      mark: buildPieceMark("plate"),
    });
    details.push({
      id: `BOLTS-${i + 1}-R`,
      type: "bolt_group",
      profile: "M20 x 4",
      material: "A325",
      host: `COL-${i + 1}-R`,
      assemblyId,
      mark: buildPieceMark("plate"),
    });
    const leftJointLocation = [x, 0, height];
    const rightJointLocation = [x, width, height];
    details.push({
      id: `JOINT-${i + 1}-L`,
      type: connectionTemplate.type,
      profile: `PL ${Math.round(connectionTemplate.plate.width * 1000)}x${Math.round(
        connectionTemplate.plate.height * 1000
      )}x${Math.round(connectionTemplate.plate.thickness * 1000)}`,
      material,
      host: `BEAM-${i + 1}`,
      assemblyId,
      mark: buildPieceMark("plate"),
      location: leftJointLocation,
      orientation: connectionAxes.left,
      plate: connectionTemplate.plate,
      stiffener: connectionTemplate.stiffener,
      bolts: connectionTemplate.bolts,
      holes: [
        { x: x + 0.1, y: 0.04, diameter: 0.02, face: "WEB" },
        { x: x + 0.1, y: 0.08, diameter: 0.02, face: "WEB" },
      ],
      welds: [{ type: "filete", size: 0.006, length: 0.2 }],
      beam: beamProfile,
      column: columnProfile,
      jointType: portalType,
    });
    details.push({
      id: `JOINT-${i + 1}-R`,
      type: connectionTemplate.type,
      profile: `PL ${Math.round(connectionTemplate.plate.width * 1000)}x${Math.round(
        connectionTemplate.plate.height * 1000
      )}x${Math.round(connectionTemplate.plate.thickness * 1000)}`,
      material,
      host: `BEAM-${i + 1}`,
      assemblyId,
      mark: buildPieceMark("plate"),
      location: rightJointLocation,
      orientation: connectionAxes.right,
      plate: connectionTemplate.plate,
      stiffener: connectionTemplate.stiffener,
      bolts: connectionTemplate.bolts,
      holes: [
        { x: x + 0.1, y: width - 0.04, diameter: 0.02, face: "WEB" },
        { x: x + 0.1, y: width - 0.08, diameter: 0.02, face: "WEB" },
      ],
      welds: [{ type: "filete", size: 0.006, length: 0.2 }],
      beam: beamProfile,
      column: columnProfile,
      jointType: portalType,
    });
    details.push({
      id: `STIFF-${i + 1}-L`,
      type: "stiffener_plate",
      profile: "PL 200x160x12",
      material,
      host: `COL-${i + 1}-L`,
      assemblyId,
      mark: buildPieceMark("stiffener"),
      location: leftJointLocation,
      origin: [leftJointLocation[0], leftJointLocation[1], leftJointLocation[2]],
      width: 0.2,
      height: 0.16,
      thickness: 0.012,
      plate: { width: 0.2, height: 0.16, thickness: 0.012 },
      welds: [{ type: "filete", size: 0.006, length: 0.18 }],
    });
    details.push({
      id: `STIFF-${i + 1}-R`,
      type: "stiffener_plate",
      profile: "PL 200x160x12",
      material,
      host: `COL-${i + 1}-R`,
      assemblyId,
      mark: buildPieceMark("stiffener"),
      location: rightJointLocation,
      origin: [rightJointLocation[0], rightJointLocation[1], rightJointLocation[2]],
      width: 0.2,
      height: 0.16,
      thickness: 0.012,
      plate: { width: 0.2, height: 0.16, thickness: 0.012 },
      welds: [{ type: "filete", size: 0.006, length: 0.18 }],
    });
    details.push({
      id: `ENDPL-${i + 1}`,
      type: "end_plate",
      profile: "PL 260x320x16",
      material,
      host: `BEAM-${i + 1}`,
      assemblyId,
      mark: buildPieceMark("plate"),
      location: [x, width / 2, height],
      origin: [x, width / 2, height],
      width: 0.26,
      height: 0.32,
      thickness: 0.016,
      plate: { width: 0.26, height: 0.32, thickness: 0.016 },
      bolts: { size: "M20", count: 8 },
      holes: [
        { x: x + 0.08, y: width / 2 - 0.06, diameter: 0.02, face: "TOP", type: "drill" },
        { x: x + 0.08, y: width / 2 + 0.06, diameter: 0.02, face: "TOP", type: "drill" },
        { x: x - 0.08, y: width / 2 - 0.06, diameter: 0.02, face: "TOP", type: "drill" },
        { x: x - 0.08, y: width / 2 + 0.06, diameter: 0.02, face: "TOP", type: "drill" },
      ],
    });
    const columnLengthMm = height * 1000;
    ruleElements.push({
      id: `COL-${i + 1}-L`,
      type: "column",
      length_mm: columnLengthMm,
      profile: { r_min_mm: getProfileProps(columnProfile).rMinMm },
    });
    ruleElements.push({
      id: `COL-${i + 1}-R`,
      type: "column",
      length_mm: columnLengthMm,
      profile: { r_min_mm: getProfileProps(columnProfile).rMinMm },
    });
  }

  const purlinCount = Math.max(2, Math.round(width / 4));
  for (let i = 0; i < purlinCount; i += 1) {
    const y = (width / (purlinCount + 1)) * (i + 1);
    elements.push({
      id: `PURLIN-${i + 1}`,
      type: "purlin",
      profile: purlinProfile,
      material,
      mark: buildPieceMark("purlin"),
      assemblyId: "ASM-CUBIERTA",
      finish: "Pintura industrial",
      qaStatus: "Pendiente",
      start: [0, y, height],
      end: [length, y, height],
    });
  }
  assemblies.push({
    id: "ASM-CUBIERTA",
    name: "Correas de cubierta",
    pieces: Array.from({ length: purlinCount }, (_, index) => `PURLIN-${index + 1}`),
    sequence: frames + 1,
  });

 documentar.querySelectorAll("[data-scroll]").forEach((button) => { 
 botón.addEventListener("click", () => { 
  objetivo const = documento.QuerySelector(botón.conjunto de datos.scroll); 
 si (objetivo) objetivo.scrollIntoView({ behavior: "smooth" }); 
  elements.push({
    id: "BRACE-1",
    type: "bracing",
    profile: bracingProfile,
    material,
    mark: buildPieceMark("bracing"),
    assemblyId: "ASM-ARRIOSTRE",
    cuts: [
      { type: "cope", side: "end", depth: 0.05, face: "END" },
      { type: "bevel", side: "end", angle: 0.2, depth: 0.02, face: "END" },
    ],
    finish: "Pintura industrial",
    qaStatus: "Pendiente",
    start: [0, 0, 0],
    end: [spacing, width, height],
  });
  assemblies.push({
    id: "ASM-ARRIOSTRE",
    name: "Arriostramiento principal",
    pieces: ["BRACE-1"],
    sequence: frames + 2,
  });
  details.push({
    id: "GUSSET-1",
    type: "gusset_plate",
    profile: "PL 220x220x12",
    material,
    host: "BRACE-1",
    assemblyId: "ASM-ARRIOSTRE",
    mark: buildPieceMark("gusset"),
    location: [spacing / 2, width / 2, height / 2],
    origin: [spacing / 2, width / 2, height / 2],
    width: 0.22,
    height: 0.22,
    thickness: 0.012,
    plate: { width: 0.22, height: 0.22, thickness: 0.012 },
    bolts: { size: "M16", count: 4 },
    holes: [
      { x: spacing / 2 - 0.05, y: width / 2 - 0.05, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing / 2 + 0.05, y: width / 2 - 0.05, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing / 2 - 0.05, y: width / 2 + 0.05, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing / 2 + 0.05, y: width / 2 + 0.05, diameter: 0.016, face: "TOP", type: "drill" },
    ],
  });
  details.push({
    id: "SPLICE-1",
    type: "splice_plate",
    profile: "PL 240x180x12",
    material,
    host: "BRACE-1",
    assemblyId: "ASM-ARRIOSTRE",
    mark: buildPieceMark("splice"),
    location: [spacing * 0.75, width * 0.75, height * 0.75],
    origin: [spacing * 0.75, width * 0.75, height * 0.75],
    width: 0.24,
    height: 0.18,
    thickness: 0.012,
    plate: { width: 0.24, height: 0.18, thickness: 0.012 },
    bolts: { size: "M16", count: 6 },
    holes: [
      { x: spacing * 0.75 - 0.06, y: width * 0.75 - 0.04, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing * 0.75, y: width * 0.75 - 0.04, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing * 0.75 + 0.06, y: width * 0.75 - 0.04, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing * 0.75 - 0.06, y: width * 0.75 + 0.04, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing * 0.75, y: width * 0.75 + 0.04, diameter: 0.016, face: "TOP", type: "drill" },
      { x: spacing * 0.75 + 0.06, y: width * 0.75 + 0.04, diameter: 0.016, face: "TOP", type: "drill" },
    ],
  });

  const bracingCoverage = Math.min(length, spacing * 2);
  sampleModel.bracing.longitudinal = [
    { id: "BR-1", type: "cross", from: 0, to: bracingCoverage },
  ];
  sampleModel.building.length = length;
  sampleModel.geometry.spansOk = width >= 10 && width <= 60;
  sampleModel.geometry.heightsOk = height >= 4 && height <= 16;
  sampleModel.geometry.portalSpacingOk = spacing <= 8;
  sampleModel.stability.lateralSystemOk = true;
  sampleModel.stability.loadPathOk = details.length > 0;
  sampleModel.roof.diaphragmContinuous = purlinCount >= 3;
  sampleModel.foundation.columnsAnchored = details.some((d) => d.type === "bolt_group");
  sampleModel.foundation.columnsWithFoundation = details.some((d) => d.type === "base_plate");
  sampleModel.fabrication.jointsDefined = details.length > 0;
  sampleModel.fabrication.profilesCatalogOk = [
    columnProfile,
    beamProfile,
    purlinProfile,
    bracingProfile,
  ].every((profile) => Boolean(profileCatalog[profile]));
  sampleModel.fabrication.maxPieceLength = Math.max(height, width, spacing);
  sampleModel.cost.totalWeightKg = Math.round(
    elements.reduce((sum, el) => {
      const [x1, y1, z1] = el.start;
      const [x2, y2, z2] = el.end;
      const lengthM = Math.sqrt(
        Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
      );
      const weight = getProfileProps(el.profile).weightKgM || 10;
      return sum + lengthM * weight;
    }, 0)
  );

  const elementsWithMachining = elements.map((el) => ({
    ...el,
    machining: buildMachiningOperations(el, getProfileProps(el.profile)),
  }));
  const detailWithMachining = details.map((detail) => ({
    ...detail,
    machining: detail.holes?.length
      ? {
          length: detail.width || detail.height || 0.3,
          axes: buildLocalAxes([0, 0, 0], [detail.width || 0.3, 0, 0]),
          section: {
            type: "PLATE",
            h: detail.height || 0.3,
            b: detail.width || 0.3,
            tw: detail.thickness || 0.02,
            tf: detail.thickness || 0.02,
          },
          operations: {
            holes: detail.holes.map((hole) => {
              const origin = detail.origin || [0, 0, 0];
              return {
                ...hole,
                face: hole.face || "TOP",
                local: {
                  u: (hole.x ?? origin[0]) - origin[0],
                  v: (hole.y ?? origin[1]) - origin[1],
                  w: (hole.z ?? origin[2]) - origin[2],
                },
              };
            }),
            cuts: [],
            welds: detail.welds || [],
          },
        }
      : null,
  }));
  sampleModel.geometryElements = elementsWithMachining;
  sampleModel.detailElements = detailWithMachining;
  sampleModel.elements = ruleElements;
  sampleModel.assemblies = assemblies;
  geometryStatus.textContent = `Geometría generada: ${elements.length} elementos (ancho ${width}m · largo ${length}m · altura ${height}m).`;
  detailStatus.textContent = `Detalle generado: ${details.length} componentes (placas, bulones y uniones).`;
  return elements;
};

const exportDxf = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const detailElements = sampleModel.detailElements || [];
  const lines = elements
    .map((el) => {
      const [x1, y1, z1] = el.start;
      const [x2, y2, z2] = el.end;
      return [
        "0",
        "LINE",
        "8",
        el.type.toUpperCase(),
        "10",
        x1,
        "20",
        y1,
        "30",
        z1,
        "11",
        x2,
        "21",
        y2,
        "31",
        z2,
      ].join("\n");
    })
    .join("\n");

  const findHost = (hostId) => elements.find((el) => el.id === hostId);
  const detailEntities = detailElements
    .map((detail) => {
      const host = findHost(detail.host);
      if (!host) {
        return "";
      }
      const [x, y] = host.start;
      if (detail.type === "base_plate") {
        const plateWidth = detail.width || 0.3;
        const plateHeight = detail.height || 0.3;
        const halfW = plateWidth / 2;
        const halfH = plateHeight / 2;
        const points = [
          [x - halfW, y - halfH],
          [x + halfW, y - halfH],
          [x + halfW, y + halfH],
          [x - halfW, y + halfH],
        ];
        return [
          "0",
          "LWPOLYLINE",
          "8",
          "PLATES",
          "90",
          "4",
          "70",
          "1",
          ...points.flatMap(([px, py]) => ["10", px, "20", py]),
        ].join("\n");
      }
      if (detail.type === "bolt_group") {
        const offset = 0.05;
        const points = [
          [x - offset, y - offset],
          [x + offset, y - offset],
          [x + offset, y + offset],
          [x - offset, y + offset],
        ];
        return points
          .map((pt) => ["0", "POINT", "8", "BOLTS", "10", pt[0], "20", pt[1], "30", 0].join("\n"))
          .join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const dxfContent = [
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    lines,
    detailEntities,
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ].join("\n");

  const blob = new Blob([dxfContent], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-structure.dxf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportIfc = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const detailElements = sampleModel.detailElements || [];
  const assemblies = sampleModel.assemblies || [];
  const now = new Date().toISOString();
  let lineId = 0;
  const nextId = () => `#${(lineId += 1)}`;
  const entities = [];
  const elementIdMap = new Map();
  const guidChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  const guidCache = {};
  const createIfcGuid = (seed) => {
    if (guidCache[seed]) {
      return guidCache[seed];
    }
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    let value = hash ^ 0x9e3779b9;
    let guid = "";
    for (let i = 0; i < 22; i += 1) {
      value = (value * 1103515245 + 12345) >>> 0;
      guid += guidChars[value % guidChars.length];
    }
    guidCache[seed] = guid;
    return guid;
  };

  const ownerHistory = nextId();
  const context = nextId();
  const project = nextId();
  const sitePlacement = nextId();
  const site = nextId();
  const buildingPlacement = nextId();
  const building = nextId();
  const storeyPlacement = nextId();
  const storey = nextId();
  const relAggregates = nextId();
  const relContained = nextId();

  entities.push(`${ownerHistory}=IFCOWNERHISTORY($,$,$,$,$,$,$,0);`);
  const originPoint = nextId();
  entities.push(`${originPoint}=IFCCARTESIANPOINT((0.0,0.0,0.0));`);
  const origin = nextId();
  entities.push(`${origin}=IFCAXIS2PLACEMENT3D(${originPoint},$,$);`);
  entities.push(
    `${context}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-05,${origin},$);`
  );
  const lengthUnit = nextId();
  const areaUnit = nextId();
  const volumeUnit = nextId();
  entities.push(`${lengthUnit}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);
  entities.push(`${areaUnit}=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);`);
  entities.push(`${volumeUnit}=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);`);
  const unitAssignment = nextId();
  entities.push(`${unitAssignment}=IFCUNITASSIGNMENT((${lengthUnit},${areaUnit},${volumeUnit}));`);
  entities.push(
    `${project}=IFCPROJECT('${createIfcGuid("project")}',${ownerHistory},'RMM Project',$,$,$,$,(${context}),${unitAssignment});`
  );
  entities.push(`${sitePlacement}=IFCLOCALPLACEMENT($,${origin});`);
  entities.push(
    `${site}=IFCSITE('${createIfcGuid("site")}',${ownerHistory},'Site',$,$,${sitePlacement},$,$,.ELEMENT.,$,$,$,$,$);`
  );
  entities.push(`${buildingPlacement}=IFCLOCALPLACEMENT(${sitePlacement},${origin});`);
  entities.push(
    `${building}=IFCBUILDING('${createIfcGuid("building")}',${ownerHistory},'Building',$,$,${buildingPlacement},$,$,.ELEMENT.,$,$,$);`
  );
  entities.push(`${storeyPlacement}=IFCLOCALPLACEMENT(${buildingPlacement},${origin});`);
  entities.push(
    `${storey}=IFCBUILDINGSTOREY('${createIfcGuid("storey")}',${ownerHistory},'Storey',$,$,${storeyPlacement},$,$,.ELEMENT.,0.0);`
  );
  entities.push(
    `${relAggregates}=IFCRELAGGREGATES('4',${ownerHistory},$,$,${project},(${site}));`
  );
  entities.push(
    `${nextId()}=IFCRELAGGREGATES('5',${ownerHistory},$,$,${site},(${building}));`
  );
  entities.push(
    `${nextId()}=IFCRELAGGREGATES('6',${ownerHistory},$,$,${building},(${storey}));`
  );

  const createPoint = (point) => {
    const id = nextId();
    entities.push(
      `${id}=IFCCARTESIANPOINT((${point.map((n) => n.toFixed(3)).join(",")}));`
    );
    return id;
  };

  const createAxisPlacement = (point) => {
    const pointId = createPoint(point);
    const id = nextId();
    entities.push(`${id}=IFCAXIS2PLACEMENT3D(${pointId},$,$);`);
    return id;
  };

  const createPolyline = (start, end) => {
    const startId = createPoint(start);
    const endId = createPoint(end);
    const id = nextId();
    entities.push(`${id}=IFCPOLYLINE((${startId},${endId}));`);
    return id;
  };

  const createDirection = (vector) => {
    const id = nextId();
    entities.push(`${id}=IFCDIRECTION((${vector.map((n) => n.toFixed(6)).join(",")}));`);
    return id;
  };

  const createExtrusionPlacement = (point) => {
    const originId = createPoint(point);
    const axis = createDirection([0, 0, 1]);
    const refDir = createDirection([1, 0, 0]);
    const id = nextId();
    entities.push(`${id}=IFCAXIS2PLACEMENT3D(${originId},${axis},${refDir});`);
    return id;
  };

  const profileCatalog = buildProfileCatalogMap(
    state.catalogProfiles.length ? state.catalogProfiles : defaultCatalogProfiles
  );
  const defaultIfcProps = {
    type: "RECT",
    h: 0.1,
    b: 0.1,
    tw: 0.005,
    tf: 0.005,
    weightKgM: 0,
  };

  const materialCache = {};
  const createMaterial = (materialName = "S275") => {
    if (materialCache[materialName]) {
      return materialCache[materialName];
    }
    const id = nextId();
    entities.push(`${id}=IFCMATERIAL('${materialName}');`);
    materialCache[materialName] = id;
    return id;
  };

  const createMaterialAssociation = (elementId, materialName) => {
    const materialId = createMaterial(materialName || "S275");
    const relId = nextId();
    entities.push(
      `${relId}=IFCRELASSOCIATESMATERIAL('${elementId}-MAT',${ownerHistory},$,$,(${elementId}),${materialId});`
    );
  };

  const profileCache = {};
  const createProfile = (profileName = "IPE 300") => {
    if (profileCache[profileName]) {
      return profileCache[profileName];
    }
    const props = profileCatalog[profileName] || Object.values(profileCatalog)[0] || defaultIfcProps;
    if (props.type === "I") {
      const id = nextId();
      const tw = props.tw ?? 0.001;
      const tf = props.tf ?? 0.001;
      entities.push(
        `${id}=IFCISHAPEPROFILEDEF(.AREA.,'${profileName}',$,${props.h.toFixed(3)},${props.b.toFixed(
          3
        )},${tw.toFixed(4)},${tf.toFixed(4)},$, $);`
      );
      profileCache[profileName] = id;
      return id;
    }
    const id = nextId();
    entities.push(
      `${id}=IFCRECTANGLEPROFILEDEF(.AREA.,'${profileName}',$,${props.b.toFixed(3)},${props.h.toFixed(
        3
      )});`
    );
    profileCache[profileName] = id;
    return id;
  };

  const propertySetCache = {};
  const createSingleValue = (name, valueId) => {
    const id = nextId();
    entities.push(`${id}=IFCPROPERTYSINGLEVALUE('${name}',$,${valueId},$);`);
    return id;
  };

  const createLabel = (value) => {
    const id = nextId();
    entities.push(`${id}=IFCLABEL('${value}');`);
    return id;
  };

  const createReal = (value) => {
    const id = nextId();
    entities.push(`${id}=IFCREAL(${Number(value).toFixed(3)});`);
    return id;
  };

  const createPropertySet = (elementId, props) => {
    const cacheKey = JSON.stringify(props);
    if (!propertySetCache[cacheKey]) {
      const propertyIds = [];
      propertyIds.push(createSingleValue("Profile", createLabel(props.profile || "-")));
      propertyIds.push(createSingleValue("Material", createLabel(props.material || "-")));
      propertyIds.push(createSingleValue("Role", createLabel(props.role || "-")));
      propertyIds.push(createSingleValue("Norm", createLabel(props.norm || "-")));
      propertyIds.push(createSingleValue("Manufacturer", createLabel(props.manufacturer || "-")));
      propertyIds.push(createSingleValue("WeightPerMeter", createReal(props.weightKgM || 0)));
      propertyIds.push(createSingleValue("Length", createReal(props.length || 0)));
      propertyIds.push(createSingleValue("SectionHeight", createReal(props.h || 0)));
      propertyIds.push(createSingleValue("SectionWidth", createReal(props.b || 0)));
      propertyIds.push(createSingleValue("SectionModulus", createReal(props.sectionModulus || 0)));
      propertyIds.push(createSingleValue("Assembly", createLabel(props.assemblyId || "-")));
      propertyIds.push(createSingleValue("PieceMark", createLabel(props.mark || "-")));
      propertyIds.push(createSingleValue("Finish", createLabel(props.finish || "Pintado")));
      propertyIds.push(createSingleValue("QAStatus", createLabel(props.qaStatus || "Pendiente")));
      const setId = nextId();
      entities.push(
        `${setId}=IFCPROPERTYSET('Pset_${props.role || "Structural"}',${ownerHistory},'Pset_Structural',$,(${propertyIds.join(
          ","
        )}));`
      );
      propertySetCache[cacheKey] = setId;
    }
    const relId = nextId();
    entities.push(
      `${relId}=IFCRELDEFINESBYPROPERTIES('${elementId}-PSET',${ownerHistory},$,$,(${elementId}),${propertySetCache[cacheKey]});`
    );
  };

  const createFabricationSet = (elementId, element) => {
    const machining = element.machining?.operations;
    if (!machining) {
      return;
    }
    const holes = machining.holes || [];
    const cuts = machining.cuts || [];
    const welds = machining.welds || [];
    const holeTypes = Array.from(
      new Set(holes.map((hole) => String(hole.type || "drill").toUpperCase()))
    ).join("|");
    const propertyIds = [
      createSingleValue("HoleCount", createReal(holes.length)),
      createSingleValue("CutCount", createReal(cuts.length)),
      createSingleValue("WeldCount", createReal(welds.length)),
      createSingleValue("HoleTypes", createLabel(holeTypes || "-")),
    ];
    const setId = nextId();
    entities.push(
      `${setId}=IFCPROPERTYSET('Pset_Fabrication',${ownerHistory},'Pset_Fabrication',$,(${propertyIds.join(
        ","
      )}));`
    );
    const relId = nextId();
    entities.push(
      `${relId}=IFCRELDEFINESBYPROPERTIES('${elementId}-FAB',${ownerHistory},$,$,(${elementId}),${setId});`
    );
  };

  const classificationCache = {};
  const createClassification = (name, source) => {
    const key = `${name}-${source}`;
    if (classificationCache[key]) {
      return classificationCache[key];
    }
    const id = nextId();
    entities.push(`${id}=IFCCLASSIFICATION('${source}','${name}',$,$,$);`);
    classificationCache[key] = id;
    return id;
  };

  const createClassificationReference = (name, identification, classificationId) => {
    const id = nextId();
    entities.push(
      `${id}=IFCCLASSIFICATIONREFERENCE('${identification}','${name}',$,${classificationId},$);`
    );
    return id;
  };

  const createClassificationAssociation = (elementId, role) => {
    const classificationId = createClassification("RMM Structural Roles", "RMM");
    const referenceId = createClassificationReference(role, role, classificationId);
    const relId = nextId();
    entities.push(
      `${relId}=IFCRELASSOCIATESCLASSIFICATION('${elementId}-CLASS',${ownerHistory},$,$,(${elementId}),${referenceId});`
    );
  };

  const createStandardClassificationAssociation = (elementId, systemName, identification, name) => {
    const classificationId = createClassification(systemName, systemName);
    const referenceId = createClassificationReference(name, identification, classificationId);
    const relId = nextId();
    entities.push(
      `${relId}=IFCRELASSOCIATESCLASSIFICATION('${elementId}-${systemName}',${ownerHistory},$,$,(${elementId}),${referenceId});`
    );
  };

  const elementIds = [];
  const assemblyIdMap = new Map();
  const buildElement = (element, ifcType) => {
    const axisPlacement = createAxisPlacement(element.start);
    const localPlacement = nextId();
    entities.push(`${localPlacement}=IFCLOCALPLACEMENT(${storeyPlacement},${axisPlacement});`);
    const axisPolyline = createPolyline(element.start, element.end);
    const axisRep = nextId();
    entities.push(`${axisRep}=IFCSHAPEREPRESENTATION(${context},'Axis','Curve2D',(${axisPolyline}));`);

    const profileId = createProfile(element.profile);
    const [x1, y1, z1] = element.start;
    const [x2, y2, z2] = element.end;
    const length = Math.sqrt(
      Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
    );
    const dirVector = [
      (x2 - x1) / (length || 1),
      (y2 - y1) / (length || 1),
      (z2 - z1) / (length || 1),
    ];
    const extrusionPlacement = createExtrusionPlacement([x1, y1, z1]);
    const extrudedSolid = nextId();
    const extrusionDir = createDirection(dirVector);
    entities.push(
      `${extrudedSolid}=IFCEXTRUDEDAREASOLID(${profileId},${extrusionPlacement},${extrusionDir},${length.toFixed(
        3
      )});`
    );
    const bodyRep = nextId();
    entities.push(`${bodyRep}=IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${extrudedSolid}));`);

    const productDef = nextId();
    entities.push(`${productDef}=IFCPRODUCTDEFINITIONSHAPE($,$,(${axisRep},${bodyRep}));`);
    const elementId = nextId();
    const guid = createIfcGuid(element.id);
    entities.push(
      `${elementId}=${ifcType}('${guid}',${ownerHistory},'${element.id}',$,$,${localPlacement},${productDef},$,$);`
    );
    elementIds.push(elementId);
    elementIdMap.set(element.id, elementId);
    if (element.material) {
      createMaterialAssociation(elementId, element.material);
    }
    const role =
      element.type === "column" || element.type === "beam"
        ? "primary_member"
        : element.type === "purlin" || element.type === "bracing"
        ? "secondary_member"
        : "connection";
    const profileProps = profileCatalog[element.profile] || defaultIfcProps;
    const sectionProps = computeSectionProperties(profileProps);
    createPropertySet(elementId, {
      profile: element.profile,
      material: element.material,
      role,
      norm: "CIRSOC 101",
      manufacturer: "RMM",
      weightKgM: profileProps.weightKgM,
      length,
      h: profileProps.h,
      b: profileProps.b,
      sectionModulus: sectionProps.sectionModulus,
      assemblyId: element.assemblyId,
      mark: element.mark,
      finish: element.finish,
      qaStatus: element.qaStatus,
    });
    createClassificationAssociation(elementId, role);
    createFabricationSet(elementId, element);
    const classificationMap = {
      column: { system: "Uniclass 2015", code: "Pr_35_90_96_11", name: "Steel columns" },
      beam: { system: "Uniclass 2015", code: "Pr_35_90_96_14", name: "Steel beams" },
      purlin: { system: "Uniclass 2015", code: "Pr_35_90_96_69", name: "Steel purlins" },
      bracing: { system: "Uniclass 2015", code: "Pr_35_90_96_16", name: "Steel bracing" },
    };
    const classification = classificationMap[element.type];
    if (classification) {
      createStandardClassificationAssociation(
        elementId,
        classification.system,
        classification.code,
        classification.name
      );
    }
    return elementId;
  };

  const buildPlateElement = (detail) => {
    const location = detail.location || [0, 0, 0];
    const width = detail.width || 0.3;
    const height = detail.height || 0.3;
    const thickness = detail.thickness || 0.02;
    const axisPlacement = createAxisPlacement(location);
    const localPlacement = nextId();
    entities.push(`${localPlacement}=IFCLOCALPLACEMENT(${storeyPlacement},${axisPlacement});`);
    const profileId = nextId();
    entities.push(
      `${profileId}=IFCRECTANGLEPROFILEDEF(.AREA.,'${detail.profile || "PLATE"}',$,${width.toFixed(
        3
      )},${height.toFixed(3)});`
    );
    const extrusionPlacement = createExtrusionPlacement(location);
    const extrudedSolid = nextId();
    const extrusionDir = createDirection([0, 0, 1]);
    entities.push(
      `${extrudedSolid}=IFCEXTRUDEDAREASOLID(${profileId},${extrusionPlacement},${extrusionDir},${thickness.toFixed(
        3
      )});`
    );
    const bodyRep = nextId();
    entities.push(`${bodyRep}=IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${extrudedSolid}));`);
    const productDef = nextId();
    entities.push(`${productDef}=IFCPRODUCTDEFINITIONSHAPE($,$,(${bodyRep}));`);
    const elementId = nextId();
    const guid = createIfcGuid(detail.id);
    entities.push(
      `${elementId}=IFCPLATE('${guid}',${ownerHistory},'${detail.id}',$,$,${localPlacement},${productDef},$,$);`
    );
    elementIds.push(elementId);
    elementIdMap.set(detail.id, elementId);
    createMaterialAssociation(elementId, detail.material || "S275");
    createPropertySet(elementId, {
      profile: detail.profile,
      material: detail.material,
      role: "connection",
      norm: "CIRSOC 101",
      manufacturer: "RMM",
      weightKgM: 0,
      length: thickness,
      h: height,
      b: width,
      assemblyId: detail.assemblyId,
      mark: detail.mark || detail.id,
      finish: detail.finish || "Pintado",
      qaStatus: detail.qaStatus || "Pendiente",
    });
    createClassificationAssociation(elementId, "connection");
    createFabricationSet(elementId, detail);
    createStandardClassificationAssociation(
      elementId,
      "Uniclass 2015",
      "Pr_35_90_30_11",
      "Plates"
    );
    return elementId;
  };

  const buildFastenerElement = (detail) => {
    const location = detail.location || [0, 0, 0];
    const diameter = 0.02;
    const boltLength = 0.06;
    const axisPlacement = createAxisPlacement(location);
    const localPlacement = nextId();
    entities.push(`${localPlacement}=IFCLOCALPLACEMENT(${storeyPlacement},${axisPlacement});`);
    const profileId = nextId();
    entities.push(`${profileId}=IFCCIRCLEPROFILEDEF(.AREA.,'${detail.profile || "BOLT"}',$,${(
      diameter / 2
    ).toFixed(3)});`);
    const extrusionPlacement = createExtrusionPlacement(location);
    const extrudedSolid = nextId();
    const extrusionDir = createDirection([0, 0, 1]);
    entities.push(
      `${extrudedSolid}=IFCEXTRUDEDAREASOLID(${profileId},${extrusionPlacement},${extrusionDir},${boltLength.toFixed(
        3
      )});`
    );
    const bodyRep = nextId();
    entities.push(`${bodyRep}=IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${extrudedSolid}));`);
    const productDef = nextId();
    entities.push(`${productDef}=IFCPRODUCTDEFINITIONSHAPE($,$,(${bodyRep}));`);
    const elementId = nextId();
    const guid = createIfcGuid(detail.id);
    entities.push(
      `${elementId}=IFCFASTENER('${guid}',${ownerHistory},'${detail.id}',$,$,${localPlacement},${productDef},$,$);`
    );
    elementIds.push(elementId);
    elementIdMap.set(detail.id, elementId);
    createMaterialAssociation(elementId, detail.material || "A325");
    createPropertySet(elementId, {
      profile: detail.profile,
      material: detail.material,
      role: "connection",
      norm: "CIRSOC 101",
      manufacturer: "RMM",
      weightKgM: 0,
      length: boltLength,
      h: diameter,
      b: diameter,
      assemblyId: detail.assemblyId,
      mark: detail.mark || detail.id,
      finish: detail.finish || "Galvanizado",
      qaStatus: detail.qaStatus || "Pendiente",
    });
    createClassificationAssociation(elementId, "connection");
    createFabricationSet(elementId, detail);
    createStandardClassificationAssociation(
      elementId,
      "Uniclass 2015",
      "Pr_35_90_33_30",
      "Fasteners"
    );
    return elementId;
  };

  elements.forEach((element) => {
    const ifcType =
      element.type === "column"
        ? "IFCCOLUMN"
        : element.type === "beam"
        ? "IFCBEAM"
        : "IFCMEMBER";
    buildElement(element, ifcType);
  });

  detailElements.forEach((detail) => {
    const host = elements.find((el) => el.id === detail.host);
    const location = detail.location || (host ? host.start : [0, 0, 0]);
    if (detail.type === "base_plate") {
      buildPlateElement({ ...detail, location });
      return;
    }
    if (detail.type === "bolt_group") {
      buildFastenerElement({ ...detail, location });
      return;
    }
    const elementId = buildElement(
      {
        id: detail.id,
        start: location,
        end: location,
        profile: detail.profile,
        material: detail.material,
        assemblyId: detail.assemblyId,
        finish: detail.finish,
        qaStatus: detail.qaStatus,
        machining: detail.machining,
      },
      "IFCPROXY"
    );
    createStandardClassificationAssociation(
      elementId,
      "Uniclass 2015",
      "Pr_35_90_30_99",
      "Connections"
    );
  });

  assemblies.forEach((assembly) => {
    const axisPlacement = createAxisPlacement([0, 0, 0]);
    const localPlacement = nextId();
    entities.push(`${localPlacement}=IFCLOCALPLACEMENT(${storeyPlacement},${axisPlacement});`);
    const assemblyId = nextId();
    entities.push(
      `${assemblyId}=IFCELEMENTASSEMBLY('${createIfcGuid(assembly.id)}',${ownerHistory},'${assembly.id}','${
        assembly.name || ""
      }',$,${localPlacement},$,$,.NOTDEFINED.);`
    );
    assemblyIdMap.set(assembly.id, assemblyId);
    elementIds.push(assemblyId);
    const related = (assembly.pieces || [])
      .map((pieceId) => elementIdMap.get(pieceId))
      .filter(Boolean);
    if (related.length) {
      const relId = nextId();
      entities.push(
        `${relId}=IFCRELAGGREGATES('${createIfcGuid(`${assembly.id}-REL`)}',${ownerHistory},$,$,${assemblyId},(${related.join(
          ","
        )}));`
      );
    }
  });

  entities.push(
    `${relContained}=IFCRELCONTAINEDINSPATIALSTRUCTURE('7',${ownerHistory},$,$,(${elementIds.join(
      ","
    )}),${storey});`
  );

  const header = [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
    `FILE_NAME('rmm-structure.ifc','${now}',('RMM STRUCTURES'),('RMM STRUCTURES'),'RMM','RMM','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
  ].join("\n");

  const body = entities.join("\n");
  const footer = "ENDSEC;\nEND-ISO-10303-21;";

  const ifcContent = `${header}\n${body}\n${footer}`;

  const blob = new Blob([ifcContent], { type: "application/ifc" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-structure.ifc";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const buildBomRows = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const detailElements = sampleModel.detailElements || [];
  const geometryRows = elements.map((el) => {
    const [x1, y1, z1] = el.start;
    const [x2, y2, z2] = el.end;
    const length = Math.sqrt(
      Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
    );
    return {
      id: el.id,
      type: el.type,
      profile: el.profile || "-",
      material: el.material || "-",
      mark: el.mark || "-",
      assemblyId: el.assemblyId || "-",
      length: length.toFixed(2),
      start: `${x1},${y1},${z1}`,
      end: `${x2},${y2},${z2}`,
    };
  });

  const detailRows = detailElements.map((el) => ({
    id: el.id,
    type: el.type,
    profile: el.profile || "-",
    material: el.material || "-",
    mark: el.mark || "-",
    assemblyId: el.assemblyId || "-",
    length: "0.00",
    start: el.host || "-",
    end: "-",
  }));

  return [...geometryRows, ...detailRows];
};

const exportBomCsv = () => {
  const rows = buildBomRows();
  const header = ["id", "tipo", "perfil", "material", "marca", "ensamble", "longitud_m", "inicio", "fin"];
  const content = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.type,
        row.profile,
        row.material,
        row.mark,
        row.assemblyId,
        row.length,
        row.start,
        row.end,
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-bom.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportSummaryTxt = () => {
  const rows = buildBomRows();
  const projectName = document.getElementById("project-name").value || "Proyecto";
  const totalElements = rows.length;
  const totalLength = rows.reduce((sum, row) => sum + Number(row.length), 0);
  const detailCount = rows.filter((row) => row.type.includes("base") || row.type.includes("bolt")).length;
  const summary = [
    "RMM STRUCTURES - Resumen de exportación",
    `Proyecto: ${projectName}`,
    `Elementos: ${totalElements}`,
    `Componentes de detalle: ${detailCount}`,
    `Longitud total (m): ${totalLength.toFixed(2)}`,
    "Exportación generada por el demo web.",
  ].join("\n");

  const blob = new Blob([summary], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-resumen.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const sanitizePdfText = (value) => String(value).replace(/[()]/g, "\\$&");

const getJointSymbol = (jointType = "") => {
  const key = String(jointType).toLowerCase();
  if (key.includes("moment") || key.includes("rigid")) {
    return { label: "RÍGIDA", symbol: "W" };
  }
  if (key.includes("pinned") || key.includes("articul")) {
    return { label: "ARTICULADA", symbol: "B" };
  }
  if (key.includes("semi")) {
    return { label: "SEMIRÍGIDA", symbol: "SR" };
  }
  if (key.includes("shear")) {
    return { label: "SHEAR", symbol: "S" };
  }
  return { label: "CONEXIÓN", symbol: "C" };
};

const buildBoltPattern = (bolts) => {
  if (!bolts || !bolts.count) {
    return null;
  }
  const rows = Math.max(2, Math.round(Math.sqrt(bolts.count)));
  const cols = Math.max(2, Math.ceil(bolts.count / rows));
  return {
    rows,
    cols,
    spacingX: 0.06,
    spacingY: 0.06,
  };
};

const buildPdfDocument = (contentLines) => {
  const content = contentLines.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object) => {
    const offset = body.length;
    body += `${object}\n`;
    return offset;
  });
  const xrefOffset = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return `${body}${xref}${trailer}`;
};

 documentar.querySelectorAll("[data-action='sync']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      updateViewer();
      button.textContent = "Modelo sincronizado";
      setTimeout(() => {
        button.textContent = "Sincronizar modelo";
      }, 1600);
const buildShopDrawingData = (elements) =>
  elements.map((el) => {
    const machining = el.machining;
    const [x1, y1, z1] = el.start;
    const [x2, y2, z2] = el.end;
    const vector = [x2 - x1, y2 - y1, z2 - z1];
    const length = machining?.length || Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2);
    const holesSource = machining?.operations?.holes || el.holes || [];
    const holes = holesSource.map((hole) => {
      if (hole.local?.u !== undefined) {
        return { ...hole, offset: Math.max(0, Math.min(hole.local.u, length)) };
      }
      const dx = (hole.x || x1) - x1;
      const dy = (hole.y || y1) - y1;
      const dz = (hole.z || z1) - z1;
      const projected = length
        ? (dx * vector[0] + dy * vector[1] + dz * vector[2]) / length
        : 0;
      return { ...hole, offset: Math.max(0, Math.min(projected, length)) };
    });
    return {
      id: el.id,
      type: el.type,
      profile: el.profile,
      material: el.material,
      mark: el.mark || "-",
      assemblyId: el.assemblyId || "-",
      length,
      holes,
      welds: machining?.operations?.welds || el.welds || [],
      cuts: machining?.operations?.cuts || el.cuts || [],
      section: machining?.section || null,
    };
  });

 documentar.querySelectorAll("[data-action='materials']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      generateMaterials();
      button.textContent = "Listado actualizado";
const buildAssemblyDrawingData = (details) =>
  details.map((detail) => ({
    id: detail.id,
    type: detail.type,
    host: detail.host,
    profile: detail.profile,
    material: detail.material,
    assemblyId: detail.assemblyId || "-",
    location: detail.location || "-",
    holes: detail.holes || [],
    welds: detail.welds || [],
    plate: detail.plate || null,
    stiffener: detail.stiffener || null,
    bolts: detail.bolts || null,
    jointType: detail.jointType || detail.type || "-",
  }));

const buildDrawingPdfContent = (title, rows) => {
  const content = [
    "0 0 0 RG",
    "1 w",
    `BT /F1 16 Tf 50 760 Td (${sanitizePdfText(title)}) Tj ET`,
  ];
  content.push("0.4 w");
  content.push("40 60 m 572 60 l S");
  content.push("40 60 m 40 760 l S");
  content.push("572 60 m 572 760 l S");
  content.push("40 760 m 572 760 l S");
  content.push(
    `BT /F1 8 Tf 420 740 Td (${sanitizePdfText("RMM STRUCTURES · Planos industriales")}) Tj ET`
  );
  content.push(
    `BT /F1 8 Tf 420 728 Td (${sanitizePdfText(`Fecha: ${new Date().toLocaleDateString("es-AR")}`)}) Tj ET`
  );
  content.push(`BT /F1 8 Tf 420 716 Td (${sanitizePdfText("Escala: 1:50")}) Tj ET`);
  content.push(`BT /F1 8 Tf 420 704 Td (${sanitizePdfText("Rev: A")}) Tj ET`);
  content.push(`BT /F1 8 Tf 420 692 Td (${sanitizePdfText("Norma: CIRSOC/AISC")}) Tj ET`);
  let cursorY = 690;
  const baseX = 60;
  const maxWidth = 480;
  rows.forEach((row, index) => {
    if (cursorY < 120) {
      return;
    }
    const scale = row.length ? Math.min(maxWidth / row.length, 60) : 1;
    const endX = baseX + row.length * scale;
    const topY = cursorY;
    const planY = cursorY - 18;
    const dimY = cursorY + 14;
    const section = row.section || { h: 0.2, b: 0.1 };
    const sectionScale = section ? Math.min(60 / section.h, 60 / section.b) : 1;
    const sectionW = section.b * sectionScale;
    const sectionH = section.h * sectionScale;
    const sectionX = endX + 70;
    const sectionY = cursorY - 10;

    content.push(`${baseX} ${topY} m ${endX} ${topY} l S`);
    content.push(`${baseX} ${planY} m ${endX} ${planY} l S`);
    content.push(`${baseX} ${dimY} m ${endX} ${dimY} l S`);
    content.push(`${baseX} ${dimY} m ${baseX + 4} ${dimY + 2} l S`);
    content.push(`${baseX} ${dimY} m ${baseX + 4} ${dimY - 2} l S`);
    content.push(`${endX} ${dimY} m ${endX - 4} ${dimY + 2} l S`);
    content.push(`${endX} ${dimY} m ${endX - 4} ${dimY - 2} l S`);
    content.push(
      `BT /F1 10 Tf ${baseX} ${cursorY + 16} Td (${sanitizePdfText(
        `${row.id} · ${row.profile} · Marca ${row.mark || ""}`
      )}) Tj ET`
    );
    content.push(
      `BT /F1 8 Tf ${baseX} ${cursorY + 24} Td (${sanitizePdfText(
        `Ensamble ${row.assemblyId || ""}`
      )}) Tj ET`
    );
    content.push(
      `BT /F1 9 Tf ${endX + 8} ${cursorY - 4} Td (${sanitizePdfText(
        `L=${row.length.toFixed(2)}m`
      )}) Tj ET`
    );
    content.push(
      `BT /F1 8 Tf ${baseX} ${cursorY - 32} Td (${sanitizePdfText("ALZADO")}) Tj ET`
    );
    content.push(
      `BT /F1 8 Tf ${baseX} ${cursorY - 50} Td (${sanitizePdfText("PLANTA")}) Tj ET`
    );
    content.push(
      `BT /F1 8 Tf ${sectionX - 10} ${sectionY + sectionH + 8} Td (${sanitizePdfText(
        "SECCIÓN"
      )}) Tj ET`
    );
    row.holes?.forEach((hole) => {
      const holeX = baseX + (hole.offset || 0.2) * scale;
      content.push(`${holeX} ${topY - 6} m ${holeX} ${topY + 6} l S`);
    });
    row.cuts?.forEach((cut, cutIndex) => {
      content.push(
        `BT /F1 8 Tf ${endX + 8} ${cursorY - 16 - cutIndex * 10} Td (${sanitizePdfText(
          `${cut.type} ${cut.side || ""}`
        )}) Tj ET`
      );
      content.push(`${endX - 6} ${topY + 4} m ${endX} ${topY} l S`);
      content.push(`${endX - 6} ${topY - 4} m ${endX} ${topY} l S`);
    });
    row.welds?.forEach((weld) => {
      content.push(
        `BT /F1 8 Tf ${baseX} ${cursorY - 14} Td (${sanitizePdfText(
          `Soldadura ${weld.type || "filete"} ${weld.size || ""}`
        )}) Tj ET`
      );
      content.push(`${baseX + 120} ${cursorY - 10} m ${baseX + 140} ${cursorY - 10} l S`);
      content.push(`${baseX + 140} ${cursorY - 10} m ${baseX + 136} ${cursorY - 6} l S`);
      content.push(`${baseX + 140} ${cursorY - 10} m ${baseX + 136} ${cursorY - 14} l S`);
    });
    if (row.plate) {
      const plateW = row.plate.width || 0.3;
      const plateH = row.plate.height || 0.3;
      const plateScale = Math.min(80 / plateW, 80 / plateH);
      const plateX = endX + 40;
      const plateY = cursorY - 40;
      const plateWScaled = plateW * plateScale;
      const plateHScaled = plateH * plateScale;
      content.push(`${plateX} ${plateY} m ${plateX + plateWScaled} ${plateY} l S`);
      content.push(`${plateX + plateWScaled} ${plateY} m ${plateX + plateWScaled} ${plateY + plateHScaled} l S`);
      content.push(`${plateX + plateWScaled} ${plateY + plateHScaled} m ${plateX} ${plateY + plateHScaled} l S`);
      content.push(`${plateX} ${plateY + plateHScaled} m ${plateX} ${plateY} l S`);
      content.push(
        `BT /F1 8 Tf ${plateX} ${plateY + plateHScaled + 6} Td (${sanitizePdfText(
          `PL ${Math.round(plateW * 1000)}x${Math.round(plateH * 1000)}`
        )}) Tj ET`
      );
      const boltPattern = buildBoltPattern(row.bolts);
      if (boltPattern) {
        content.push(
          `BT /F1 7 Tf ${plateX} ${plateY - 12} Td (${sanitizePdfText(
            `M${row.bolts.size || "20"} · ${boltPattern.rows}x${boltPattern.cols} · P=${(
              boltPattern.spacingX * 1000
            ).toFixed(0)}`
          )}) Tj ET`
        );
      }
      const jointSymbol = getJointSymbol(row.jointType);
      content.push(
        `BT /F1 8 Tf ${plateX} ${plateY - 24} Td (${sanitizePdfText(
          `Símbolo ${jointSymbol.label} (${jointSymbol.symbol})`
        )}) Tj ET`
      );
      if (row.jointType) {
        content.push(
          `BT /F1 7 Tf ${plateX} ${plateY - 36} Td (${sanitizePdfText(
            `Tipo unión: ${row.jointType}`
          )}) Tj ET`
        );
      }
    }
    if (section) {
      const sx1 = sectionX;
      const sy1 = sectionY;
      const sx2 = sectionX + sectionW;
      const sy2 = sectionY + sectionH;
      content.push(`${sx1} ${sy1} m ${sx2} ${sy1} l S`);
      content.push(`${sx2} ${sy1} m ${sx2} ${sy2} l S`);
      content.push(`${sx2} ${sy2} m ${sx1} ${sy2} l S`);
      content.push(`${sx1} ${sy2} m ${sx1} ${sy1} l S`);
      content.push(
        `BT /F1 8 Tf ${sx1} ${sy1 - 10} Td (${sanitizePdfText(
          `${(section.b * 1000).toFixed(0)} x ${(section.h * 1000).toFixed(0)}`
        )}) Tj ET`
      );
    }
    cursorY -= 110;
  });
  const tableStartY = 180;
  content.push(`${baseX} ${tableStartY} m 560 ${tableStartY} l S`);
  content.push(`${baseX} ${tableStartY - 12} m 560 ${tableStartY - 12} l S`);
  content.push(`${baseX} ${tableStartY - 72} m 560 ${tableStartY - 72} l S`);
  content.push(`${baseX + 80} ${tableStartY} m ${baseX + 80} ${tableStartY - 72} l S`);
  content.push(`${baseX + 160} ${tableStartY} m ${baseX + 160} ${tableStartY - 72} l S`);
  content.push(`${baseX + 240} ${tableStartY} m ${baseX + 240} ${tableStartY - 72} l S`);
  content.push(`${baseX + 320} ${tableStartY} m ${baseX + 320} ${tableStartY - 72} l S`);
  content.push(`${baseX + 400} ${tableStartY} m ${baseX + 400} ${tableStartY - 72} l S`);
  content.push(`${baseX + 480} ${tableStartY} m ${baseX + 480} ${tableStartY - 72} l S`);
  content.push(
    `BT /F1 8 Tf ${baseX + 6} ${tableStartY - 9} Td (${sanitizePdfText(
      "PIEZA"
    )}) Tj ET`
  );
  content.push(
    `BT /F1 8 Tf ${baseX + 90} ${tableStartY - 9} Td (${sanitizePdfText(
      "MARCA"
    )}) Tj ET`
  );
  content.push(
    `BT /F1 8 Tf ${baseX + 170} ${tableStartY - 9} Td (${sanitizePdfText(
      "ENSAMBLE"
    )}) Tj ET`
  );
  content.push(
    `BT /F1 8 Tf ${baseX + 250} ${tableStartY - 9} Td (${sanitizePdfText(
      "PERFIL"
    )}) Tj ET`
  );
  content.push(
    `BT /F1 8 Tf ${baseX + 330} ${tableStartY - 9} Td (${sanitizePdfText(
      "LARGO"
    )}) Tj ET`
  );
  content.push(
    `BT /F1 8 Tf ${baseX + 410} ${tableStartY - 9} Td (${sanitizePdfText(
      "PESO"
    )}) Tj ET`
  );
  content.push(
    `BT /F1 8 Tf ${baseX + 490} ${tableStartY - 9} Td (${sanitizePdfText(
      "OBS"
    )}) Tj ET`
  );
  rows.slice(0, 4).forEach((row, idx) => {
    const rowY = tableStartY - 26 - idx * 12;
    content.push(
      `BT /F1 7 Tf ${baseX + 6} ${rowY} Td (${sanitizePdfText(row.id)}) Tj ET`
    );
    content.push(
      `BT /F1 7 Tf ${baseX + 90} ${rowY} Td (${sanitizePdfText(row.mark || "-")}) Tj ET`
    );
    content.push(
      `BT /F1 7 Tf ${baseX + 170} ${rowY} Td (${sanitizePdfText(row.assemblyId || "-")}) Tj ET`
    );
    content.push(
      `BT /F1 7 Tf ${baseX + 250} ${rowY} Td (${sanitizePdfText(row.profile || "-")}) Tj ET`
    );
    content.push(
      `BT /F1 7 Tf ${baseX + 330} ${rowY} Td (${sanitizePdfText(
        row.length ? `${row.length.toFixed(2)}m` : "-"
      )}) Tj ET`
    );
    content.push(
      `BT /F1 7 Tf ${baseX + 410} ${rowY} Td (${sanitizePdfText("—")}) Tj ET`
    );
    content.push(
      `BT /F1 7 Tf ${baseX + 490} ${rowY} Td (${sanitizePdfText(row.jointType || row.type || "-")}) Tj ET`
    );
  });
  return content;
};

 documentar.querySelectorAll("[data-action='progress']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      actualizaciónProgreso();
      button.textContent = state.progress === 100 ? "Avance completo" : "Actualizar avance";
const buildDrawingsDxf = (title, rows) => {
  const header = ["0", "SECTION", "2", "ENTITIES"];
  const titleBlock = [
    "0",
    "LWPOLYLINE",
    "8",
    "TITLEBLOCK",
    "90",
    "4",
    "10",
    "5",
    "20",
    "5",
    "10",
    "297",
    "20",
    "5",
    "10",
    "297",
    "20",
    "210",
    "10",
    "5",
    "20",
    "210",
    "0",
    "TEXT",
    "8",
    "TITLEBLOCK",
    "10",
    "210",
    "20",
    "200",
    "30",
    "0",
    "40",
    "2.5",
    "1",
    `RMM STRUCTURES · ${title}`,
    "0",
    "TEXT",
    "8",
    "TITLEBLOCK",
    "10",
    "210",
    "20",
    "193",
    "30",
    "0",
    "40",
    "2",
    "1",
    `Fecha ${new Date().toLocaleDateString("es-AR")}`,
  ];
  const lines = rows.flatMap((row, index) => {
    const startX = 10;
    const startY = 10 + index * 30;
    const endX = startX + row.length * 10;
    const planY = startY - 8;
    const dimY = startY + 6;
    const section = row.section || { h: 0.2, b: 0.1 };
    const sectionScale = Math.min(8 / section.h, 8 / section.b);
    const sectionW = section.b * sectionScale * 10;
    const sectionH = section.h * sectionScale * 10;
    const sectionX = endX + 14;
    const sectionY = startY - sectionH / 2;
    const holeEntities = (row.holes || []).flatMap((hole) => {
      const holeX = startX + (hole.offset || 0.2) * 10;
      return [
        "0",
        "CIRCLE",
        "8",
        "HOLES",
        "10",
        holeX,
        "20",
        startY,
        "30",
        "0",
        "40",
        1.5,
      ];
    });
    const plateEntities = row.plate
      ? (() => {
          const plateW = (row.plate.width || 0.3) * 10;
          const plateH = (row.plate.height || 0.3) * 10;
          const plateX = endX + 6;
          const plateY = startY - plateH / 2;
          const boltPattern = buildBoltPattern(row.bolts);
          const boltEntities = boltPattern
            ? Array.from({ length: boltPattern.rows * boltPattern.cols }, (_, idx) => {
                const rowIndex = Math.floor(idx / boltPattern.cols);
                const colIndex = idx % boltPattern.cols;
                const boltX =
                  plateX + 2 + colIndex * (boltPattern.spacingX * 10) + (boltPattern.spacingX * 10) / 2;
                const boltY =
                  plateY + 2 + rowIndex * (boltPattern.spacingY * 10) + (boltPattern.spacingY * 10) / 2;
                return [
                  "0",
                  "CIRCLE",
                  "8",
                  "BOLTS",
                  "10",
                  boltX,
                  "20",
                  boltY,
                  "30",
                  "0",
                  "40",
                  0.6,
                ];
              }).flat()
            : [];
          const jointSymbol = getJointSymbol(row.jointType);
          return [
            "0",
            "LWPOLYLINE",
            "8",
            "PLATE",
            "90",
            "4",
            "10",
            plateX,
            "20",
            plateY,
            "10",
            plateX + plateW,
            "20",
            plateY,
            "10",
            plateX + plateW,
            "20",
            plateY + plateH,
            "10",
            plateX,
            "20",
            plateY + plateH,
            "0",
            "TEXT",
            "8",
            "NOTES",
            "10",
            plateX,
            "20",
            plateY + plateH + 3,
            "30",
            "0",
            "40",
            "2",
            "1",
            `PL ${Math.round((row.plate.width || 0.3) * 1000)}x${Math.round(
              (row.plate.height || 0.3) * 1000
            )}`,
            "0",
            "TEXT",
            "8",
            "SYMBOL",
            "10",
            plateX,
            "20",
            plateY - 3,
            "30",
            "0",
            "40",
            "2",
            "1",
            `${jointSymbol.label} (${jointSymbol.symbol})`,
            ...boltEntities,
          ];
        })()
      : [];
    const cutEntities = (row.cuts || []).flatMap((cut, cutIndex) => [
      "0",
      "LINE",
      "8",
      "CUTS",
      "10",
      endX - 2,
      "20",
      startY + 2 + cutIndex * 2,
      "30",
      "0",
      "11",
      endX,
      "21",
      startY - 2 + cutIndex * 2,
      "31",
      "0",
    ]);
    return [
      "0",
      "TEXT",
      "8",
      "TITLE",
      "10",
      startX,
      "20",
      startY + 10,
      "30",
      "0",
      "40",
      "2.5",
      "1",
      title,
      "0",
      "TEXT",
      "8",
      "NOTES",
      "10",
      startX,
      "20",
      startY + 5,
      "30",
      "0",
      "40",
      "2.5",
      "1",
      `${row.id} ${row.profile} ${row.mark || ""}`,
      "0",
      "LINE",
      "8",
      "MEMBERS",
      "10",
      startX,
      "20",
      startY,
      "30",
      "0",
      "11",
      endX,
      "21",
      startY,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "PLAN",
      "10",
      startX,
      "20",
      planY,
      "30",
      "0",
      "11",
      endX,
      "21",
      planY,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "DIM",
      "10",
      startX,
      "20",
      dimY,
      "30",
      "0",
      "11",
      endX,
      "21",
      dimY,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "DIM",
      "10",
      startX,
      "20",
      dimY,
      "30",
      "0",
      "11",
      startX + 1.5,
      "21",
      dimY + 1,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "DIM",
      "10",
      startX,
      "20",
      dimY,
      "30",
      "0",
      "11",
      startX + 1.5,
      "21",
      dimY - 1,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "DIM",
      "10",
      endX,
      "20",
      dimY,
      "30",
      "0",
      "11",
      endX - 1.5,
      "21",
      dimY + 1,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "DIM",
      "10",
      endX,
      "20",
      dimY,
      "30",
      "0",
      "11",
      endX - 1.5,
      "21",
      dimY - 1,
      "31",
      "0",
      "0",
      "TEXT",
      "8",
      "DIM",
      "10",
      endX + 3,
      "20",
      startY,
      "30",
      "0",
      "40",
      "2.5",
      "1",
      `L=${row.length.toFixed(2)}m`,
      "0",
      "LINE",
      "8",
      "SECTION",
      "10",
      sectionX,
      "20",
      sectionY,
      "30",
      "0",
      "11",
      sectionX + sectionW,
      "21",
      sectionY,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "SECTION",
      "10",
      sectionX + sectionW,
      "20",
      sectionY,
      "30",
      "0",
      "11",
      sectionX + sectionW,
      "21",
      sectionY + sectionH,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "SECTION",
      "10",
      sectionX + sectionW,
      "20",
      sectionY + sectionH,
      "30",
      "0",
      "11",
      sectionX,
      "21",
      sectionY + sectionH,
      "31",
      "0",
      "0",
      "LINE",
      "8",
      "SECTION",
      "10",
      sectionX,
      "20",
      sectionY + sectionH,
      "30",
      "0",
      "11",
      sectionX,
      "21",
      sectionY,
      "31",
      "0",
      ...holeEntities,
      ...cutEntities,
      ...plateEntities,
    ];
  });
  return [...header, ...titleBlock, ...lines, "0", "ENDSEC", "0", "EOF"].join("\n");
};

 documentar.querySelectorAll("[data-action='share']").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const workspace = loadWorkspace(); 
  estado const = documento.getElementById("share-status"); 
 if (!workspace) { 
        status.textContent = "Crea un workspace antes de invitar al equipo.";
        devolución;
const exportShopDrawings = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const drawings = buildShopDrawingData(elements);
  const contentLines = buildDrawingPdfContent("Planos de taller - RMM", drawings);
  const pdf = buildPdfDocument(contentLines);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-planos-taller.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (drawingsStatus) {
    drawingsStatus.textContent = "Planos de taller PDF generados.";
  }
};

const exportAssemblyDrawings = () => {
  const details = sampleModel.detailElements || [];
  const drawings = buildAssemblyDrawingData(details).map((row) => ({
    ...row,
    length: row.plate?.width || 0.3,
  }));
  const contentLines = buildDrawingPdfContent("Planos de montaje - RMM", drawings);
  const pdf = buildPdfDocument(contentLines);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-planos-montaje.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (drawingsStatus) {
    drawingsStatus.textContent = "Planos de montaje PDF generados.";
  }
};

const exportShopDrawingsDxf = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const drawings = buildShopDrawingData(elements);
  const content = buildDrawingsDxf("Planos de taller", drawings);
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-planos-taller.dxf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (drawingsStatus) {
    drawingsStatus.textContent = "Planos de taller DXF generados.";
  }
};

const exportAssemblyDrawingsDxf = () => {
  const details = sampleModel.detailElements || [];
  const drawings = buildAssemblyDrawingData(details).map((row) => ({
    ...row,
    length: row.plate?.width || 0.3,
  }));
  const content = buildDrawingsDxf("Planos de montaje", drawings);
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-planos-montaje.dxf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (drawingsStatus) {
    drawingsStatus.textContent = "Planos de montaje DXF generados.";
  }
};

const exportDstv = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const lines = elements.map((el) => {
    const machining = el.machining;
    const [x1, y1, z1] = el.start;
    const [x2, y2, z2] = el.end;
    const length =
      machining?.length ||
      Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
    const cutAngle = Math.atan2(z2 - z1, Math.hypot(x2 - x1, y2 - y1));
    const holesSource = machining?.operations?.holes || el.holes || [];
    const cutsSource = machining?.operations?.cuts || el.cuts || [];
    const weldsSource = machining?.operations?.welds || el.welds || [];
    const faces = ["WEB", "TOP_FLANGE", "BOTTOM_FLANGE", "TOP", "SIDE", "END"];
    const groupByFace = (items, defaultFace) =>
      items.reduce((acc, item) => {
        const face = String(item.face || defaultFace || "WEB").toUpperCase();
        if (!acc[face]) {
          acc[face] = [];
        }
        acc[face].push(item);
        return acc;
      }, {});
    const holesByFace = groupByFace(holesSource, "WEB");
    const cutsByFace = groupByFace(cutsSource, "END");
    const weldsByFace = groupByFace(weldsSource, "WEB");
    const faceBlocks = faces.flatMap((face) => {
      const faceHoles = holesByFace[face] || [];
      const faceCuts = cutsByFace[face] || [];
      const faceWelds = weldsByFace[face] || [];
      if (!faceHoles.length && !faceCuts.length && !faceWelds.length) {
        return [];
      }
      status.textContent = `Invitaciones enviadas para ${workspace.project}.`;
      const holes = faceHoles.map((hole) => {
        const localU = hole.local?.u ?? hole.x ?? 0;
        const localV = hole.local?.v ?? hole.y ?? 0;
        const localW = hole.local?.w ?? hole.z ?? 0;
        const holeType = String(hole.type || "DRILL").toUpperCase();
        return `BO ${holeType} ${localU.toFixed(3)} ${localV.toFixed(3)} ${localW.toFixed(3)} ${(
          hole.diameter || 0.018
        ).toFixed(3)}`;
      });
      const cuts = faceCuts.map((cut) => {
        const cutAngleValue = cut.angle ?? 0;
        const cutOffset = cut.offset ?? (cut.side === "start" ? 0 : length);
        const cutDepth = cut.depth ?? 0.02;
        const localU = cut.local?.u ?? cutOffset;
        const localV = cut.local?.v ?? 0;
        const localW = cut.local?.w ?? 0;
        if (String(cut.type || "").toLowerCase() === "bevel") {
          return `BV ${localU.toFixed(3)} ${localV.toFixed(3)} ${localW.toFixed(3)} ${cutDepth.toFixed(
            3
          )} ${cutAngleValue.toFixed(3)}`;
        }
        if (String(cut.type || "").toLowerCase() === "cope") {
          return `CP ${localU.toFixed(3)} ${localV.toFixed(3)} ${cutDepth.toFixed(3)}`;
        }
        return `CU ${String(cut.type || "CUT").toUpperCase()} ${cutOffset.toFixed(3)} ${cutAngleValue.toFixed(
          3
        )}`;
      });
      const welds = faceWelds.map((weld) => {
        const weldSize = weld.size || 0.006;
        const weldLength = weld.length || 0.12;
        return `WE ${String(weld.type || "FILETE").toUpperCase()} ${weldSize.toFixed(3)} ${weldLength.toFixed(
          3
        )}`;
      });
      return [`BF ${face}`, ...holes, ...cuts, ...welds];
    });
    const cuts = [
      `AK ${cutAngle.toFixed(3)} START`,
      `AK ${cutAngle.toFixed(3)} END`,
    ];
    const marks = [
      `MK ID ${el.id}`,
      `MK PROFILE ${el.profile}`,
    ];
    return [
      `ST ${el.id}`,
      `PR ${el.profile}`,
      `MA ${el.material || "S275"}`,
      `LN ${length.toFixed(3)}`,
      `SP ${x1.toFixed(3)} ${y1.toFixed(3)} ${z1.toFixed(3)}`,
      `EP ${x2.toFixed(3)} ${y2.toFixed(3)} ${z2.toFixed(3)}`,
      ...cuts,
      ...faceBlocks,
      ...marks,
      "EN",
    ].join("\n");
  });
  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-structure.nc1";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (cncStatus) {
    cncStatus.textContent = "DSTV exportado.";
  }
};

 documentar.querySelectorAll("[data-action='tour']").forEach((button) => { 
 botón.addEventListener("click", () => { 
  estado const = documento.getElementById("estado de la gira"); 
      status.textContent = "Recorrido en curso: modelado → CNC → montaje.";
const exportCncReport = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const header = [
    "id",
    "marca",
    "ensamble",
    "perfil",
    "material",
    "longitud_m",
    "caras",
    "taladros",
    "tipo_taladros",
    "cortes",
    "soldaduras",
    "inicio",
    "fin",
  ];
  const rows = elements.map((el) => {
    const [x1, y1, z1] = el.start;
    const [x2, y2, z2] = el.end;
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
    const machining = el.machining;
    const holes = machining?.operations?.holes || el.holes || [];
    const cuts = machining?.operations?.cuts || el.cuts || [];
    const welds = machining?.operations?.welds || el.welds || [];
    const faces = new Set(
      [...holes, ...cuts, ...welds].map((item) => String(item.face || "WEB").toUpperCase())
    );
    const holeTypes = Array.from(
      new Set(holes.map((hole) => String(hole.type || "drill").toUpperCase()))
    ).join("|");
    return [
      el.id,
      el.mark || "-",
      el.assemblyId || "-",
      el.profile,
      el.material,
      length.toFixed(2),
      faces.size ? Array.from(faces).join("|") : "-",
      holes.length,
      holeTypes || "-",
      cuts.length,
      welds.length,
      `${x1},${y1},${z1}`,
      `${x2},${y2},${z2}`,
    ];
  });
  const content = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-cnc-report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (cncStatus) {
    cncStatus.textContent = "Reporte CNC exportado.";
  }
};

const exportFabricationFlow = () => {
  const assemblies = sampleModel.assemblies || [];
  const steps = assemblies.map((assembly, index) => ({
    id: index + 1,
    assemblyId: assembly.id,
    title: assembly.name,
    sequence: assembly.sequence,
    status: "pending",
    tasks: [
      { step: "Corte", status: "pending" },
      { step: "Taladrado", status: "pending" },
      { step: "Soldadura", status: "pending" },
      { step: "Pintura", status: "pending" },
      { step: "Montaje", status: "pending" },
    ],
  }));
  const blob = new Blob([JSON.stringify(steps, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-fabricacion.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (fabricationStatus) {
    fabricationStatus.textContent = "Flujo de fabricación exportado.";
  }
};

const exportInspectionLog = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const log = elements.map((el, index) => ({
    pieceId: el.id,
    mark: el.mark || "-",
    assemblyId: el.assemblyId || "-",
    inspector: `QA-${String((index % 4) + 1).padStart(2, "0")}`,
    status: "pending",
    checkedAt: null,
  }));
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-inspecciones.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (fabricationStatus) {
    fabricationStatus.textContent = "Log de inspección exportado.";
  }
};

const loadZones = [
  {
    name: "Patagonia",
    keywords: ["ushuaia", "rio gallegos", "bariloche"],
    wind: 1.3,
    snow: 1.8,
    seismic: 1.1,
  },
  {
    name: "Cuyo",
    keywords: ["mendoza", "san juan", "san luis", "neuquen"],
    wind: 1.1,
    snow: 0.6,
    seismic: 1.5,
  },
  {
    name: "Centro",
    keywords: ["cordoba", "rosario", "santa fe"],
    wind: 1.0,
    snow: 0.4,
    seismic: 1.1,
  },
  {
    name: "Pampa",
    keywords: ["buenos aires", "la plata", "bahia blanca"],
    wind: 0.95,
    snow: 0.3,
    seismic: 1.0,
  },
  {
    name: "NOA/NEA",
    keywords: ["salta", "jujuy", "tucuman", "chaco", "corrientes", "misiones", "formosa"],
    wind: 1.05,
    snow: 0.1,
    seismic: 1.2,
  },
];

const getLocationFactors = (location = "") => {
  const normalized = location.toLowerCase();
  const zone = loadZones.find((candidate) =>
    candidate.keywords.some((keyword) => normalized.includes(keyword))
  );
  return {
    zone: zone?.name || "Referencial",
    wind: zone?.wind || 1,
    snow: zone?.snow || 1,
    seismic: zone?.seismic || 1,
  };
};

const buildLoadCombinations = (norm, loads) => {
  if (norm.includes("ACI")) {
    return [
      { name: "ACI 1.4D", factor: loads.dead * 1.4 },
      { name: "ACI 1.2D+1.6L", factor: loads.dead * 1.2 + loads.live * 1.6 },
      { name: "ACI 1.2D+1.0W+0.5L", factor: loads.dead * 1.2 + loads.wind + loads.live * 0.5 },
      { name: "ACI 0.9D+1.0W", factor: loads.dead * 0.9 + loads.wind },
      { name: "ACI 1.0D+1.0E", factor: loads.dead + loads.seismic },
    ];
  }
  if (norm.includes("AISC")) {
    return [
      { name: "AISC 1.4D", factor: loads.dead * 1.4 },
      { name: "AISC 1.2D+1.6L", factor: loads.dead * 1.2 + loads.live * 1.6 },
      { name: "AISC 1.2D+W+0.5L", factor: loads.dead * 1.2 + loads.wind + loads.live * 0.5 },
      { name: "AISC 0.9D+W", factor: loads.dead * 0.9 + loads.wind },
      { name: "AISC 1.0D+E", factor: loads.dead + loads.seismic },
    ];
  }
  return [
    { name: "CIRSOC 1.4D", factor: loads.dead * 1.4 },
    { name: "CIRSOC 1.2D+1.6L", factor: loads.dead * 1.2 + loads.live * 1.6 },
    { name: "CIRSOC 1.2D+W+0.5L", factor: loads.dead * 1.2 + loads.wind + loads.live * 0.5 },
    { name: "CIRSOC 0.9D+W", factor: loads.dead * 0.9 + loads.wind },
    { name: "CIRSOC 1.0D+E", factor: loads.dead + loads.seismic },
  ];
};

const computeDesignLoads = () => {
  const location = state.wizardData.ubicacion || "";
  const norm = (analysisNormInput?.value || "CIRSOC").toUpperCase();
  const usage = (analysisUseInput?.value || "Industrial").toLowerCase();
  const factors = getLocationFactors(location);
  const importance = Number(analysisImportanceInput?.value || 1);
  const liveFactor = usage.includes("almacen") || usage.includes("industrial") ? 0.7 : 1.0;
  const baseWind = Number(analysisWindInput?.value || 0);
  const baseSnow = Number(analysisSnowInput?.value || 0);
  const baseSeismic = Number(analysisSeismicInput?.value || 0);
  return {
    norm,
    usage,
    zone: factors.zone,
    wind: baseWind * factors.wind,
    snow: baseSnow * factors.snow,
    seismic: baseSeismic * factors.seismic * importance,
    live: baseSnow * liveFactor,
  };
};

const exportAnalysisPackage = () => {
  if (!hasPermission("export")) {
    if (analysisStatus) {
      analysisStatus.textContent = "Permiso insuficiente para exportar cálculo.";
    }
    return;
  }
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const loads = computeDesignLoads();
  const combinations = buildLoadCombinations(loads.norm, {
    dead: 0,
    live: loads.live,
    wind: loads.wind,
    seismic: loads.seismic,
  });
  const payload = {
    project: {
      name: document.getElementById("project-name").value || "Proyecto",
      client: document.getElementById("project-client").value || "Cliente",
      norm: loads.norm,
      use: loads.usage,
      zone: loads.zone,
      orgId: orgIdInput?.value || "",
      projectId: projectIdInput?.value || "",
    },
    loads: {
      windKnM2: loads.wind,
      snowKnM2: loads.snow,
      seismicBase: loads.seismic,
      liveLoadKnM2: loads.live,
    },
    combinations,
    elements: elements.map((el) => ({
      id: el.id,
      type: el.type,
      profile: el.profile,
      material: el.material,
      start: el.start,
      end: el.end,
    })),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-analisis.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  if (analysisStatus) {
    analysisStatus.textContent = "Paquete de análisis exportado.";
  }
};

const computeSectionProperties = (props) => {
  const steelDensity = 7850;
  const weight = props.weightKgM || 10;
  const area = weight / steelDensity;
  const h = props.h || 0.1;
  const b = props.b || 0.1;
  const tw = props.tw ?? b * 0.1;
  const tf = props.tf ?? h * 0.1;
  let inertia = (b * Math.pow(h, 3)) / 12;
  if (props.type === "I") {
    const innerB = Math.max(b - tw, b * 0.1);
    const innerH = Math.max(h - 2 * tf, h * 0.1);
    inertia = (b * Math.pow(h, 3) - innerB * Math.pow(innerH, 3)) / 12;
  }
  const sectionModulus = inertia / Math.max(h / 2, 1e-6);
  const radius = Math.sqrt(inertia / area);
  return { area, inertia, radius, sectionModulus };
};

const evaluateMemberCapacity = (props, demand) => {
  const fy = 250e6;
  const E = 200e9;
  const k = demand.k || 1;
  const { area, inertia, radius, sectionModulus } = computeSectionProperties(props);
  const axialStress = demand.axial / Math.max(area, 1e-9);
  const slenderness = demand.length / Math.max(radius, 1e-9);
  const pcr = (Math.PI ** 2 * E * inertia) / Math.pow(k * demand.length, 2);
  const bucklingUtil = demand.axialCompression ? demand.axial / Math.max(pcr, 1) : 0;
  const momentStress = demand.moment
    ? (demand.moment * (props.h || 0.1) / 2) / Math.max(inertia, 1e-9)
    : 0;
  const combinedUtil = Math.abs(axialStress / fy) + Math.abs(momentStress / fy);
  const deflection =
    demand.uniformLoad && inertia
      ? (5 * demand.uniformLoad * Math.pow(demand.length, 4)) / (384 * E * inertia)
      : 0;
  const deflectionRatio = demand.length / Math.max(deflection, 1e-9);
  const utilization = Math.max(combinedUtil, bucklingUtil);
  return {
    utilization,
    slenderness,
    deflectionRatio,
    ok: utilization <= 1 && deflectionRatio >= (demand.deflectionLimit || 200) && slenderness <= 200,
  };
};

const selectOptimalProfile = (profiles, demand) => {
  const sorted = profiles.slice().sort((a, b) => (a.weightKgM || 0) - (b.weightKgM || 0));
  const best = sorted.find((profile) => {
    const result = evaluateMemberCapacity(profile, demand);
    return result.ok;
  });
  return best || sorted[sorted.length - 1];
};

const optimizeProfiles = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const width = Number(state.wizardData.ancho || 24);
  const length = Number(state.wizardData.largo || 60);
  const height = Number(state.wizardData.altura || 8);
  const frames = Number(state.wizardData.porticos || 10);
  const spacing = frames > 1 ? length / (frames - 1) : length;
  const area = Math.max(width * length, 1);
  const loads = computeDesignLoads();
  const wind = loads.wind;
  const snow = loads.snow;
  const seismic = loads.seismic;
  const profileCatalog = buildProfileCatalogMap(
    state.catalogProfiles.length ? state.catalogProfiles : defaultCatalogProfiles
  );
  const profiles = Object.entries(profileCatalog).map(([name, props]) => ({ name, ...props }));

  const totalWeightKg = elements.reduce((sum, el) => {
    const [x1, y1, z1] = el.start;
    const [x2, y2, z2] = el.end;
    const lengthM = Math.sqrt(
      Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
    );
    const weight = profileCatalog[el.profile]?.weightKgM || 10;
    return sum + lengthM * weight;
  }, 0);
  const deadLoad = (totalWeightKg * 9.81) / 1000 / area;
  const roofLoad = snow;
  const windLoad = wind;
  const seismicLoad = seismic;

  const combinations = buildLoadCombinations(loads.norm, {
    dead: deadLoad,
    live: loads.live,
    wind: windLoad,
    seismic: seismicLoad,
  });
  const combo = combinations.reduce(
    (max, combination) => (combination.factor > max ? combination.factor : max),
    0
  );

  const columnDemand = {
    axial: combo * spacing * width / 2,
    axialCompression: true,
    length: height,
    deflectionLimit: 200,
  };
  const beamDemand = {
    axial: 0,
    axialCompression: false,
    moment: (combo * spacing) * Math.pow(width, 2) / 8,
    uniformLoad: combo * spacing,
    length: width,
    deflectionLimit: 200,
  };
  const braceDemand = {
    axial: windLoad * spacing * 0.5,
    axialCompression: true,
    length: Math.sqrt(Math.pow(spacing, 2) + Math.pow(width, 2) + Math.pow(height, 2)),
    deflectionLimit: 150,
  };

  const chosenColumn = selectOptimalProfile(profiles, columnDemand);
  const chosenBeam = selectOptimalProfile(profiles, beamDemand);
  const chosenBrace = selectOptimalProfile(profiles, braceDemand);

  elements.forEach((el) => {
    if (el.type === "column") {
      el.profile = chosenColumn.name;
    }
    if (el.type === "beam") {
      el.profile = chosenBeam.name;
    }
    if (el.type === "bracing") {
      el.profile = chosenBrace.name;
    }
  });
  sampleModel.geometryElements = elements;
  sampleModel.elements = elements
    .filter((el) => el.type === "column")
    .map((col) => ({
      id: col.id,
      type: col.type,
      length_mm: height * 1000,
      profile: { r_min_mm: profileCatalog[col.profile]?.rMinMm || 0 },
    }));
  if (analysisResults) {
    analysisResults.innerHTML = `
      <p><strong>Perfiles sugeridos:</strong> Columna ${chosenColumn.name} · Viga ${chosenBeam.name} · Arriostre ${
      chosenBrace.name
    }</p>
      <p>Optimización basada en carga combinada ${combo.toFixed(2)} kN/m².</p>
    `;
  }
  if (analysisStatus) {
    analysisStatus.textContent = "Optimización automática completada.";
  }
};

const runStructuralAnalysis = () => {
  const elements = sampleModel.geometryElements.length
    ? sampleModel.geometryElements
    : buildGeometry();
  const width = Number(state.wizardData.ancho || 24);
  const length = Number(state.wizardData.largo || 60);
  const frames = Number(state.wizardData.porticos || 10);
  const spacing = frames > 1 ? length / (frames - 1) : length;
  const area = Math.max(width * length, 1);
  const loads = computeDesignLoads();
  const wind = loads.wind;
  const snow = loads.snow;
  const seismic = loads.seismic;

  const profileCatalog = buildProfileCatalogMap(
    state.catalogProfiles.length ? state.catalogProfiles : defaultCatalogProfiles
  );
  const steelDensity = 7850;
  const totalWeightKg = elements.reduce((sum, el) => {
    const [x1, y1, z1] = el.start;
    const [x2, y2, z2] = el.end;
    const lengthM = Math.sqrt(
      Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
    );
    const weight = profileCatalog[el.profile]?.weightKgM || 10;
    return sum + lengthM * weight;
  }, 0);
  const deadLoad = (totalWeightKg * 9.81) / 1000 / area;
  const roofLoad = snow;
  const windLoad = wind;
  const seismicLoad = seismic;

  const combinations = buildLoadCombinations(loads.norm, {
    dead: deadLoad,
    live: loads.live,
    wind: windLoad,
    seismic: seismicLoad,
  });
  const governing = combinations.reduce((max, combo) =>
    combo.factor > max.factor ? combo : max
  );

  const columns = elements.filter((el) => el.type === "column");
  const beams = elements.filter((el) => el.type === "beam");
  const bracings = elements.filter((el) => el.type === "bracing");

  const columnResults = columns.map((col) => {
    const props = profileCatalog[col.profile] || {};
    const axial = governing.factor * spacing * width / 2;
    const demand = {
      axial,
      axialCompression: true,
      length: Number(state.wizardData.altura || 8),
      deflectionLimit: 200,
    };
    const result = evaluateMemberCapacity(props, demand);
    return { id: col.id, utilization: result.utilization, slenderness: result.slenderness };
  });

  const beamResults = beams.map((beam) => {
    const props = profileCatalog[beam.profile] || {};
    const span = width;
    const w = governing.factor * spacing;
    const moment = (w * Math.pow(span, 2)) / 8;
    const demand = {
      axial: 0,
      axialCompression: false,
      moment,
      uniformLoad: w,
      length: span,
      deflectionLimit: 240,
    };
    const result = evaluateMemberCapacity(props, demand);
    return { id: beam.id, utilization: result.utilization };
  });

  const bracingResults = bracings.map((brace) => {
    const props = profileCatalog[brace.profile] || {};
    const axial = windLoad * spacing * 0.5;
    const demand = {
      axial,
      axialCompression: true,
      length: Math.sqrt(Math.pow(spacing, 2) + Math.pow(width, 2) + Math.pow(Number(state.wizardData.altura || 8), 2)),
      deflectionLimit: 180,
    };
    const result = evaluateMemberCapacity(props, demand);
    return { id: brace.id, utilization: result.utilization };
  });

  const worst = Math.max(
    ...columnResults.map((r) => r.utilization),
    ...beamResults.map((r) => r.utilization),
    ...bracingResults.map((r) => r.utilization)
  );
  const columnMax = Math.max(...columnResults.map((r) => r.utilization));
  const beamMax = Math.max(...beamResults.map((r) => r.utilization));
  const bracingMax = Math.max(...bracingResults.map((r) => r.utilization));
  const status = worst <= 1 ? "OK" : "NO OK";

  if (analysisResults) {
    analysisResults.innerHTML = `
      <p><strong>Combinación crítica:</strong> ${governing.name}</p>
      <p><strong>Utilización máxima:</strong> ${worst.toFixed(2)} (${status})</p>
      <p><strong>Cargas:</strong> D=${deadLoad.toFixed(2)} kN/m² · W=${windLoad.toFixed(
      2
    )} kN/m² · S=${roofLoad.toFixed(2)} kN/m² · E=${seismicLoad.toFixed(2)} kN/m²</p>
      <p><strong>Zona normativa:</strong> ${loads.zone} · Norma ${loads.norm}</p>
      <p><strong>Elementos verificados:</strong> ${columns.length} columnas · ${beams.length} vigas · ${
      bracings.length
    } arriostres</p>
      <p><strong>Utilización por sistema:</strong> Columnas ${columnMax.toFixed(
        2
      )} · Vigas ${beamMax.toFixed(2)} · Arriostres ${bracingMax.toFixed(2)}</p>
    `;
  }
  if (analysisStatus) {
    analysisStatus.textContent = "Verificación estructural completada.";
  }
};

const buildJointsRows = () => {
  const detailElements = sampleModel.detailElements || [];
  const jointRulesMap = jointLibrary.reduce((acc, joint) => {
    acc[joint.type] = joint;
    return acc;
  }, {});
  const evaluateJointCompliance = (detail) => {
    const joint = jointRulesMap[detail.type];
    if (!joint || !joint.rules) {
      return { status: "warning", notes: "Sin regla normativa asignada.", norms: "-" };
    }
    const rules = joint.rules;
    const plateThicknessMm = detail.plate?.thickness ? detail.plate.thickness * 1000 : null;
    const boltCount = detail.bolts?.count || 0;
    const stiffenerOk = rules.requireStiffeners ? Boolean(detail.stiffener) : true;
    const plateOk = plateThicknessMm ? plateThicknessMm >= rules.minPlateThicknessMm : false;
    const boltsOk = boltCount >= rules.minBolts;
    const failures = [];
    if (!plateOk) failures.push("espesor de placa");
    if (!boltsOk) failures.push("cantidad de bulones");
    if (!stiffenerOk) failures.push("rigidizadores");
    if (failures.length > 0) {
      return {
        status: "error",
        notes: `No cumple: ${failures.join(", ")}.`,
        norms: (joint.norms || []).join(", "),
      };
    }
    return {
      status: "ok",
      notes: rules.notes || "Cumple requisitos mínimos.",
      norms: (joint.norms || []).join(", "),
    };
  };
  return detailElements.map((detail) => ({
    ...evaluateJointCompliance(detail),
    id: detail.id,
    type: detail.type,
    host: detail.host || "-",
    profile: detail.profile || "-",
    material: detail.material || "-",
    assemblyId: detail.assemblyId || "-",
    location: detail.location ? detail.location.join(",") : "-",
    orientation: detail.orientation ? detail.orientation.join(",") : "-",
    plate: detail.plate
      ? `${Math.round(detail.plate.width * 1000)}x${Math.round(detail.plate.height * 1000)}x${Math.round(
          detail.plate.thickness * 1000
        )}`
      : "-",
    stiffener: detail.stiffener
      ? `${Math.round(detail.stiffener.length * 1000)}x${Math.round(detail.stiffener.thickness * 1000)}`
      : "-",
    bolts: detail.bolts ? `${detail.bolts.size} x ${detail.bolts.count}` : "-",
    jointType: detail.jointType || "-",
  }));
};

const exportJointsCsv = () => {
  const rows = buildJointsRows();
  const header = [
    "id",
    "tipo",
    "host",
    "perfil",
    "material",
    "ensamble",
    "ubicacion",
    "orientacion",
    "placa",
    "rigidizador",
    "bulones",
    "tipo_union",
    "normas",
    "estado_norma",
    "observaciones",
  ];
  const content = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.type,
        row.host,
        row.profile,
        row.material,
        row.assemblyId,
        row.location,
        row.orientation,
        row.plate,
        row.stiffener,
        row.bolts,
        row.jointType,
        row.norms || "-",
        row.status || "-",
        row.notes || "-",
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rmm-uniones.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const runRules = () => {
  const results = rulesCatalog.map((rule) => rule.run(sampleModel));
  state.rulesResults = results;
  renderRules(results);
  const errors = results.filter((r) => r.status === "error").length;
  const warnings = results.filter((r) => r.status === "warning").length;
  rulesSummary.textContent = `Validación completa: ${errors} errores · ${warnings} warnings.`;
  sampleModel.export.canExport = errors === 0;
  exportStatus.textContent = sampleModel.export.canExport
    ? "Exportación habilitada."
    : "Exportación bloqueada por errores críticos.";
};

const calculateCost = () => {
  const priceKg = Number(document.getElementById("price-kg").value);
  const coefFab = Number(document.getElementById("coef-fab").value);
  const coefMont = Number(document.getElementById("coef-mont").value);
  const pesoTotal = sampleModel.cost.totalWeightKg;
  const costoMaterial = pesoTotal * priceKg;
  const costoFabricacion = pesoTotal * coefFab;
  const costoMontaje = (costoMaterial + costoFabricacion) * coefMont;
  const costoTotal = costoMaterial + costoFabricacion + costoMontaje;
  const summary = document.getElementById("cost-summary");
  summary.innerHTML = `
    <p>Peso total: ${pesoTotal.toLocaleString("es-AR")} kg</p>
    <p>Material: $${costoMaterial.toLocaleString("es-AR")}</p>
    <p>Fabricación: $${costoFabricacion.toLocaleString("es-AR")}</p>
    <p>Montaje: $${costoMontaje.toLocaleString("es-AR")}</p>
    <p><strong>Total:</strong> $${costoTotal.toLocaleString("es-AR")}</p>
  `;
};

const openModal = () => {
  const modal = document.getElementById("demo-modal");
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
};

const closeModal = () => {
  const modal = document.getElementById("demo-modal");
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
};

const setRole = (role) => {
  document.getElementById("role-status").textContent = `Rol seleccionado: ${role}.`;
};

const scrollToTarget = (target) => {
  const element = document.querySelector(target);
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
  }
};

const bindEvents = () => {
  document.querySelectorAll("[data-action='open-demo']").forEach((btn) => {
    btn.addEventListener("click", openModal);
  });
  document.querySelector("[data-action='close-modal']").addEventListener("click", closeModal);
  document.querySelector("#demo-modal").addEventListener("click", (event) => {
    if (event.target.id === "demo-modal") {
      closeModal();
    }
  });

  document.querySelectorAll("[data-action='select-role']").forEach((button) => {
    button.addEventListener("click", () => setRole(button.dataset.role));
  });

  document.querySelectorAll("[data-action='scroll']").forEach((button) => {
    button.addEventListener("click", () => scrollToTarget(button.dataset.target));
  });

  stepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setWizardStep(Number(button.dataset.step));
      collectWizardData();
    });
  });

 documentar.querySelectorAll("[data-action='analyze']").forEach((button) => { 
 botón.addEventListener("click", () => { 
  estado const = documento.getElementById("estado-análisis"); 
      status.innerHTML = "<span>✓ Interferencias críticas resueltas</span><span>✓ Se actualizaron 8 conexiones</span>";
      button.textContent = "Análisis completado";
  document.querySelector("[data-action='next']").addEventListener("click", () => {
    const nextStep = Math.min(4, state.wizardStep + 1);
    setWizardStep(nextStep);
    collectWizardData();
  });

  document.querySelector("[data-action='prev']").addEventListener("click", () => {
    const prevStep = Math.max(1, state.wizardStep - 1);
    setWizardStep(prevStep);
    collectWizardData();
  });

  wizardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!hasPermission("edit")) {
      wizardStatus.textContent = "Permiso insuficiente para crear el modelo.";
      return;
    }
    collectWizardData();
    wizardStatus.textContent = "Modelo 3D generado. Puedes continuar con el editor BIM.";
  });

  document.querySelector("[data-action='calc-cost']").addEventListener("click", (event) => {
    event.preventDefault();
    calculateCost();
  });

  document.querySelector("[data-action='share']").addEventListener("click", () => {
    shareStatus.textContent = "Link generado: rmmstructures.com/proyecto/abc123";
  });

  document.querySelector("[data-action='export']").addEventListener("click", () => {
    if (!hasPermission("export")) {
      exportStatus.textContent = "Permiso insuficiente para exportar.";
      return;
    }
    exportStatus.textContent = sampleModel.export.canExport
      ? "Exportación IFC/DXF/PDF iniciada."
      : "No se puede exportar: existen errores críticos.";
  });

  document.querySelector("[data-action='run-rules']").addEventListener("click", runRules);

  document
    .querySelector("[data-action='build-geometry']")
    .addEventListener("click", (event) => {
      event.preventDefault();
      if (!hasPermission("edit")) {
        geometryStatus.textContent = "Permiso insuficiente para calcular geometría.";
        return;
      }
      buildGeometry();
    });

  document.querySelector("[data-action='export-ifc']").addEventListener("click", (event) => {
    event.preventDefault();
    if (!hasPermission("export")) {
      geometryStatus.textContent = "Permiso insuficiente para exportar IFC.";
      return;
    }
    exportIfc();
  });

  document.querySelector("[data-action='export-dxf']").addEventListener("click", (event) => {
    event.preventDefault();
    if (!hasPermission("export")) {
      geometryStatus.textContent = "Permiso insuficiente para exportar DXF.";
      return;
    }
    exportDxf();
  });

  document.querySelector("[data-action='export-bom']").addEventListener("click", (event) => {
    event.preventDefault();
    if (!hasPermission("export")) {
      exportStatus.textContent = "Permiso insuficiente para exportar BOM.";
      return;
    }
    exportBomCsv();
  });

 const ifcInput = documento.getElementById("ifc-input"); 
 si (ifcInput) { 
 ifcInput.addEventListener("change", () => { 
  estado const = documento.getElementById("ifc-status"); 
  const fileName = ifcInput.archivos[0]?.Nombre || "Sin archivo"; 
 Estado.textContent = 'Archivo cargado: ${nombrefile}'; 
  document.querySelector("[data-action='export-summary']").addEventListener("click", (event) => {
    event.preventDefault();
    if (!hasPermission("export")) {
      exportStatus.textContent = "Permiso insuficiente para exportar resumen.";
      return;
    }
    exportSummaryTxt();
  });

  document.querySelector("[data-action='export-joints']").addEventListener("click", (event) => {
    event.preventDefault();
    if (!hasPermission("export")) {
      exportStatus.textContent = "Permiso insuficiente para exportar uniones.";
      return;
    }
    exportJointsCsv();
  });

  document.querySelector("[data-action='export-analysis']").addEventListener("click", (event) => {
    event.preventDefault();
    exportAnalysisPackage();
  });

  document.querySelector("[data-action='run-analysis']").addEventListener("click", (event) => {
    event.preventDefault();
    runStructuralAnalysis();
  });

  document.querySelector("[data-action='optimize-sections']").addEventListener("click", (event) => {
    event.preventDefault();
    optimizeProfiles();
  });

  document.querySelector("[data-action='export-shop-drawings']").addEventListener("click", (event) => {
    event.preventDefault();
    exportShopDrawings();
  });

  document.querySelector("[data-action='export-assembly-drawings']").addEventListener("click", (event) => {
    event.preventDefault();
    exportAssemblyDrawings();
  });

  document
    .querySelector("[data-action='export-shop-drawings-dxf']")
    .addEventListener("click", (event) => {
      event.preventDefault();
      exportShopDrawingsDxf();
    });
  }

 const projectForm = documento.getElementById("forma-proyecto"); 
 if (projectForm) { 
 proyectoForma.addEventListener("submit", (event) => { 
 evento.preventDefault(); 
 const formData = nuevo FormData(projectForm); 
 const data = Objeto.fromEntrries(formData.entradas()); 
 updateWorkspace(data); 
 saveWorkspace(data); 
 documentar.getElementById("estado del proyecto").textContent = 
        `Workspace creado para ${data.project}.`;
  document
    .querySelector("[data-action='export-assembly-drawings-dxf']")
    .addEventListener("click", (event) => {
      event.preventDefault();
      exportAssemblyDrawingsDxf();
    });

  document.querySelector("[data-action='export-dstv']").addEventListener("click", (event) => {
    event.preventDefault();
    exportDstv();
  });

  document.querySelector("[data-action='export-cnc-report']").addEventListener("click", (event) => {
    event.preventDefault();
    exportCncReport();
  });

  document.querySelector("[data-action='export-fabrication-flow']").addEventListener("click", (event) => {
    event.preventDefault();
    exportFabricationFlow();
  });

  document.querySelector("[data-action='export-inspection-log']").addEventListener("click", (event) => {
    event.preventDefault();
    exportInspectionLog();
  });

  document.querySelector("[data-action='save-project']").addEventListener("click", (event) => {
    event.preventDefault();
    if (!hasPermission("edit")) {
      persistenceStatus.textContent = "Permiso insuficiente para guardar versiones.";
      return;
    }
    saveProjectVersion();
  });

  document.querySelector("[data-action='load-project']").addEventListener("click", (event) => {
    event.preventDefault();
    loadLatestProject();
  });

  document.querySelector("[data-action='export-json']").addEventListener("click", (event) => {
    event.preventDefault();
    if (!hasPermission("export")) {
      persistenceStatus.textContent = "Permiso insuficiente para exportar JSON.";
      return;
    }
    exportProjectJson();
  });

  document.querySelector("[data-action='save-remote']").addEventListener("click", (event) => {
    event.preventDefault();
    saveProjectRemote();
  });

  document.querySelector("[data-action='load-remote']").addEventListener("click", (event) => {
    event.preventDefault();
    loadProjectRemote();
  });

  const applyLibraryButton = document.querySelector("[data-action='apply-library']");
  if (applyLibraryButton) {
    applyLibraryButton.addEventListener("click", (event) => {
      event.preventDefault();
      const selected = catalogLibrarySelect?.value || state.activeCatalogLibrary;
      applyCatalogLibrary(selected);
    });
  }

 const demoForm = documento.getElementById("demo-form"); 
 if (demoForm) { 
 demoForm.addEventListener("submit", (event) => { 
 evento.preventDefault(); 
 documentar.getElementById("demo-status").textContent = 
        "Demo agendada. Nuestro equipo te contactará en las próximas 24 horas.";
  const compareLibraryButton = document.querySelector("[data-action='compare-library']");
  if (compareLibraryButton) {
    compareLibraryButton.addEventListener("click", (event) => {
      event.preventDefault();
      compareCatalogLibraries();
    });
  }

 const consultingForm = documento.getElementById("consultora-formulario"); 
 if (consultingForm) { 
 Formulario de consultoría.addEventListener("submit", (event) => { 
 evento.preventDefault(); 
 documentar.getElementById("consulting-status").textContent = 
        "Solicitud enviada. Un especialista BIM te escribirá hoy.";
  const exportLibraryButton = document.querySelector("[data-action='export-library']");
  if (exportLibraryButton) {
    exportLibraryButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (!hasPermission("export")) {
        updateCatalogStatus("Permiso insuficiente para exportar catálogo.");
        return;
      }
      exportCatalogLibrary();
    });
  }

 const storedWorkspace = loadWorkspace(); 
 if (storedWorkspace) { 
 updateWorkspace(storedWorkspace); 
 documentar.getElementById("estado del proyecto").textContent = 
 'Workspace activo: ${storedWorkspace.project}.'; 
  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const session = {
      email: authEmail.value.trim(),
      role: normalizeRole(authRole.value),
    };
    if (!session.email) {
      authStatus.textContent = "Ingresá un email válido.";
      return;
    }
    saveSession(session);
    updateAuthUI(session);
  });

  document.querySelector("[data-action='logout']").addEventListener("click", () => {
    clearSession();
    updateAuthUI(null);
    updateSupabaseAuthStatus("Sin sesión Supabase activa.");
  });

  document.querySelector("[data-action='magic-link']").addEventListener("click", (event) => {
    event.preventDefault();
    sendMagicLink();
  });
};

const init = () => {
  renderBimTree();
  renderFlow();
  renderIndustrialModules();
  renderJointLibrary();
  collectWizardData();
  renderRules(rulesCatalog.map((rule) => ({ status: "warning", message: rule.description })));
  loadLatestProject();
  const initialLibrary = catalogLibrarySelect?.value || state.activeCatalogLibrary;
  applyCatalogLibrary(initialLibrary);
  updateAuthUI(getSession());
  const supabaseConfig = loadSupabaseConfig();
  if (supabaseConfig) {
    supabaseUrlInput.value = supabaseConfig.url || "";
    supabaseKeyInput.value = supabaseConfig.key || "";
    initSupabase();
    loadSupabaseSession();
  }
});
  bindEvents();
};

document.addEventListener("DOMContentLoaded", init);
    details.push({
      id: `STIFF-${i + 1}-L`,
      type: "stiffener_plate",
      profile: "PL 200x160x12",
      material,
      host: `COL-${i + 1}-L`,
      assemblyId,
      mark: buildPieceMark("stiffener"),
      location: leftJointLocation,
      plate: { width: 0.2, height: 0.16, thickness: 0.012 },
      welds: [{ type: "filete", size: 0.006, length: 0.18 }],
    });
    details.push({
      id: `STIFF-${i + 1}-R`,
      type: "stiffener_plate",
      profile: "PL 200x160x12",
      material,
      host: `COL-${i + 1}-R`,
      assemblyId,
      mark: buildPieceMark("stiffener"),
      location: rightJointLocation,
      plate: { width: 0.2, height: 0.16, thickness: 0.012 },
      welds: [{ type: "filete", size: 0.006, length: 0.18 }],
    });
    details.push({
      id: `ENDPL-${i + 1}`,
      type: "end_plate",
      profile: "PL 260x320x16",
      material,
      host: `BEAM-${i + 1}`,
      assemblyId,
      mark: buildPieceMark("plate"),
      location: [x, width / 2, height],
      plate: { width: 0.26, height: 0.32, thickness: 0.016 },
      bolts: { size: "M20", count: 8 },
      holes: [
        { x: x + 0.08, y: width / 2 - 0.06, diameter: 0.02, face: "TOP" },
        { x: x + 0.08, y: width / 2 + 0.06, diameter: 0.02, face: "TOP" },
        { x: x - 0.08, y: width / 2 - 0.06, diameter: 0.02, face: "TOP" },
        { x: x - 0.08, y: width / 2 + 0.06, diameter: 0.02, face: "TOP" },
      ],
    });
