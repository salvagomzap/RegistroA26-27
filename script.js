import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/* =========================================================
   CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBfxwGc2DmAaZGxPME2hwkOSlTbFs5mh3o",
  authDomain: "registro-apuestas-6bec2.firebaseapp.com",
  projectId: "registro-apuestas-6bec2",
  storageBucket: "registro-apuestas-6bec2.firebasestorage.app",
  messagingSenderId: "568936374678",
  appId: "1:568936374678:web:f2e51ba5055cb3c837bdb7",
  measurementId: "G-7FNS9FJ4PL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rondas = ["Dieciseisavos", "Octavos", "Cuartos", "Semifinal", "Final"];

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

const prefijosFijos = {
  "tabla-jornadas-eliminatorias": "E",
  "tabla-tenis": "P",
  "tabla-nba": "P",
  "tabla-partidos": "P"
};

const tablasAbiertas = ["tabla-apuestas1"];
const filasInicialesAbiertas = { "tabla-apuestas1": 2 };

/* =========================================================
   AUTENTICACIÓN Y SESIÓN EN LA NUBE (FIREBASE AUTH)
========================================================= */

onAuthStateChanged(auth, async (user) => {
  const cabecera = document.querySelector(".cabecera");
  const rutaActual = window.location.pathname;

  const esPaginaLogin = rutaActual.endsWith("login.html");
  const esPaginaRegistro = rutaActual.endsWith("registro.html");
  const esPaginaPublica = esPaginaLogin || 
                           esPaginaRegistro || 
                           rutaActual.endsWith("index.html") || 
                           rutaActual === "/" || 
                           rutaActual.endsWith("/");

  if (user) {
    if (cabecera) {
      const usuarioEl = document.getElementById("usuario-conectado");
      if (usuarioEl) usuarioEl.textContent = "Hola, " + user.email;
      const salir = document.querySelector(".cerrar-sesion");
      if (salir) {
        salir.onclick = () => signOut(auth).then(() => location.href = "login.html");
      }
    }

    if (esPaginaLogin || esPaginaRegistro) {
      location.href = "panel.html";
      return;
    }

    await inicializarTablas();
  } else {
    if (!esPaginaPublica) {
      location.href = "login.html";
    }
  }
});

/* ---- Formulario de registro (registro.html) ---- */
const formRegistro = document.getElementById("form-registro");
if (formRegistro) {
  formRegistro.addEventListener("submit", async function (e) {
    e.preventDefault();
    const inputEmail = document.getElementById("email") || document.getElementById("usuario");
    const inputPassword = document.getElementById("password");

    const email = inputEmail ? inputEmail.value.trim() : "";
    const password = inputPassword ? inputPassword.value : "";

    if (!email || !password) {
      alert("Por favor, rellena el correo y la contraseña.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Cuenta creada con éxito.");
      location.href = "panel.html";
    } catch (error) {
      console.error("Error al registrar:", error);
      alert("Error al registrar: " + traducirErrorFirebase(error.code));
    }
  });
}

/* ---- Formulario de login (login.html) ---- */
const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", async function (e) {
    e.preventDefault();
    const inputEmail = document.getElementById("email") || document.getElementById("usuario");
    const inputPassword = document.getElementById("password");

    const email = inputEmail ? inputEmail.value.trim() : "";
    const password = inputPassword ? inputPassword.value : "";

    if (!email || !password) {
      alert("Introduce tu usuario/correo y contraseña.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      location.href = "panel.html";
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("Error al iniciar sesión: " + traducirErrorFirebase(error.code));
    }
  });
}

function traducirErrorFirebase(codigo) {
  switch (codigo) {
    case "auth/invalid-email":
      return "El formato del correo electrónico no es válido (ejemplo: usuario@email.com).";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Usuario o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Este correo ya está registrado.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    default:
      return "Ocurrió un error (" + codigo + "). Comprueba tus datos.";
  }
}

/* =========================================================
   GESTIÓN DE FIRESTORE Y TABLAS
========================================================= */

async function obtenerDatosTabla(tablaId) {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const docRef = doc(db, "usuarios", user.uid, "tablas", tablaId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data().filas || {} : {};
  } catch (e) {
    console.error("Error cargando datos de Firestore:", e);
    return {};
  }
}

async function guardarFila(tablaId, fila) {
  const user = auth.currentUser;
  if (!user) return;

  const datos = await obtenerDatosTabla(tablaId);
  const numero = fila.dataset.fila;

  const apuesta = fila.querySelector(".apuesta");
  const cuota = fila.querySelector(".cuota");
  const dinero = fila.querySelector(".dinero-apostado");
  const obtenido = fila.querySelector(".dinero-obtenido");
  const estado = fila.querySelector(".estado");
  const ronda = fila.querySelector(".ronda");

  datos[numero] = {
    apuesta: apuesta ? apuesta.value : "",
    cuota: cuota ? cuota.value : "",
    dinero: dinero ? dinero.value : "",
    obtenido: obtenido ? obtenido.value : "",
    estado: estado ? estado.value : "PENDIENTE",
    ronda: ronda ? ronda.value : ""
  };

  try {
    const docRef = doc(db, "usuarios", user.uid, "tablas", tablaId);
    await setDoc(docRef, { filas: datos }, { merge: true });
    marcarFila(fila);
    await actualizarResumen(tablaId);
    alert("Fila guardada en la nube.");
  } catch (e) {
    alert("Error al guardar en la nube: " + e.message);
  }
}

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

