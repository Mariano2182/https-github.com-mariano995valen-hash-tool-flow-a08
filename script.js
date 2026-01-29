 estado const = { 
 progreso: 62, 
 espectadoresPiezas: 1420, 
 espectadorPrecisión: 98, 
};

const formatNumber = (valor) = > valor.toLocaleString("es-CL"); 

const openModal = (modal) => { 
 modal.ListaClase.add("activo"); 
 modal.setAttribute("aria-oculta", "falsa"); 
};

const closeModal = (modal) => { 
 modal.ListaClase.remove("activo"); 
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
  });
};

const updateWorkspace = (data) => { 
 documentar.getElementById("proyecto-espacio de trabajo").textoContenido = datos.proyecto; 
 documentar.getElementById("workspace-location").textoContenido = datos.ubicación; 
 documentar.getElementById("tonelada-espacio de trabajo").textContent = '${data.tonnage} t'; 
 documentar.getElementById("etapa de espacio de trabajo").textoContenido = datos.prácticas; 
};

const saveWorkspace = (data) => { 
 localStorage.setItem("rmm-workspace", JSON.stringify(data)); 
};

const loadWorkspace = () => { 
 const almacenado = localAlmacenamiento.getItem("rmm-workspace"); 
 si (!almacenado) devuelve null; 
  Prueba {
 devuelvo a JSON.analizar (almacenar); 
  } atrapar {
 return null; 
  }
};

documentar.addEventListener("DOMContentLoaded", () => { 
 documentar.querySelectorAll("[data-modal]").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const modal = documento.getElementById(botón.conjunto de datos.modal); 
 if (modal) openModal(modal); 
    });
  });

 documentar.querySelectorAll("[data-close]").forEach((button) => { 
 botón.addEventListener("click", () => { 
 const modal = botón.el más cercano(".modal"); 
 si (modal) closeModal(modal); 
    });
  });

 documento.querySelectorAll(".modal").forEach((modal) => { 
 modal.addEventListener("click", (event) => { 
 si (evento.objetivo === capital) cerrarModal(capital); 
    });
  });

 documentar.querySelectorAll("[data-scroll]").forEach((button) => { 
 botón.addEventListener("click", () => { 
  objetivo const = documento.QuerySelector(botón.conjunto de datos.scroll); 
 si (objetivo) objetivo.scrollIntoView({ behavior: "smooth" }); 
    });
  });

 documentar.querySelectorAll("[data-action='sync']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      updateViewer();
      button.textContent = "Modelo sincronizado";
      setTimeout(() => {
        button.textContent = "Sincronizar modelo";
      }, 1600);
    });
  });

 documentar.querySelectorAll("[data-action='materials']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      generateMaterials();
      button.textContent = "Listado actualizado";
    });
  });

 documentar.querySelectorAll("[data-action='progress']").forEach((button) => { 
 botón.addEventListener("click", () => { 
      actualizaciónProgreso();
      button.textContent = state.progress === 100 ? "Avance completo" : "Actualizar avance";
    });
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
  });

 documentar.querySelectorAll("[data-action='tour']").forEach((button) => { 
 botón.addEventListener("click", () => { 
  estado const = documento.getElementById("estado de la gira"); 
      status.textContent = "Recorrido en curso: modelado → CNC → montaje.";
    });
  });

 documentar.querySelectorAll("[data-action='analyze']").forEach((button) => { 
 botón.addEventListener("click", () => { 
  estado const = documento.getElementById("estado-análisis"); 
      status.innerHTML = "<span>✓ Interferencias críticas resueltas</span><span>✓ Se actualizaron 8 conexiones</span>";
      button.textContent = "Análisis completado";
    });
  });

 const ifcInput = documento.getElementById("ifc-input"); 
 si (ifcInput) { 
 ifcInput.addEventListener("change", () => { 
  estado const = documento.getElementById("ifc-status"); 
  const fileName = ifcInput.archivos[0]?.Nombre || "Sin archivo"; 
 Estado.textContent = 'Archivo cargado: ${nombrefile}'; 
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
    });
  }

 const demoForm = documento.getElementById("demo-form"); 
 if (demoForm) { 
 demoForm.addEventListener("submit", (event) => { 
 evento.preventDefault(); 
 documentar.getElementById("demo-status").textContent = 
        "Demo agendada. Nuestro equipo te contactará en las próximas 24 horas.";
    });
  }

 const consultingForm = documento.getElementById("consultora-formulario"); 
 if (consultingForm) { 
 Formulario de consultoría.addEventListener("submit", (event) => { 
 evento.preventDefault(); 
 documentar.getElementById("consulting-status").textContent = 
        "Solicitud enviada. Un especialista BIM te escribirá hoy.";
    });
  }

 const storedWorkspace = loadWorkspace(); 
 if (storedWorkspace) { 
 updateWorkspace(storedWorkspace); 
 documentar.getElementById("estado del proyecto").textContent = 
 'Workspace activo: ${storedWorkspace.project}.'; 
  }
});
