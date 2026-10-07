import { el, chevron, capitalizar } from "./componentes.js";
import * as flujo from "./flujo.js";

// Árbol Módulo → (Suite) → Caso. El estado se muestra con un glifo mínimo; el
// play aparece al hover para ejecutar sin abrir el detalle.
const GLIFO = { passed: "✓", failed: "✕", "sin-ejecutar": "○", running: "◍", pending: "○" };

// Indicador de estado por test (círculo ○ / ✓ / ✕) junto al nombre en el árbol.
// DESACTIVADO temporalmente a pedido (solo visual; el estado se sigue calculando
// y usándose en el detalle). Para REACTIVARLO: poner en true.
const MOSTRAR_GLIFO_ESTADO = false;

export function render(cont, datos, onSelect, onRun) {
  cont.innerHTML = "";
  if (!datos.modulos.length) {
    cont.append(el("p", { class: "vacio-min", style: "padding:12px" }, "No se encontraron módulos con tests."));
    return;
  }
  for (const m of datos.modulos) cont.append(nodo(m, onSelect, onRun, 0));
  marcar(cont);
}

/**
 * Refleja la selección de flujo en el árbol: fondo más claro + checkbox marcado
 * en los tests elegidos (solo los CASOS tienen checkbox). Deshabilitado mientras
 * corre un flujo.
 */
export function marcar(cont) {
  const ocupado = flujo.ocupado();
  cont.querySelectorAll(".tree-row[data-caso]").forEach((fila) => {
    const on = flujo.tiene(fila.dataset.modulo, fila.dataset.caso);
    fila.classList.toggle("flujo-sel", on);
    const chk = fila.querySelector(".tree-chk");
    chk.classList.toggle("on", on);
    chk.classList.toggle("deshabilitado", ocupado);
    chk.setAttribute("aria-checked", String(on));
  });
}

function nodo(n, onSelect, onRun, nivel) {
  const esGrupo = n.tipo !== "caso";
  const hijosBox = el("div", { class: "tree-hijos" });
  // Indentación compacta: separación horizontal chica entre niveles para
  // aprovechar el ancho (sin ensanchar el menú).
  const esCaso = n.tipo === "caso";
  // En los casos el checkbox va en el extremo izquierdo de la fila (la sangría
  // del nivel pasa a un espaciador, para no mover el nombre).
  const fila = el("div", {
    class: `tree-row tree-${n.tipo}`,
    style: `padding-left:${esCaso ? 6 : 4 + nivel * 10}px`,
    ...(esCaso ? { "data-modulo": n.modulo, "data-caso": n.id } : {}),
  });
  const chk = esCaso
    ? el("span", {
        class: "tree-chk",
        role: "checkbox",
        tabindex: "0",
        "aria-checked": "false",
        title: "Agregar al flujo",
        onclick: (e) => {
          e.stopPropagation();
          flujo.alternar(n);
        },
        onkeydown: (e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            flujo.alternar(n);
          }
        },
      })
    : null;
  const sangria = esCaso ? el("span", { style: `width:${nivel * 10}px;flex:none` }) : null;

  // Chevron único (grupos) o espaciador (casos, que no despliegan).
  const izq = esGrupo ? chevron() : el("span", { class: "chev-spacer" });
  // Carpetas/categorías y módulos se muestran capitalizados (solo visual);
  // los casos conservan su nombre descriptivo real (kebab).
  const lbl = el("span", { class: "tree-lbl" }, esGrupo ? capitalizar(n.nombre) : n.nombre);
  const der = el("span", { class: "tree-der" });
  if (MOSTRAR_GLIFO_ESTADO && n.tipo === "caso" && n.estado) {
    der.append(el("span", { class: `glifo g-${n.estado}` }, GLIFO[n.estado] || "○"));
  }
  der.append(
    el(
      "button",
      {
        class: "tree-run btn--icono",
        title: "Ejecutar",
        onclick: (e) => {
          e.stopPropagation();
          onRun(n.run, n.nombre);
        },
      },
      "▷"
    )
  );
  for (const x of [chk, sangria, izq, lbl, der]) if (x) fila.append(x);

  // Cada sección/categoría arranca COLAPSADA (a pedido explícito: quedaban
  // siempre abiertas y era incómodo navegar el árbol) — el usuario expande
  // solo lo que necesita, clickeando la fila (mismo toggle de siempre).
  const wrap = el("div", { class: `tree-nodo tree-${n.tipo}${esGrupo ? " colapsado" : ""}` }, fila, hijosBox);
  fila.addEventListener("click", () => {
    if (esGrupo) wrap.classList.toggle("colapsado");
    if (n.tipo === "caso") {
      cont().querySelectorAll(".tree-row.sel").forEach((x) => x.classList.remove("sel"));
      fila.classList.add("sel");
      onSelect(n);
    }
  });
  if (esGrupo && n.hijos) for (const h of n.hijos) hijosBox.append(nodo(h, onSelect, onRun, nivel + 1));
  return wrap;
}

function cont() {
  return document.getElementById("tree");
}
