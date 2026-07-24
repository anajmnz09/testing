import { el, chipEstado, boton, colapsable, vacio, capitalizar } from "./componentes.js";
import * as api from "./api.js";
import * as reporte from "./reporte.js";
import * as ctx from "./contexto.js";

// Panel del caso: verdad y acción primero; detalle bajo demanda (colapsables).
export async function abrir(cont, nodo, onRun) {
  cont.innerHTML = "";
  cont.append(el("div", { class: "cargando" }, "Cargando…"));
  const data = await api.caso(nodo.modulo, nodo.id);
  cont.innerHTML = "";

  const ult = data.ultima;

  // Identidad + veredicto. El módulo se muestra capitalizado y en burgundy
  // (solo presentación; el nombre interno no cambia; aplica a módulos futuros).
  cont.append(
    el(
      "div",
      { class: "caso-head" },
      el("div", { class: "caso-titulo" }, el("h1", {}, nodo.nombre), chipEstado(ult ? ult.estado : "sin-ejecutar")),
      el(
        "div",
        { class: "caso-meta" },
        "Módulo: ",
        el("span", { class: "mod-nombre" }, capitalizar(nodo.modulo)),
        " · ",
        nodo.ruta
      )
    )
  );

  // Parámetros: se construyen ya (para poder persistirlos al ejecutar).
  const ctxHandle = ctx.crear(nodo, data.contexto);

  // Acciones. Ejecutar es el ÚNICO primario (magenta). Al ejecutar: primero
  // persiste automáticamente los valores del Execution Context, luego corre.
  const seg = nodo.id.split("-")[0];
  const ejecutar = boton("Ejecutar", {
    variante: "primario",
    icono: "▷",
    onClick: async () => {
      const valores = ctxHandle.valores();
      if (Object.keys(valores).length) await api.guardarContexto(nodo.modulo, nodo.id, valores);
      onRun(nodo.run, nodo.nombre);
    },
  });
  const ejecutarCarpeta = boton("Ejecutar carpeta", {
    onClick: () => onRun({ tipo: "carpeta", modulo: nodo.modulo, target: `tests/${seg}-*.test.js` }, capitalizar(seg)),
  });
  // Ejecutar módulo: deshabilitado por ahora, reservado para una próxima fase.
  // (La lógica de ejecución del módulo sigue existiendo en el backend/comando.)
  const ejecutarModulo = el(
    "button",
    { class: "btn btn--secundario", disabled: "", title: "Disponible en una próxima fase" },
    "Ejecutar módulo"
  );
  cont.append(el("div", { class: "caso-acciones" }, ejecutar, ejecutarCarpeta, ejecutarModulo));

  // Parámetros (abierto por defecto)
  cont.append(
    colapsable("Parámetros (Execution Context)", (data.contexto.claves || []).length, (c) => c.append(ctxHandle.nodo), true)
  );

  if (ult) {
    cont.append(
      colapsable(`Última ejecución · ${ult.fecha} · ${(ult.duracion / 1000).toFixed(1)}s`, null, (c) => reporte.ultima(c, ult), ult.estado === "failed")
    );
    cont.append(colapsable("Screenshots", ult.screenshots.length, (c) => reporte.screenshots(c, ult.screenshots)));
    cont.append(colapsable("Evidencias", ult.evidencias.length, (c) => reporte.evidencias(c, ult.evidencias)));
    if (ult.log) cont.append(colapsable("Logs", null, (c) => reporte.log(c, ult.log)));
    cont.append(colapsable("Reporte HTML", null, (c) => reporte.reporteHtml(c, ult.reporte)));
  } else {
    cont.append(vacio("Sin ejecuciones todavía."));
  }

  cont.append(
    colapsable("Código del test", null, async (c) => {
      const r = await api.codigo(nodo.ruta);
      c.append(el("pre", { class: "codigo" }, (r && r.codigo) || "(no disponible)"));
    })
  );
}
