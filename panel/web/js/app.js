import * as api from "./api.js";
import * as arbol from "./arbol.js";
import * as detalle from "./detalle.js";
import * as consola from "./consola.js";
import * as historial from "./historial.js";
import { vacio } from "./componentes.js";

const treeCont = document.getElementById("tree");
const detCont = document.getElementById("detalle");

let nodoSel = null;
let moduloActivo = null;
let modoHistorial = false;

// Ejecutar sin perder el contexto: la consola emerge; al terminar, refresca el
// detalle del caso seleccionado para reflejar el nuevo resultado.
function onRun(run, nombre) {
  consola.ejecutar(run, nombre, () => {
    if (!modoHistorial && nodoSel) detalle.abrir(detCont, nodoSel, onRun);
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
    },
    onRun
  );
  aplicarFiltro();
}

async function setModo(hist) {
  modoHistorial = hist;
  document.getElementById("tg-tests").classList.toggle("activo", !hist);
  document.getElementById("tg-hist").classList.toggle("activo", hist);
  if (hist) {
    await historial.render(treeCont, moduloActivo, (m, r) => historial.abrirCorrida(detCont, m, r));
  } else {
    await cargarArbol();
  }
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

// --- Wiring ---
document.getElementById("tg-tests").addEventListener("click", () => setModo(false));
document.getElementById("tg-hist").addEventListener("click", () => setModo(true));
document.getElementById("refrescar").addEventListener("click", () => (modoHistorial ? setModo(true) : cargarArbol()));
document.getElementById("search").addEventListener("input", aplicarFiltro);
document.getElementById("ind-corrida").addEventListener("click", () => document.getElementById("consola").scrollIntoView());

detCont.append(vacio("Elegí un test del árbol para empezar."));
cargarArbol();
