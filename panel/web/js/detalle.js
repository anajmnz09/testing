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

  // Descripción del caso: qué hace puntualmente (declarado en
  // organizacion-tests.js del módulo) + un párrafo FIJO, igual en todos los
  // tests, que explica el comportamiento automático vs. dirigido por Panel.
  cont.append(
    el(
      "div",
      { class: "caso-descripcion" },
      nodo.descripcion ? el("p", {}, nodo.descripcion) : null,
      el(
        "p",
        { class: "caso-descripcion-generica" },
        'Si lo ejecuta sin completar nada, el test corre en modo automático: el framework elige por su cuenta datos válidos para completarlo. Si desea dirigir la prueba con valores específicos, despliegue la sección "Parámetros (Execution Context)". Para ver el resultado de la corrida, revise la sección "Screenshots".'
      )
    )
  );

  // Parámetros: se construyen ya (para poder persistirlos al ejecutar).
  const ctxHandle = ctx.crear(nodo, data.contexto);

  // Acciones. Ejecutar es el ÚNICO primario (magenta). Al ejecutar: primero
  // persiste automáticamente los valores del Execution Context, luego corre.
  const ejecutar = boton("Ejecutar", {
    variante: "primario",
    icono: "▷",
    onClick: async () => {
      const valores = ctxHandle.valores();
      if (Object.keys(valores).length) await api.guardarContexto(nodo.modulo, nodo.id, valores);
      onRun(nodo.run, nodo.nombre);
    },
  });
  // "Ejecutar carpeta" corre todos los casos de la MISMA categoría que este
  // (ej. "Agregar" dentro de "Requisiciones") — el `run`/nombre ya vienen
  // resueltos desde el árbol (organizacion-tests.js), no se recomputan acá.
  const ejecutarCarpeta = boton(`Ejecutar carpeta${nodo.grupoNombre ? ` (${capitalizar(nodo.grupoNombre)})` : ""}`, {
    onClick: () => onRun(nodo.grupoRun, capitalizar(nodo.grupoNombre || nodo.modulo)),
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
    // (Sección "Reporte HTML" removida: el Panel es el visor oficial y el HTML de
    //  Mochawesome ya no se genera. Screenshots/evidencias/logs siguen igual.)
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
