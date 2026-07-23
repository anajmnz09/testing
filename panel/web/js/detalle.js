import { el, chipEstado, boton, colapsable, vacio, confirmar } from "./componentes.js";
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

  // Identidad + veredicto
  cont.append(
    el(
      "div",
      { class: "caso-head" },
      el("div", { class: "caso-titulo" }, el("h1", {}, nodo.nombre), chipEstado(ult ? ult.estado : "sin-ejecutar")),
      el("div", { class: "caso-meta" }, `módulo: ${nodo.modulo} · ${nodo.ruta}`)
    )
  );

  // Acciones: Ejecutar (ÚNICO primario) + secundarias neutras
  const seg = nodo.id.split("-")[0];
  cont.append(
    el(
      "div",
      { class: "caso-acciones" },
      boton("Ejecutar", { variante: "primario", icono: "▷", onClick: () => onRun(nodo.run, nodo.nombre) }),
      boton("Ejecutar carpeta", {
        onClick: () => onRun({ tipo: "carpeta", modulo: nodo.modulo, target: `tests/${seg}-*.test.js` }, seg),
      }),
      boton("Ejecutar módulo", {
        onClick: () =>
          confirmar(`Vas a correr TODO el módulo "${nodo.modulo}" (puede tardar). ¿Continuar?`, () =>
            onRun({ tipo: "modulo", modulo: nodo.modulo }, nodo.modulo)
          ),
      })
    )
  );

  // Parámetros (abierto por defecto)
  cont.append(
    colapsable("Parámetros (Execution Context)", (data.contexto.claves || []).length, (c) => ctx.render(c, nodo, data.contexto), true)
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
