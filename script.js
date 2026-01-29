 estado const = { 
 progreso: 62, 
 espectadoresPiezas: 1420, 
 espectadorPrecisión: 98, 
};

const formatNumber = (valor) = > valor.toLocaleString("es-CL"); 

const openModal = (modal) => { 
 modal. ListaClase.add("activo"); 
 modal.setAttribute("aria-oculta", "falsa"); 
};

const closeModal = (modal) => { 
 modal. ListaClase.remove("activo"); 
 modal.setAttribute("aria-oculta", "verdadero"); 
};

const updateViewer = () => { 
 estado.viewerPieces += Matemáticas.Planta (Matemáticas.aleatorio() * 20 + 5); 
 estado.espectadorPrecisión = Matemáticas.min(99, estado).espectadorPrecisión + 1); 
 documentar.getElementById("piezas de visualización").textContent = formatoNúmero(estado.viewerPieces); 
 documentar.getElementById("precisión de visualización").textContent = '${state.viewerPrecision}%'; 
};

const updateProgress = () => { 
 estado.progreso = Matemáticas.min(100, estado).progreso + 6); 
 barra const = documento.getElementById("barra de progreso"); 
 etiqueta const = documento.getElementById("etiqueta-progreso"); 
 bar.estilo.ancho = '${state.progress}%'; 
 etiqueta.textContent = 'Avance actual: ${state.progress}%'; 
};

