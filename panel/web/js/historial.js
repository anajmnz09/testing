import { el, chipEstado } from "./componentes.js";
import * as api from "./api.js";
import * as reporte from "./reporte.js";

// Historial = las corridas que el framework ya conserva (reports/<RUN_ID>/).
// Sin base de datos, sin métricas: una lista.
export async function render(cont, modulo, onCorrida) {
  cont.innerHTML = "";
  const d = await api.historial(modulo);
  if (!d.corridas.length) {
    cont.append(el("p", { class: "vacio-min", style: "padding:12px" }, "Todavía no hay ejecuciones registradas."));
    return;
  }
  for (const r of d.corridas) {
    cont.append(
      el(
        "div",
        { class: "hist-row", onclick: () => onCorrida(modulo, r.runId) },
        el("span", { class: "hist-fecha" }, r.fecha),
        el("span", { class: `glifo g-${r.estado}` }, r.estado === "passed" ? "✓" : r.estado === "failed" ? "✕" : "○"),
        el("span", { class: "hist-nums" }, `${r.pasaron}/${r.total}`)
      )
    );
  }
}

/** Detalle de una corrida en el panel principal (reutiliza los visores). */
export async function abrirCorrida(cont, modulo, runId) {
  cont.innerHTML = "";
  cont.append(el("div", { class: "cargando" }, "Cargando…"));
  const d = await api.corrida(modulo, runId);
  cont.innerHTML = "";
  cont.append(
    el("div", { class: "caso-head" }, el("div", { class: "caso-titulo" }, el("h1", {}, `Corrida ${d.fecha}`), chipEstado(d.estado))),
    el("p", { class: "caso-meta", style: "margin-top:8px" }, `${d.pasaron}/${d.total} aprobados`)
  );
  const frame = el("div", {});
  reporte.reporteHtml(frame, d.reporte);
  cont.append(frame);
}
