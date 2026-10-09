import { el, boton, colapsable } from "./componentes.js";
import * as api from "./api.js";
import * as consola from "./consola.js";
import * as reporte from "./reporte.js";

// Casos de Uso IA: el usuario sube un PDF con un caso de uso y el runner independiente (`ia/run-caso-ia.js`)
// deja que el modelo lo ejecute en la aplicación real. El Panel solo sube el PDF, lanza el runner (misma consola
// en vivo de siempre) y presenta lo que éste dejó en `ia/reports/<RUN_ID>/`. No conoce la API key ni al modelo.

const CHIPS = {
  PASS: ["Aprobado", "chip--exito"],
  FAIL: ["Falló", "chip--error"],
  BLOCKED: ["Bloqueado", "chip--warn"],
  RUNNING: ["Ejecutando", "chip--info"],
};
const chip = (estado) => {
  const [txt, cls] = CHIPS[estado] || ["—", "chip--neutro"];
  return el("span", { class: `chip ${cls}` }, txt);
};
// Estados de una verificación -> texto legible + clase de chip. Verde solo si la condición se cumplió y quedó verificada;
// cualquier otro estado (incumplida, no verificada, desconocido) es rojo: el color refleja el resultado funcional, no que se inspeccionó.
const ESTADOS_OK = new Set(["cumplida", "cumplido", "verificada", "verificado"]);
const legible = (v) => {
  const t = String(v == null ? "" : v).replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "—";
};
const chipVerificacion = (estado) => el("span", { class: `chip ${ESTADOS_OK.has(String(estado).toLowerCase()) ? "chip--exito" : "chip--error"}` }, legible(estado));

/** Valores que el modelo realmente escribió/seleccionó durante la corrida (los guarda `acciones.json`). */
// Fuente: lo que el runner registró de cada acción — lo escrito/seleccionado (`entrada.texto`) y los textos del elemento accionado
// con un clic (`objetivo`: celdas de la fila, opción de lista, ítem de menú…). Nada se deduce del PDF ni de lo que solo se vio.
const valoresUsados = (acciones) => {
  const crudos = [];
  for (const a of acciones || []) {
    if ((a.accion === "escribir" || a.accion === "seleccionar_opcion") && a.entrada) crudos.push(a.entrada.texto);
    if (a.accion === "hacer_click" && Array.isArray(a.objetivo)) crudos.push(...a.objetivo);
  }
  const limpios = crudos.filter((t) => typeof t === "string").map((t) => t.replace(/…$/, "").trim()).filter((t) => /[\p{L}\p{N}]/u.test(t));
  return [...new Map(limpios.map((t) => [t.toLowerCase(), t])).values()].sort((x, y) => y.length - x.length);
};

/** Texto con los valores usados en negrita + burgundy (nodos DOM; el resto del texto queda tal cual). */
const resaltar = (texto, valores) => {
  const base = String(texto == null ? "" : texto);
  if (!valores.length) return [base];
  const esc = valores.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // El valor debe aparecer completo y aislado (así "5" no se marca dentro de "2026" ni "58").
  const partes = base.split(new RegExp(`(?<![\\p{L}\\p{N}])(${esc.join("|")})(?![\\p{L}\\p{N}])`, "iu"));
  return partes.filter((p) => p !== "").map((p) => (valores.some((v) => v.toLowerCase() === p.toLowerCase()) ? el("strong", { class: "valor-usado" }, p) : p));
};

const GLIFO = { PASS: ["passed", "✓"], FAIL: ["failed", "✕"], BLOCKED: ["pending", "○"], RUNNING: ["pending", "○"] };

let ejecutando = false;

/** Lista de corridas de IA en el sidebar. */
export async function renderLista(cont, onCorrida) {
  cont.innerHTML = "";
  const d = await api.iaCorridas();
  if (!d.corridas.length) {
    cont.append(el("p", { class: "vacio-min", style: "padding:12px" }, "Todavía no hay ejecuciones de casos de uso IA."));
    return;
  }
  for (const r of d.corridas) {
    const [cls, simbolo] = GLIFO[r.estado] || GLIFO.RUNNING;
    cont.append(
      el(
        "div",
        { class: "hist-row", onclick: () => onCorrida(r.runId) },
        el("span", { class: "hist-fecha hist-caso", title: r.pdf ? `${r.pdf} - ${r.fecha}` : r.fecha }, r.pdf ? `${r.pdf} - ${r.fecha}` : r.fecha),
        el("span", { class: `glifo g-${cls}` }, simbolo),
        el("span", { class: "hist-nums" }, r.estado)
      )
    );
  }
}