const generateMaterials = () => { 
  materiales const = [ 
  { nombre: "Viga IPE 300", cantidad: 120, peso: "24 t", estado: "Listo" }, 
    { name: "Columna HEB 260", qty: 80, weight: "18 t", status: "En fabricación" },
    { name: "Placas de anclaje", qty: 300, weight: "4 t", status: "Corte CNC" },
    { name: "Pernos A325", qty: 2400, weight: "1.2 t", status: "Recepcionado" },
  ];
 const tbody = documento.getElementById("material-table"); 
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
estado const = { 
  wizardStep: 1,
  wizardData: {},
 reglasResultados: [], 
};

const sampleModel = {
 Edificio: { Longitud: 60 }, 
 elementos: [ 
 { id: "C-01", tipo: "column", length_mm: 8000, perfil: { r_min_mm: 60 } }, 
 { id: "C-02", tipo: "column", length_mm: 8000, perfil: { r_min_mm: 45 } }, 
  ],
 reforzando: { 
 longitudinal: [{ id: "BL-01", tipo: "cross", de: 0, a: 50 }], 
  },
 geometría: { 
 spansOk: cierto, 
 alturasVale: cierto, 
 portalEspaciadoVale: cierto, 
  },
 Estabilidad: { 
 lateralSystemOk: cierto, 
 loadPathOk: cierto, 
  },
 Tejado: { 
 diafragmaContinuo: falso, 
  },
 fundación: { 
 columnasAnclado: cierto, 
 columnasWithFoundation: cierto, 
  },
 Fabricación: { 
 maxLongitud de la pieza: 18, 
 Peso máximo de la piezaKg: 2800, 
 perfilesCatálogoVale: cierto, 
 articulacionesDefinido: falso, 
  },
 coste: { 
 PesoKg: 42000, 
  },
 exportar: { 
 canExport: falso, 
  },
 versionado: { 
 Estado: "Draft", 
  },
 permisos: { 
    role: "Ingeniero",
 Permitidos: ["editar", "validar"], 
  },
};

const rulesCatalog = [
  {
    id: 1,
    title: "Regla 1: Esbeltez de columnas (CIRSOC 101)",
 Descripción: 
      "Detecta columnas excesivamente esbeltas. Error si L/r > 200, warning si 150 < L/r ≤ 200.",
 código: 'function validateColumnSlenderness(model) { 
 resultados const = []; 

  model.elements
 .filter(e => e.type === 'columna') 
    .forEach(col => {
 si (!col.length_mm || !col.profile?. r_min_mm) { 
        results.push({ status: 'error', message: 'Datos insuficientes' });
 devolución; 
      }

 esbeltez constante = col.length_mm / col.profile.r_min_mm; 

 si (delgadez > 200) { 
        results.push({ status: 'error', message: 'Esbeltez crítica' });
 } si no (delgadez > 150) { 
 results.push({ estado: 'advertencia', mensaje: 'Esbeltez a revisar' }); 
      } else {
 results.push({ estado: 'ok', mensaje: 'Esbeltez OK' }); 
      }
    });

 resultados de los resultados; 
}`,
    run: (model) => {
 resultados const = model.elements 
        .filter((e) => e.type === "column")
        .map((col) => {
 si (!col.length_mm || !col.profile?. r_min_mm) { 
            return { status: "error", message: "Datos insuficientes" };
          }
 esbeltez constante = col.length_mm / col.profile.r_min_mm; 
 si (delgadez > 200) { 
 return { status: "error", mensaje: 'L/r = ${slenderness.toFixed(1)} > 200' }; 
          }
 si (esbeltez > 150) { 
 return { status: "warning", message: 'L/r = ${slenderness.toFixed(1)} revisar' }; 
          }
 return { status: "ok", mensaje: 'L/r = ${slenderness.toFixed(1)}' }; 
        });
      return summarizeResults(results, "Columnas evaluadas");
    },
  },
  {
    id: 2,
    title: "Regla 2: Coherencia geométrica básica",
 Descripción: 
      "Valida que las dimensiones principales y la modulación del pórtico sean coherentes.",
 código: 'function validateGeometry(model) { 
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
 Descripción: 
      "Chequea presencia de sistema lateral y camino de cargas estable.",
 código: 'función validateGlobalStability(model) { 
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
 Descripción: 
      "Valida existencia y continuidad del sistema resistente longitudinal.",
 código: 'función validateLongitudinalBracing(model) { 
 longitud const = longitud.construcción.modelo; 
 reforzos const = ¿refuerzos modelo?. longitudinal || []; 

 si (refuerzos.longitud === 0) { 
    return { status: 'error', message: 'No hay arriostramiento' };
  }

 const cubierto = refuerzos.algunos(b = > b.de <= 0 & b.to >= longitud); 
 Retorno cubierto 
 ? { estado: 'ok', mensaje: 'Sistema continuo' } 
    : { status: 'warning', message: 'No cubre toda la nave' };
}`,
    run: (model) => {
 reforzos const = ¿refuerzos modelo?. longitudinal || []; 
 si (refuerzos.longitud === 0) { 
        return { status: "error", message: "Sin arriostramiento longitudinal" };
      }
 const covered = refuerzos.alguno((b) => b.from <= 0 & & b.to >= model.building.length); 
 Retorno cubierto 
 ? { estado: "ok", mensaje: "Sistema longitudinal continuo" } 
        : { status: "warning", message: "Arriostramiento incompleto" };
    },
  },
  {
    id: 5,
    title: "Regla 5: Presencia de diafragma de cubierta",
 Descripción: 
      "Verifica que exista un diafragma continuo de cubierta para transmitir cargas.",
 código: 'function validateRoofDiaphragm(model) { 
 retorno modelo.techo.diafragmaContinuo 
 ? { estado: 'ok', mensaje: 'Diafragma continuo' } 
 : { estado: 'advertencia', mensaje: 'Diafragma discontinuo' }; 
}`,
 run: (modelo) => 
 modelo.techo.diafragmaContinuo 
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
 code: 'pieza.forEach(p => { 
  if (p.longitud > 18) error('Pieza no transportable');
  if (p.peso > 3000) error('Pieza no manipulable');
  if (!catalogo.perfiles.includes(p.perfil)) error('Perfil no normalizado');
  if (!p.unionDefinida) warning('Unión sin definir');
});`,
    run: (model) => {
 const { fabrication } = modelo; 
      if (fabrication.maxPieceLength > 18) {
        return { status: "error", message: "Pieza no transportable" };
      }
 si (fabrication.maxPieceWeightKg > 3000) { 
 return { status: "error", mensaje: "Pieza no manipulable" }; 
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
 Estado: "Vale", 
 mensaje: 'Peso total ${model.cost.totalWeightKg.toLocaleString("es-AR")} kg', 
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
 estado: model.export.canExport ? "Vale" : "Advertencia", 
 message: model.export.canExport ? "Exportación habilitada": "Exportación bloqueada", 
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
 estado: model.versioning.status === "Congelado" ? "Vale" : "Advertencia", 
      message: `Estado de versión: ${model.versioning.status}`,
    }),
  },
  {
    id: 11,
    title: "Regla 11: Colaboración multiusuario",
    description: "Permisos por rol con acciones habilitadas.",
    code: `function puede(usuario, accion) {
 return permisos[usuario.rol].includes(acción); 
}`,
    run: (model) => ({
 estado: model.permissions.allowed.includes("validate") ? "ok" : "error", 
 mensaje: 'Rol ${model.permissions.role} con permisos ${model.permissions.allowed.join(", ")}', 
    }),
  },
  {
    id: 12,
    title: "Regla 12: Auditoría final Go / No-Go",
    description: "Bloquea exportación con errores críticos.",
 código: 'auditoriaFinal(proyecto) { 
  const reglasCriticas = [3,4,5,6,7];
  return reglasCriticas.some(r => proyecto.reglas[r].estado === 'ERROR')
    ? 'NO-GO'
    : 'GO';
}`,
    run: () => ({
 Estado: "advertencia", 
      message: "Pendiente de auditoría completa (reglas críticas) ",
    }),
  },
];

const flowEtapas = [ 
  {
    title: "1️⃣ Cliente – Idea / Preventa",
 Artículos: [ 
      "Define ancho, largo, altura y uso.",
      "Genera proyecto en estado IDEA.",
      "Métricas instantáneas: peso y costo estimado.",
      "No puede cambiar perfiles ni uniones.",
    ],
    goal: "Decisión comercial rápida y clara.",
  },
  {
    title: "2️⃣ Ingeniería – Definición Técnica",
 Artículos: [ 
      "Cambia estado a INGENIERÍA.",
      "Define sistema estructural, perfiles y uniones.",
      "Valida reglas geométricas y dimensionales.",
    ],
    goal: "Modelo estructural correcto y fabricable.",
  },
  {
    title: "3️⃣ BIM / Coordinación",
    items: ["Revisión del modelo.", "Exportaciones IFC, DXF y PDF."],
 objetivo: "Modelo interoperable y limpio.", 
  },
  {
    title: "4️⃣ Fabricación – Despiece",
 Artículos: [ 
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

const bimTreeData = [
  {
    title: "Proyecto",
 Hijos: [ 
      {
 título: "Naves", 
 Hijos: [ 
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
 const data = Object.fromEntries(new FormData(wizardForm).entrries()); 
  state.wizardData = data;
 wizardSummary.innerHTML = ' 
 <p><fuerte>Tipo:</fuerte> ${data.type}</p> 
    <p><strong>Ubicación:</strong> ${data.ubicacion}</p>
 <p><fuerte>Dimensiones:</fuerte> ${data.width}m x ${data.length}m · Height ${data.height}m</p> 
 <p><strong>porticos:</strong> ${data.porticos}</p> 
 <p><strong>System:</strong> ${data.portico}, ${data.profile}</p> 
    <p><strong>Cubierta:</strong> ${data.cubierta} · Cerramientos ${data.cerramiento}</p>
  `;
};

