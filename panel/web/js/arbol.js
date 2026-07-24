import { el, chevron, capitalizar } from "./componentes.js";

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
}

function nodo(n, onSelect, onRun, nivel) {
  const esGrupo = n.tipo !== "caso";
  const hijosBox = el("div", { class: "tree-hijos" });
  // Indentación compacta: separación horizontal chica entre niveles para
  // aprovechar el ancho (sin ensanchar el menú).
  const fila = el("div", {
    class: `tree-row tree-${n.tipo}`,
    style: `padding-left:${4 + nivel * 10}px`,
  });

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
  fila.append(izq, lbl, der);

  const wrap = el("div", { class: `tree-nodo tree-${n.tipo}` }, fila, hijosBox);
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
