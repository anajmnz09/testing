import { el, boton } from "./componentes.js";
import * as api from "./api.js";

// Consola en vivo (panel inferior). Ejecutar NO saca al usuario de su lugar:
// el árbol y el detalle siguen visibles. La ejecución sucede acá.
function panel() {
  return document.getElementById("consola");
}
function indicador() {
  return document.getElementById("ind-corrida");
}

export function ejecutar(run, nombre, onFin) {
  const p = panel();
  p.classList.remove("oculto");
  p.innerHTML = "";

  const estado = el("span", { class: "con-estado" }, "Iniciando…");
  const cuerpo = el("div", { class: "con-cuerpo" });
  const cab = el(
    "div",
    { class: "con-cab" },
    el("span", { class: "con-tit" }, `CONSOLA · ${nombre}`),
    estado,
    boton("Detener", { onClick: () => api.cancelar() })
  );
  p.append(cab, cuerpo);

  api.ejecutar(run).then((r) => {
    if (!r.ok) {
      estado.textContent = r.motivo === "ya-hay-una-corrida" ? "Ya hay una corrida en curso" : `No se pudo iniciar (${r.motivo || "error"})`;
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
        if (onFin) onFin(codigo);
      }
    );
  });
}