const saveWorkspace = (data) => { 
 localStorage.setItem("rmm-workspace", JSON.stringify(data)); 
const summarizeResults = (results, title) => {
  const stats = results.reduce(
    (acc, item) => {
 acc[ítem.estado] += 1; 
 Retorno de la ACC; 
    },
 { ok: 0, advertencia: 0, error: 0 } 
  );
 const status = stats.error > 0 ? "error" : stats.warning > 0 ? "advertencia": "vale"; 
  return {
 Estado, 
 mensaje: '${título}: ${stats.ok} OK · Advertencia de ${stats.warning} · ${stats.error} error', 
  };
};

const loadWorkspace = () => { 
 const almacenado = localAlmacenamiento.getItem("rmm-workspace"); 
 si (!almacenado) devuelve null; 
  Prueba {
 devuelvo a JSON.analizar (almacenar); 
  } atrapar {
 return null; 
  }
const renderBimTree = () => {
  const treeRoot = document.getElementById("bim-tree");
  treeRoot.innerHTML = "";
 const renderNode = (nodo, profundidad = 0) => { 
    const wrapper = document.createElement("div");
    wrapper.className = "tree-item";
 wrapper.style.marginLeft = '${depth * 16}px'; 
 wrapper.textContent = node.title || nodo; 
 treeRoot.appendChild(envoltorio); 
 si (nodo.hijos) { 
 node.children.forEach((hijo) = > renderNode(hijo, profundidad + 1)); 
    }
  };
 bimTreeData.forEach((nodo) => renderNode(node)); 
};

documentar.addEventListener("DOMContentLoaded", () => { 
 documentar.querySelectorAll("[data-modal]").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const modal = documento.getElementById(botón.conjunto de datos.modal); 
 if (modal) openModal(modal); 
    });
const renderFlow = () => {
  flowCards.innerHTML = "";
  flowStages.forEach((stage) => {
 const card = document.createElement("artículo"); 
    card.className = "card";
 card.innerHTML = ' 
      <h3>${stage.title}</h3>
 <ul>${stage.items.map((item) => '<li>${item}</li>').join("")}</ul> 
 ${stage.goal ? '<p class="helper"><strong>Objetivo:</strong> ${stage.goal}</p>' : ""} 
    `;
    flowCards.appendChild(card);
  });
};

 documentar.querySelectorAll("[data-close]").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const modal = botón.el más cercano(".modal"); 
 si (mayúscula) cerrarCapital(mayúscula); 
const renderRules = (resultados = []) => { 
  rulesList.innerHTML = "";
  results.forEach((result, index) => {
 regla const = rulesCatalog[index]; 
    const item = document.createElement("div");
 nombre.clase.= "elemento-regla"; 
 item.innerHTML = ' 
      <div class="rule-status ${result.status}">${result.status}</div>
 <fuerte>${rule.title}</fuerte> 
      <p>${result.message}</p>
    `;
    item.addEventListener("click", () => {
      document.querySelectorAll(".rule-item").forEach((el) =>
 el.classList.remove("activo") 
      );
      item.classList.add("active");
 rulesDetail.innerHTML = ' 
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

 documento.querySelectorAll(".modal").forEach((modal) => { 
 modal.addEventListener("click", (event) => { 
 si (evento.objetivo === capital) cerrarModal(capital); 
    });
const runRules = () => {
 resultados const = rulesCatalog.map((rule) => rule.run(sampleModel)); 
 state.rulesResults = resultados; 
 renderRules(resultados); 
  const errors = results.filter((r) => r.status === "error").length;
 advertencias const = results.filter((r) => r.status === "advertencia").length; 
  rulesSummary.textContent = `Validación completa: ${errors} errores · ${warnings} warnings.`;
 sampleModel.export.canExport = errores === 0; 
 exportStatus.textContent = sampleModel.export.can 
    ? "Exportación habilitada."
    : "Exportación bloqueada por errores críticos.";
};

const calculateCost = () => {
  const priceKg = Number(document.getElementById("price-kg").value);
  const coefFab = Number(document.getElementById("coef-fab").value);
  const coefMont = Number(document.getElementById("coef-mont").value);
 const pesoTotal = muestraModelo.costo.totalPesoKg; 
 const costoMaterial = pesoTotal * precioKg; 
  const costoFabricacion = pesoTotal * coefFab;
  const costoMontaje = (costoMaterial + costoFabricacion) * coefMont;
  const costoTotal = costoMaterial + costoFabricacion + costoMontaje;
 resumen const = document.getElementById("resumen de costes"); 
 summary.innerHTML = ' 
 <p>Peso total: ${pesoTotal.toLocaleString("en-AR")} kg</w> 
    <p>Material: $${costoMaterial.toLocaleString("es-AR")}</p>
    <p>Fabricación: $${costoFabricacion.toLocaleString("es-AR")}</p>
    <p>Montaje: $${costoMontaje.toLocaleString("es-AR")}</p>
    <p><strong>Total:</strong> $${costoTotal.toLocaleString("es-AR")}</p>
  `;
};

const openModal = () => {
  const modal = document.getElementById("demo-modal");
 modal.classList.add ("activo"); 
 modal.setAttribute("aria-oculta", "falsa"); 
};

const closeModal = () => {
  const modal = document.getElementById("demo-modal");
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
};

const setRole = (rol) => { 
 document.getElementById("role-status").textContent = 'Rol seleccionado: ${role}.'; 
};

const scrollToTarget = (target) => {
  const element = document.querySelector(target);
 si (elemento) { 
    element.scrollIntoView({ behavior: "smooth" });
  }
};

const bindEvents = () => {
  document.querySelectorAll("[data-action='open-demo']").forEach((btn) => {
    btn.addEventListener("click", openModal);
  });
  document.querySelector("[data-action='close-modal']").addEventListener("click", closeModal);
  document.querySelector("#demo-modal").addEventListener("click", (event) => {
 si (event.target.id === "demo-modal") { 
      closeModal();
    }
  });

 documentar.querySelectorAll("[data-scroll]").forEach((button) => { 
 botón.addEventListener("click", () => { 
 objetivo const = documento. QuerySelector(botón.conjunto de datos.scroll); 
 si (objetivo) objetivo.scrollIntoView({ behavior: "smooth" }); 
    });
  document.querySelectorAll("[data-action='select-role']").forEach((button) => {
    button.addEventListener("click", () => setRole(button.dataset.role));
  });

 documentar.querySelectorAll("[data-action='sync']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      updateViewer();
      button.textContent = "Modelo sincronizado";
      setTimeout(() => {
        button.textContent = "Sincronizar modelo";
      }, 1600);
    });
  document.querySelectorAll("[data-action='scroll']").forEach((button) => {
    button.addEventListener("click", () => scrollToTarget(button.dataset.target));
  });

 documentar.querySelectorAll("[data-action='materials']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      generateMaterials();
      button.textContent = "Listado actualizado";
  stepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setWizardStep(Number(button.dataset.step));
      collectWizardData();
    });
  });

 documentar.querySelectorAll("[data-action='progress']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      actualizaciónProgreso();
      button.textContent = state.progress === 100 ? "Avance completo" : "Actualizar avance";
    });
  document.querySelector("[data-action='next']").addEventListener("click", () => {
 const nextStep = Math.min(4, state.wizardPaso + 1); 
 pasoMágico(siguientePaso); 
    collectWizardData();
  });

 documentar.querySelectorAll("[data-action='share']").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const workspace = loadWorkspace(); 
  estado const = documento.getElementById("share-status"); 
 if (!workspace) { 
        status.textContent = "Crea un workspace antes de invitar al equipo.";
        devolución;
      }
      status.textContent = `Invitaciones enviadas para ${workspace.project}.`;
    });
  document.querySelector("[data-action='prev']").addEventListener("click", () => {
    const prevStep = Math.max(1, state.wizardStep - 1);
 pasoAsistente (pasoprevSiguiente); 
    collectWizardData();
  });

 documentar.querySelectorAll("[data-action='tour']").forEach((button) => { 
 botón.addEventListener("click", () => { 
  estado const = documento.getElementById("estado de la gira"); 
      status.textContent = "Recorrido en curso: modelado → CNC → montaje.";
    });
  wizardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    collectWizardData();
    wizardStatus.textContent = "Modelo 3D generado. Puedes continuar con el editor BIM.";
  });

 documentar.querySelectorAll("[data-action='analyze']").forEach((button) => { 
 botón.addEventListener("click", () => { 
  estado const = documento.getElementById("estado-análisis"); 
      status.innerHTML = "<span>✓ Interferencias críticas resueltas</span><span>✓ Se actualizaron 8 conexiones</span>";
      button.textContent = "Análisis completado";
    });
 document.querySelector("[data-action='calc-cost']").addEventListener("click", (evento) => { 
    event.preventDefault();
    calculateCost();
  });

 const ifcInput = documento.getElementById("ifc-input"); 
 si (ifcInput) { 
 ifcInput.addEventListener("change", () => { 
  estado const = documento.getElementById("ifc-status"); 
 const fileName = ifcInput.archivos[0]?. Nombre || "Sin archivo"; 
 Estado.textContent = 'Archivo cargado: ${nombrefile}'; 
    });
  }
  document.querySelector("[data-action='share']").addEventListener("click", () => {
    shareStatus.textContent = "Link generado: rmmstructures.com/proyecto/abc123";
  });

 const projectForm = documento.getElementById("forma-proyecto"); 
 if (projectForm) { 
 proyectoForma.addEventListener("submit", (event) => { 
 event.preventDefault(); 
 const formData = nuevo FormData(projectForm); 
 const data = Objeto.fromEntrries(formData.entradas()); 
 updateWorkspace(data); 
 saveWorkspace(data); 
 documentar.getElementById("estado del proyecto").textContent = 
        `Workspace creado para ${data.project}.`;
    });
  }
  document.querySelector("[data-action='export']").addEventListener("click", () => {
 exportStatus.textContent = sampleModel.export.can 
      ? "Exportación IFC/DXF/PDF iniciada."
      : "No se puede exportar: existen errores críticos.";
  });

 const demoForm = documento.getElementById("demo-form"); 
 if (demoForm) { 
 demoForm.addEventListener("submit", (event) => { 
 event.preventDefault(); 
 documentar.getElementById("demo-status").textContent= 
        "Demo agendada. Nuestro equipo te contactará en las próximas 24 horas.";
    });
  }
  document.querySelector("[data-action='run-rules']").addEventListener("click", runRules);
};

 const consultingForm = documento.getElementById("consultora-formulario"); 
 if (consultingForm) { 
 Formulario de consultoría.addEventListener("submit", (event) => { 
 event.preventDefault(); 
 documentar.getElementById("consulting-status").textContent = 
        "Solicitud enviada. Un especialista BIM te escribirá hoy.";
    });
  }
const init = () => {
  renderBimTree();
  renderFlow();
  collectWizardData();
  renderRules(rulesCatalog.map((rule) => ({ status: "warning", message: rule.description })));
  bindEvents();
};

 const storedWorkspace = loadWorkspace(); 
 if (storedWorkspace) { 
 updateWorkspace(storedWorkspace); 
 documentar.getElementById("estado del proyecto").textContent = 
 'Workspace activo: ${storedWorkspace.project}.'; 
  }
});
document.addEventListener("DOMContentLoaded", init);