async function crearTablaFija(id, total) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  tbody.innerHTML = "";
  const conRonda = id === "tabla-jornadas-eliminatorias";
  const prefijo = prefijosFijos[id] || "J";
  
  for (let i = 1; i <= total; i++) {
    crearFila(tbody, i, prefijo, conRonda);
  }
  
  await cargarDatos(id);
  await actualizarResumen(id);
}

async function contarFilasAbiertas(id) {
  const datos = await obtenerDatosTabla(id);
  const numGuardadas = Object.keys(datos).length;
  return Math.max(numGuardadas, filasInicialesAbiertas[id] || 0);
}

async function crearTablaAbierta(id) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  tbody.innerHTML = "";
  const total = await contarFilasAbiertas(id);
  for (let i = 1; i <= total; i++) crearFila(tbody, i, "P", false);
  await cargarDatos(id);
  await actualizarResumen(id);
}

async function anadirFilaAbierta(id) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  const totalActual = tbody.querySelectorAll("tr").length;
  const nuevoNumero = totalActual + 1;
  crearFila(tbody, nuevoNumero, "P", false);
}

async function cargarDatos(id) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  const datos = await obtenerDatosTabla(id);
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

function marcarFila(fila) {
  const estado = fila.querySelector(".estado") ? fila.querySelector(".estado").value : "";
  fila.classList.remove("fila-ganada", "fila-perdida");
  if (estado === "GANADA") fila.classList.add("fila-ganada");
  else if (estado === "PERDIDA") fila.classList.add("fila-perdida");
}

function formatoEuros(valor) {
  return (parseFloat(valor) || 0).toFixed(2).replace(".", ",") + " €";
}

function estadoResumen(estado) {
  if (estado === "GANADA") return "EN CURSO";
  if (estado === "PERDIDA") return "PERDIDA";
  return "PENDIENTE";
}

async function actualizarResumen(id) {
  const resumen = document.querySelector(".resumen-reto");
  if (!resumen) return;
  const celdas = resumen.querySelectorAll(".numero");
  if (celdas.length < 4) return;
  
  const datos = await obtenerDatosTabla(id);
  const numeros = Object.keys(datos).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

  if (id === "tabla-apuestas1") {
    let totalApostado = 0;
    let totalObtenido = 0;

    numeros.forEach(function (numeroFila) {
      const fila = datos[numeroFila];
      const apostado = parseFloat(fila.dinero) || 0;
      const obtenido = parseFloat(fila.obtenido) || 0;

      totalApostado += apostado;
      if (fila.estado === "GANADA") totalObtenido += obtenido;
    });

    celdas[0].textContent = String(numeros.length);
    celdas[1].textContent = formatoEuros(totalApostado);
    celdas[2].textContent = formatoEuros(totalObtenido);
    celdas[3].textContent = "EN CURSO";
    return;
  }

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

async function renderizarTarjetasPanel() {
  const contenedor = document.getElementById("contenedor-tarjetas-retos");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  for (const reto of listaRetosPanel) {
    const totalFilas = tablasFijas[reto.id] || 1;
    const datos = await obtenerDatosTabla(reto.id);
    const numeros = Object.keys(datos).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

    let estadoFila = "EN CURSO";
    let claseEstado = "reto-en-curso";
    let premioTexto = "-";

    if (numeros.length > 0) {
      if (reto.id === "tabla-apuestas1") {
        let totalObtenido = 0;
        numeros.forEach(n => {
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
  }
}

async function inicializarTablas() {
  const cuerposTabla = document.querySelectorAll("tbody[id]");
  for (const tbody of cuerposTabla) {
    const id = tbody.id;
    if (tablasFijas[id]) {
      await crearTablaFija(id, tablasFijas[id]);
    } else if (tablasAbiertas.includes(id)) {
      await crearTablaAbierta(id);
    }
  }
  await renderizarTarjetasPanel();
}

/* =========================================================
   GESTIÓN GLOBAL DE EVENTOS (CLICS Y CAMBIOS)
========================================================= */

document.addEventListener("click", function (e) {
  if (!e.target.classList.contains("guardar")) return;
  
  const fila = e.target.closest("tr");
  const tbody = e.target.closest("tbody");
  
  if (!fila || !tbody || !tbody.id) {
    alert("Error: No se encuentra la tabla o la fila.");
    return;
  }
  
  const tablaId = tbody.id;
  guardarFila(tablaId, fila);
});

document.addEventListener("change", function (e) {
  if (e.target.classList.contains("estado")) {
    const fila = e.target.closest("tr");
    if (fila) marcarFila(fila);
  }
});

document.querySelectorAll(".boton-principal[data-tabla]").forEach(function (boton) {
  boton.addEventListener("click", async function () {
    const id = boton.dataset.tabla;
    const tbody = document.getElementById(id);
    if (!tbody) return;
    
    const nuevoNumero = tbody.querySelectorAll("tr").length + 1;
    crearFila(tbody, nuevoNumero, "P", false);
  });
});