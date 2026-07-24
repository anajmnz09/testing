import { el, boton, chevron } from "./componentes.js";
import * as api from "./api.js";

// Consola en vivo (panel inferior). Ejecutar NO saca al usuario de su lugar: el
// árbol y el detalle siguen visibles. Se EXPANDE al ejecutar y se CONTRAE sola
// al terminar; el usuario la vuelve a abrir con el chevron de la barra.
function panel() {
  return document.getElementById("consola");
}
function indicador() {
  return document.getElementById("ind-corrida");
}

export function ejecutar(run, nombre, onFin) {
  const p = panel();
  p.classList.remove("oculto", "contraida");
  p.innerHTML = "";

  const estado = el("span", { class: "con-estado" }, "Iniciando…");
  const cuerpo = el("div", { class: "con-cuerpo" });
  // Chevron único: mismo componente que el árbol y los colapsables.
  const toggle = el(
    "button",
    { class: "con-chev btn--icono", title: "Mostrar / ocultar", onclick: () => p.classList.toggle("contraida") },
    chevron()
  );
  const cab = el(
    "div",
    { class: "con-cab", onclick: (e) => e.target === cab && p.classList.toggle("contraida") },
    toggle,
    el("span", { class: "con-tit" }, `CONSOLA · ${nombre}`),
    estado,
    boton("Detener", { variante: "detener", onClick: () => api.cancelar() })
  );
  p.append(cab, cuerpo);

  api.ejecutar(run).then((r) => {
    if (!r.ok) {
      estado.textContent =
        r.motivo === "ya-hay-una-corrida" ? "Ya hay una corrida en curso" : `No se pudo iniciar (${r.motivo || "error"})`;
      p.classList.add("contraida");
      return;
    }
    estado.textContent = "Ejecutando";
    indicador().classList.add("activo");
    api.vivo(
      (linea) => {
        cuerpo.append(el("div", { class: "con-linea" }, linea));
        cuerpo.scrollTop = cuerpo.scrollHeight;
      },
      (codigo) => {
        estado.textContent = codigo === 0 ? "Terminado ✓" : "Terminado ✗";
        indicador().classList.remove("activo");
        // Al terminar, la consola se contrae automáticamente.
        p.classList.add("contraida");
        if (onFin) onFin(codigo);
      }
    );
  });
}
