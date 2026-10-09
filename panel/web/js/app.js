import * as api from "./api.js";
import * as arbol from "./arbol.js";
import * as detalle from "./detalle.js";
import * as consola from "./consola.js";
import * as historial from "./historial.js";
import * as configuracion from "./configuracion.js";
import * as flujo from "./flujo.js";
import * as ia from "./ia.js";
import { pantallaInicio } from "./componentes.js";

const treeCont = document.getElementById("tree");
const detCont = document.getElementById("detalle");

let nodoSel = null;
let moduloActivo = null;
let modoHistorial = false;
let modoIa = false;

// Ejecutar sin perder el contexto: la consola emerge; al terminar, refresca el
// detalle del caso seleccionado para reflejar el nuevo resultado.
function onRun(run, nombre) {
  consola.ejecutar(run, nombre, () => {
    // (no pisa la pantalla de flujo si es la que está a la vista)
    if (!modoHistorial && !modoIa && nodoSel && !detCont.querySelector(".flujo")) detalle.abrir(detCont, nodoSel, onRun);
  });
}

async function cargarArbol() {
  const d = await api.arbol();
  if (!moduloActivo && d.modulos[0]) moduloActivo = d.modulos[0].id;
  arbol.render(
    treeCont,
    d,
    (n) => {
      nodoSel = n;
      moduloActivo = n.modulo;
      detalle.abrir(detCont, n, onRun);
      document.querySelector(".app-sidebar").classList.remove("abierto"); // cierra el drawer en móvil
    },
    onRun
  );
  aplicarFiltro();
}

async function setModo(hist) {
  modoHistorial = hist;
  modoIa = false;
  document.getElementById("tg-tests").classList.toggle("activo", !hist);
  document.getElementById("tg-hist").classList.toggle("activo", hist);
  document.getElementById("tg-ia").classList.remove("activo");
  if (hist) {
    await historial.render(treeCont, moduloActivo, (m, r) => historial.abrirCorrida(detCont, m, r));
  } else {
    await cargarArbol();
  }
}

// Casos de Uso IA: sección independiente (sidebar = corridas de IA; principal = subir PDF / resultado).
async function abrirIa() {
  modoIa = true;
  modoHistorial = false;
  document.getElementById("tg-tests").classList.remove("activo");
  document.getElementById("tg-hist").classList.remove("activo");
  document.getElementById("tg-ia").classList.add("activo");
  const lista = () => ia.renderLista(treeCont, (runId) => ia.mostrarCorrida(detCont, runId));
  await lista();
  await ia.abrir(detCont, lista);
}

function aplicarFiltro() {
  const q = (document.getElementById("search").value || "").toLowerCase();
  treeCont.querySelectorAll(".tree-caso").forEach((nodo) => {
    const lbl = nodo.querySelector(".tree-lbl");
    if (!lbl) return;
    const visible = !q || lbl.textContent.toLowerCase().includes(q);
    nodo.style.display = visible ? "" : "none";
  });
}

// --- Selección de tests para flujo ---
// El Panel solo guarda la selección (en orden) y la presenta; planificar y
// ejecutar lo hace el framework (ver flujo.js).
const tabFlujo = document.getElementById("tg-flujo");
flujo.suscribir((tipo) => {
  arbol.marcar(treeCont);
  const n = flujo.cantidad();
  tabFlujo.classList.toggle("oculto", n === 0);
  tabFlujo.querySelector(".seg-num").textContent = String(n);
  if (tipo === "seleccion") flujo.mostrar(detCont, onRun);
});
tabFlujo.addEventListener("click", () => {
  flujo.mostrar(detCont, onRun);
  document.querySelector(".app-sidebar").classList.remove("abierto");
});

// --- Wiring ---
document.getElementById("tg-tests").addEventListener("click", () => setModo(false));
document.getElementById("tg-hist").addEventListener("click", () => setModo(true));
document.getElementById("tg-ia").addEventListener("click", abrirIa);
document.getElementById("tg-config").addEventListener("click", () => configuracion.abrir(detCont));
document.getElementById("search").addEventListener("input", aplicarFiltro);
document.getElementById("menu-toggle").addEventListener("click", () =>
  document.querySelector(".app-sidebar").classList.toggle("abierto")
);
document.getElementById("ind-corrida").addEventListener("click", () => {
  const c = document.getElementById("consola");
  c.classList.remove("contraida"); // reabre la consola si estaba contraída
  c.scrollIntoView();
});

detCont.append(pantallaInicio());
cargarArbol();
