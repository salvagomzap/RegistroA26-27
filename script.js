document.addEventListener("DOMContentLoaded", function () {

  /* =========================================================
     CONFIGURACIÓN GENERAL
  ========================================================= */
  const STORAGE_PREFIX = "tabla_apuestas_";
  const USERS_KEY = "usuarios_registrados";
  const SESSION_KEY = "sesion_actual";
  const rondas = ["Dieciseisavos", "Octavos", "Cuartos", "Semifinal", "Final"];

  // Tablas de tamaño fijo: id del tbody -> número total de filas
  const tablasFijas = {
    "tabla-jornadas": 38,
    "tabla-jornadas-madrid": 38,
    "tabla-jornadas-barcelona": 38,
    "tabla-jornadas-bayern": 38,
    "tabla-jornadas-laliga": 38,
    "tabla-jornadas-premier": 38,
    "tabla-jornadas-grupos": 38,
    "tabla-jornadas-eliminatorias": 11,
    "tabla-tenis": 21,
    "tabla-nba": 17,
    "tabla-partidos": 17
  };

  // Prefijo de cada fila según la tabla (por defecto "J")
  const prefijosFijos = {
    "tabla-jornadas-eliminatorias": "E",
    "tabla-tenis": "P",
    "tabla-nba": "P",
    "tabla-partidos": "P"
  };

  // Tablas abiertas: se van añadiendo filas con el botón "+ Añadir partido"
  const tablasAbiertas = ["tabla-apuestas1"];
  // Filas con las que empieza cada tabla abierta si el usuario nunca ha tocado nada
  const filasInicialesAbiertas = { "tabla-apuestas1": 2 };

  /* =========================================================
     USUARIOS / SESIÓN (simulado en el navegador, sin servidor)
  ========================================================= */
  function obtenerUsuarios() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  }
  function guardarUsuarios(lista) {
    localStorage.setItem(USERS_KEY, JSON.stringify(lista));
  }
  function registrarUsuario(usuario, password) {
    const usuarios = obtenerUsuarios();
    const yaExiste = usuarios.some(function (u) {
      return u.usuario.toLowerCase() === usuario.toLowerCase();
    });
    if (yaExiste) return { ok: false, mensaje: "Ese usuario ya existe." };
    usuarios.push({ usuario: usuario, password: password });
    guardarUsuarios(usuarios);
    return { ok: true };
  }
  function iniciarSesion(usuario, password) {
    const usuarios = obtenerUsuarios();
    const encontrado = usuarios.find(function (u) {
      return u.usuario.toLowerCase() === usuario.toLowerCase() && u.password === password;
    });
    if (!encontrado) return { ok: false, mensaje: "Usuario o contraseña incorrectos." };
    localStorage.setItem(SESSION_KEY, encontrado.usuario);
    return { ok: true };
  }
  function cerrarSesion() {
    localStorage.removeItem(SESSION_KEY);
  }
  function sesionActiva() {
    return localStorage.getItem(SESSION_KEY);
  }
  // Clave de almacenamiento única para cada usuario + tabla
  function claveAlmacen(id) {
    const usuario = sesionActiva() || "invitado";
    return STORAGE_PREFIX + usuario + "_" + id;
  }

  /* ---- Botones de la portada (index.html) ---- */
  const btnLogin = document.getElementById("btnLogin");
  const btnRegistro = document.getElementById("btnRegistro");
  if (btnLogin) btnLogin.addEventListener("click", function () { location.href = "login.html"; });
  if (btnRegistro) btnRegistro.addEventListener("click", function () { location.href = "registro.html"; });

  /* ---- Formulario de registro ---- */
  const formRegistro = document.getElementById("form-registro");
  if (formRegistro) {
    formRegistro.addEventListener("submit", function (e) {
      e.preventDefault();
      const usuario = document.getElementById("usuario").value.trim();
      const password = document.getElementById("password").value;
      if (!usuario || !password) { alert("Rellena usuario y contraseña."); return; }
      const resultado = registrarUsuario(usuario, password);
      if (!resultado.ok) { alert(resultado.mensaje); return; }
      alert("Cuenta creada. Ahora inicia sesión.");
      location.href = "login.html";
    });
  }

  /* ---- Formulario de login ---- */
  const formLogin = document.getElementById("form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", function (e) {
      e.preventDefault();
      const usuario = document.getElementById("usuario").value.trim();
      const password = document.getElementById("password").value;
      const resultado = iniciarSesion(usuario, password);
      if (!resultado.ok) { alert(resultado.mensaje); return; }
      location.href = "panel.html";
    });
  }

  /* ---- Protección de páginas internas (todas las que tienen cabecera) ---- */
  const cabecera = document.querySelector(".cabecera");
  if (cabecera) {
    if (!sesionActiva()) {
      location.href = "login.html";
      return;
    }
    const usuarioEl = document.getElementById("usuario-conectado");
    if (usuarioEl) usuarioEl.textContent = "Hola, " + sesionActiva();
    const salir = document.querySelector(".cerrar-sesion");
    if (salir) salir.addEventListener("click", function () { cerrarSesion(); });
  }

  /* =========================================================
     TABLAS DE JORNADAS / PARTIDOS
  ========================================================= */
  function crearFila(tbody, numero, prefijo, conRonda) {
    const tr = document.createElement("tr");
    tr.dataset.fila = numero;
    let html = "<td>" + prefijo + numero + "</td>";
    if (conRonda) {
      html += "<td><select class='ronda'>";
      rondas.forEach(function (r) { html += "<option value='" + r + "'>" + r + "</option>"; });
      html += "</select></td>";
    }
    html += "<td><input type='text' class='apuesta'></td>";
    html += "<td><input type='number' class='cuota' step='0.01' min='0'></td>";
    html += "<td><input type='number' class='dinero-apostado' step='0.01' min='0'></td>";
    html += "<td><input type='number' class='dinero-obtenido' step='0.01' min='0'></td>";
    html += "<td><select class='estado'><option value='PENDIENTE'>PENDIENTE</option><option value='GANADA'>GANADA</option><option value='PERDIDA'>PERDIDA</option></select></td>";
    html += "<td><button type='button' class='guardar'>GUARDAR</button></td>";
    tr.innerHTML = html;
    tbody.appendChild(tr);
  }

  function crearTablaFija(id, total) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    tbody.innerHTML = "";
    const conRonda = id === "tabla-jornadas-eliminatorias";
    const prefijo = prefijosFijos[id] || "J";
    for (let i = 1; i <= total; i++) crearFila(tbody, i, prefijo, conRonda);
    cargarDatos(id);
    actualizarResumen(id);
  }

  function contarFilasAbiertas(id) {
    const valor = localStorage.getItem(claveAlmacen(id) + "_count");
    if (valor !== null) return parseInt(valor, 10);
    return filasInicialesAbiertas[id] || 0;
  }
  function guardarContadorAbiertas(id, n) {
    localStorage.setItem(claveAlmacen(id) + "_count", String(n));
  }
  function crearTablaAbierta(id) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    tbody.innerHTML = "";
    const total = contarFilasAbiertas(id);
    for (let i = 1; i <= total; i++) crearFila(tbody, i, "P", false);
    cargarDatos(id);
    actualizarResumen(id);
  }
  function anadirFilaAbierta(id) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    const nuevoNumero = contarFilasAbiertas(id) + 1;
    guardarContadorAbiertas(id, nuevoNumero);
    crearFila(tbody, nuevoNumero, "P", false);
    actualizarResumen(id);
  }

  function cargarDatos(id) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    const datos = JSON.parse(localStorage.getItem(claveAlmacen(id)) || "{}");
    tbody.querySelectorAll("tr").forEach(function (fila) {
      const numero = fila.dataset.fila;
      if (!datos[numero]) return;
      const d = datos[numero];
      const apuesta = fila.querySelector(".apuesta");
      const cuota = fila.querySelector(".cuota");
      const dinero = fila.querySelector(".dinero-apostado");
      const obtenido = fila.querySelector(".dinero-obtenido");
      const estado = fila.querySelector(".estado");
      const ronda = fila.querySelector(".ronda");
      if (apuesta) apuesta.value = d.apuesta || "";
      if (cuota) cuota.value = d.cuota || "";
      if (dinero) dinero.value = d.dinero || "";
      if (obtenido) obtenido.value = d.obtenido || "";
      if (estado) estado.value = d.estado || "PENDIENTE";
      if (ronda) ronda.value = d.ronda || "Dieciseisavos";
      marcarFila(fila);
    });
  }

  function guardarFila(id, fila) {
    const datos = JSON.parse(localStorage.getItem(claveAlmacen(id)) || "{}");
    const apuesta = fila.querySelector(".apuesta");
    const cuota = fila.querySelector(".cuota");
    const dinero = fila.querySelector(".dinero-apostado");
    const obtenido = fila.querySelector(".dinero-obtenido");
    const estado = fila.querySelector(".estado");
    const ronda = fila.querySelector(".ronda");
    datos[fila.dataset.fila] = {
      apuesta: apuesta ? apuesta.value : "",
      cuota: cuota ? cuota.value : "",
      dinero: dinero ? dinero.value : "",
      obtenido: obtenido ? obtenido.value : "",
      estado: estado ? estado.value : "PENDIENTE",
      ronda: ronda ? ronda.value : ""
    };
    localStorage.setItem(claveAlmacen(id), JSON.stringify(datos));
    marcarFila(fila);
    actualizarResumen(id);
  }

  function marcarFila(fila) {
    const estado = fila.querySelector(".estado") ? fila.querySelector(".estado").value : "";
    fila.classList.remove("fila-ganada", "fila-perdida");
    if (estado === "GANADA") fila.classList.add("fila-ganada");
    else if (estado === "PERDIDA") fila.classList.add("fila-perdida");
  }

  /* =========================================================
     TARJETAS RESUMEN (Cálculos automáticos)
  ========================================================= */
  function formatoEuros(valor) {
    return (parseFloat(valor) || 0).toFixed(2).replace(".", ",") + " €";
  }
  function estadoResumen(estado) {
    if (estado === "GANADA") return "EN CURSO";
    if (estado === "PERDIDA") return "PERDIDA";
    return "PENDIENTE";
  }

  function actualizarResumen(id) {
    const resumen = document.querySelector(".resumen-reto");
    if (!resumen) return;
    const celdas = resumen.querySelectorAll(".numero");
    if (celdas.length < 4) return;
    
    const datos = JSON.parse(localStorage.getItem(claveAlmacen(id)) || "{}");
    const numeros = Object.keys(datos).map(Number).filter(function (n) { return !isNaN(n); }).sort(function (a, b) { return a - b; });

    /* Lógica para APUESTAS 1€ (Acumulativa) */
    if (id === "tabla-apuestas1") {
      let totalApostado = 0;
      let totalObtenido = 0;

      numeros.forEach(function (numeroFila) {
        const fila = datos[numeroFila];
        const apostado = parseFloat(fila.dinero) || 0;
        const obtenido = parseFloat(fila.obtenido) || 0;

        totalApostado += apostado;
        if (fila.estado === "GANADA") {
          totalObtenido += obtenido;
        }
      });

      celdas[0].textContent = String(numeros.length);
      celdas[1].textContent = formatoEuros(totalApostado);
      celdas[2].textContent = formatoEuros(totalObtenido);
      celdas[3].textContent = "EN CURSO";
      return;
    }

    /* Lógica para el resto de Retos de Reinversión */
    const total = tablasFijas[id];
    
    if (numeros.length === 0) {
      celdas[0].textContent = total ? ("0 / " + total) : "0";
      celdas[1].textContent = formatoEuros(1);
      celdas[2].textContent = formatoEuros(0);
      celdas[3].textContent = "PENDIENTE";
      return;
    }
    const ultimoNumero = numeros[numeros.length - 1];
    const ultima = datos[ultimoNumero];
    celdas[0].textContent = total ? (ultimoNumero + " / " + total) : String(ultimoNumero);
    celdas[1].textContent = formatoEuros(1);
    celdas[2].textContent = formatoEuros(ultima.obtenido);
    celdas[3].textContent = estadoResumen(ultima.estado);
  }

  /* =========================================================
     GENERACIÓN DINÁMICA DE TARJETAS EN PANEL (INICIO)
  ========================================================= */
  const listaRetosPanel = [
    { id: "tabla-jornadas", nombre: "REAL BETIS", enlace: "betis.html" },
    { id: "tabla-jornadas-barcelona", nombre: "FC BARCELONA", enlace: "barcelona.html" },
    { id: "tabla-jornadas-madrid", nombre: "REAL MADRID", enlace: "madrid.html" },
    { id: "tabla-jornadas-bayern", nombre: "BAYERN MUNICH", enlace: "bayern.html" },
    { id: "tabla-jornadas-laliga", nombre: "LA LIGA", enlace: "laliga.html" },
    { id: "tabla-jornadas-premier", nombre: "PREMIER LEAGUE", enlace: "premier.html" },
    { id: "tabla-jornadas-grupos", nombre: "FASE GRUPOS CHAMPIONS", enlace: "gruposchampions.html" },
    { id: "tabla-jornadas-eliminatorias", nombre: "ELIMINATORIAS CHAMPIONS", enlace: "eliminatoriaschampions.html" },
    { id: "tabla-tenis", nombre: "TENIS", enlace: "tenis.html" },
    { id: "tabla-nba", nombre: "PLAY OFF NBA", enlace: "nba.html" },
    { id: "tabla-partidos", nombre: "PARTIDOS ESPECIALES", enlace: "partidos.html" },
    { id: "tabla-apuestas1", nombre: "APUESTAS 1€", enlace: "apuestas1.html" }
  ];

  function renderizarTarjetasPanel() {
    const contenedor = document.getElementById("contenedor-tarjetas-retos");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    listaRetosPanel.forEach(function (reto) {
      const totalFilas = tablasFijas[reto.id] || 1;
      const datos = JSON.parse(localStorage.getItem(claveAlmacen(reto.id)) || "{}");
      const numeros = Object.keys(datos).map(Number).filter(function (n) { return !isNaN(n); }).sort(function (a, b) { return a - b; });

      let estadoFila = "EN CURSO";
      let claseEstado = "reto-en-curso";
      let premioTexto = "-";

      if (numeros.length > 0) {
        if (reto.id === "tabla-apuestas1") {
          let totalObtenido = 0;
          numeros.forEach(function (n) {
            if (datos[n].estado === "GANADA") totalObtenido += (parseFloat(datos[n].obtenido) || 0);
          });
          estadoFila = "EN CURSO";
          claseEstado = "reto-en-curso";
          premioTexto = formatoEuros(totalObtenido);
        } else {
          const ultimoNum = numeros[numeros.length - 1];
          const ultimaFila = datos[ultimoNum];

          if (ultimaFila.estado === "PERDIDA") {
            estadoFila = "PERDIDO";
            claseEstado = "reto-perdido";
            premioTexto = "0,00 €";
          } else if (ultimoNum === totalFilas && ultimaFila.estado === "GANADA") {
            estadoFila = "COMPLETADO";
            claseEstado = "reto-completado";
            premioTexto = formatoEuros(ultimaFila.obtenido);
          } else {
            estadoFila = "EN CURSO";
            claseEstado = "reto-en-curso";
            premioTexto = formatoEuros(ultimaFila.obtenido);
          }
        }
      }

      const card = document.createElement("a");
      card.href = reto.enlace;
      card.className = "tarjeta-reto " + claseEstado;
      card.innerHTML = `
        <h2>${reto.nombre}</h2>
        <div class="info-reto">
          <p><strong>ESTADO:</strong> ${estadoFila}</p>
          <p><strong>PREMIO:</strong> ${premioTexto}</p>
        </div>
      `;
      contenedor.appendChild(card);
    });
  }

  /* =========================================================
     INICIALIZACIÓN DE TABLAS EN LA PÁGINA ACTUAL
  ========================================================= */
  Object.keys(tablasFijas).forEach(function (id) {
    crearTablaFija(id, tablasFijas[id]);
  });
  tablasAbiertas.forEach(function (id) {
    crearTablaAbierta(id);
  });

  // Ejecuta la renderización de las tarjetas si estamos en panel.html
  renderizarTarjetasPanel();

  /* ---- Eventos de las tablas (guardar / cambio de estado) ---- */
  document.querySelectorAll("table").forEach(function (tabla) {
    const tbody = tabla.querySelector("tbody");
    if (!tbody || !tbody.id) return;
    const id = tbody.id;

    tabla.addEventListener("click", function (e) {
      if (!e.target.classList.contains("guardar")) return;
      const fila = e.target.closest("tr");
      guardarFila(id, fila);
    });

    tabla.addEventListener("change", function (e) {
      if (e.target.classList.contains("estado")) {
        marcarFila(e.target.closest("tr"));
      }
    });
  });

  /* ---- Botones "+ Añadir partido" de las tablas abiertas ---- */
  document.querySelectorAll(".boton-principal[data-tabla]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      anadirFilaAbierta(boton.dataset.tabla);
    });
  });

});