const aBase64 = (archivo) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(",")[1] || "");
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });

const MB = 1024 * 1024;

/** Pantalla principal: subir PDF + ejecutar + resultado. `alTerminar` refresca la lista lateral. */
export async function abrir(cont, alTerminar) {
  cont.innerHTML = "";
  const estadoApi = await api.iaEstado().catch(() => ({ configurada: false }));

  cont.append(el("div", { class: "caso-head" }, el("div", { class: "caso-titulo" }, el("h1", {}, "Casos de Uso IA"))));
  cont.append(
    el(
      "div",
      { class: "caso-descripcion" },
      el(
        "p",
        {},
        "Sube un PDF con la especificación de un caso de uso (pantallas, pasos, reglas y resultado esperado). El modelo lee el documento, opera la aplicación real paso a paso, comprueba el resultado y deja capturas como evidencia. El resultado es Aprobado (PASS), Falló (FAIL) o Bloqueado (BLOCKED, cuando no se pudo verificar). No usa los tests ni los flujos existentes."
      )
    )
  );
  if (!estadoApi.configurada) {
    cont.append(
      el(
        "div",
        { class: "err-headline" },
        el("strong", {}, "Falta configurar OpenAI: "),
        "define OPENAI_API_KEY en el .env del servidor (nunca en el navegador) y reinicia el Panel."
      )
    );
  }

  const archivoInput = el("input", { type: "file", accept: "application/pdf,.pdf", style: "display:none" });
  // Mismo botón que "Ejecutar carpeta" de Tests (boton() con la variante por defecto); abre el selector nativo.
  const seleccionar = boton("Seleccionar Archivo", { onClick: () => archivoInput.click() });
  const nombreArchivo = el("span", { class: "caso-archivo" }, "Ningún archivo seleccionado.");
  const estado = el("span", { class: "form-estado" });
  const resultado = el("div", {});
  let archivo = null;

  const ejecutar = boton("Ejecutar caso", {
    variante: "primario",
    onClick: async () => {
      if (!archivo || ejecutando) return;
      if (archivo.size > 30 * MB) {
        estado.textContent = "El PDF supera 30 MB";
        return;
      }
      ejecutando = true;
      ejecutar.disabled = true;
      archivoInput.disabled = seleccionar.disabled = true;
      resultado.innerHTML = "";
      estado.textContent = "Subiendo PDF…";
      let runId = null;
      try {
        const subida = await api.iaPdf(archivo.name, await aBase64(archivo));
        if (!subida.ok) throw new Error(subida.motivo || "no se pudo subir el PDF");
        estado.textContent = "Ejecución en progreso…";
        resultado.append(el("div", { class: "caso-meta" }, chip("RUNNING"), " El modelo está ejecutando el caso; sigue el avance en la consola."));
        const arrancó = await consola.ejecutar(
          { tipo: "ia", archivo: subida.archivo },
          `Caso IA · ${archivo.name}`,
          async () => {
            ejecutando = false;
            ejecutar.disabled = false;
            archivoInput.disabled = seleccionar.disabled = false;
            estado.textContent = "";
            resultado.innerHTML = "";
            if (runId) await mostrarCorrida(resultado, runId, false);
            else resultado.append(el("p", { class: "vacio-min" }, "La ejecución terminó sin dejar resultado (revisa la consola)."));
            if (alTerminar) alTerminar();
          },
          (linea) => {
            const m = /^Reportes IA:\s*(\S+)/.exec(linea);
            if (m) runId = m[1];
          }
        );
        if (!arrancó) throw new Error("no se pudo iniciar la ejecución");
      } catch (e) {
        ejecutando = false;
        ejecutar.disabled = false;
        archivoInput.disabled = seleccionar.disabled = false;
        resultado.innerHTML = "";
        estado.textContent = `No se pudo ejecutar (${e.message})`;
      }
    },
  });
  ejecutar.disabled = true;

  archivoInput.addEventListener("change", () => {
    archivo = archivoInput.files[0] || null;
    nombreArchivo.textContent = archivo ? archivo.name : "Ningún archivo seleccionado.";
    nombreArchivo.title = archivo ? archivo.name : "";
    ejecutar.disabled = !archivo || ejecutando;
    estado.textContent = "";
  });

  cont.append(
    el("div", { class: "caso-selector" }, nombreArchivo, el("div", { class: "caso-botones" }, seleccionar, ejecutar, archivoInput, estado)),
    resultado
  );
}

/** Resultado de una corrida (en `cont`, o como pantalla completa si `pantalla`). */
export async function mostrarCorrida(cont, runId, pantalla = true) {
  if (pantalla) {
    cont.innerHTML = "";
    cont.append(el("div", { class: "cargando" }, "Cargando…"));
  }
  const d = await api.iaCorrida(runId);
  if (pantalla) cont.innerHTML = "";
  if (d.error) {
    cont.append(el("p", { class: "vacio-min" }, "No se encontró el resultado de esa corrida."));
    return;
  }

  const bloque = pantalla ? cont : el("div", {});
  if (pantalla) bloque.append(el("div", { class: "caso-head" }, el("div", { class: "caso-titulo" }, el("h1", {}, `Caso de uso IA · ${d.runId}`), chip(d.estado))));
  else bloque.append(el("div", { class: "caso-titulo" }, el("h2", {}, "Resultado"), chip(d.estado)));

  const meta = [
    d.pdf && d.pdf.nombre,
    d.duracionMs != null && `${Math.round(d.duracionMs / 1000)} s`,
    d.acciones != null && `${d.acciones} acciones`,
    d.modelo,
    d.uso && `${d.uso.entrada + d.uso.salida} tokens`,
  ].filter(Boolean);
  if (meta.length) bloque.append(el("p", { class: "caso-meta", style: "margin-top:8px" }, meta.join(" · ")));
  const usados = valoresUsados(d.accionesLista);
  if (d.resumen) bloque.append(el("p", {}, ...resaltar(d.resumen, usados)));
  if (d.estado !== "PASS" && d.motivo) {
    bloque.append(el("div", { class: "err-headline" }, el("strong", {}, d.estado === "FAIL" ? "Falló: " : "Bloqueado: "), d.motivo));
  }

  if ((d.verificaciones || []).length) {
    bloque.append(
      colapsable(
        "Verificaciones",
        d.verificaciones.length,
        (c) => {
          const tabla = el("div", { class: "ver-tabla" });
          for (const v of d.verificaciones) {
            tabla.append(
              el(
                "div",
                { class: "ver-fila" },
                el("div", { class: "ver-estado" }, chipVerificacion(v.estado)),
                el(
                  "div",
                  { class: "ver-texto" },
                  ...resaltar(`${v.condicion}${v.evidencia ? ` — ${v.evidencia}` : ""}`, usados),
                  v.metodo ? el("span", { class: "ver-metodo" }, ` · ${legible(v.metodo)}`) : null
                )
              )
            );
          }
          c.append(tabla);
        },
        true
      )
    );
  }
  bloque.append(colapsable("Capturas", (d.capturas || []).length, (c) => reporte.screenshots(c, d.capturas || []), true));
  if ((d.accionesLista || []).length) {
    bloque.append(
      colapsable("Acciones", d.accionesLista.length, (c) => {
        for (const a of d.accionesLista) {
          c.append(
            el(
              "div",
              { class: "evrow" },
              el("span", { class: "evtipo" }, a.n ? String(a.n) : a.accion),
              el("span", { class: "evnom" }, `${a.accion}${a.entrada ? ` ${JSON.stringify(a.entrada)}` : ""} → ${a.resultado || ""}`)
            )
          );
        }
      })
    );
  }
  if (d.logUrl) bloque.append(colapsable("Log", null, (c) => reporte.log(c, { url: d.logUrl })));
  if (d.pdfUrl) bloque.append(el("p", {}, el("a", { class: "btn btn--ghost", href: d.pdfUrl, target: "_blank" }, "Ver PDF del caso")));
  if (!pantalla) cont.append(bloque);
}
