import { el, boton, colapsable, capitalizar, chipEstado, pantallaInicio } from "./componentes.js";
import * as api from "./api.js";
import * as consola from "./consola.js";
import * as reporte from "./reporte.js";

// Ejecución de FLUJO: el usuario marca tests (checkbox del árbol), el Panel
// recuerda el ORDEN DE SELECCIÓN y lo entrega tal cual al runner. El Panel NO
// resuelve dependencias ni maneja entidades: el orden real lo calcula el planner
// del framework (`requires`/`produces`, vía /api/flujo/plan) y el estado de cada
// test lo escribe el runner (`flow-estado.json`, vía /api/flujo/estado). Aquí solo
// se guarda la selección, se presenta y se muestra lo que el framework produce.

// ---------------------------------------------------------------------------
// Selección (orden = orden en que el usuario marcó cada test)
// ---------------------------------------------------------------------------
let seleccion = []; // [{ modulo, caso, descripcion }]
let fase = "seleccion"; // 'seleccion' | 'ejecutando' | 'terminado'
const oyentes = new Set();

/** `fn(tipo)`: 'seleccion' (cambió la lista) o 'fase' (empezó/terminó una corrida) — refresca árbol/tab/pantalla. */
export const suscribir = (fn) => oyentes.add(fn);
const avisar = (tipo) => oyentes.forEach((f) => f(tipo));

export const tiene = (modulo, caso) => seleccion.some((s) => s.modulo === modulo && s.caso === caso);
export const cantidad = () => seleccion.length;
export const ocupado = () => fase === "ejecutando";

function cambioDeSeleccion() {
  // Cualquier cambio de la lista descarta los resultados de una corrida anterior.
  if (fase === "terminado") {
    fase = "seleccion";
    estado = null;
    corrida = null;
  }
  plan = null; // el plan anterior ya no corresponde a esta selección
  planPendiente = true;
  avisar("seleccion");
}

/** Agrega el test (una sola vez, conserva su posición) o lo quita. Devuelve false si no se puede. */
export function alternar(nodo) {
  if (ocupado()) return false;
  const i = seleccion.findIndex((s) => s.modulo === nodo.modulo && s.caso === nodo.id);
  if (i >= 0) seleccion.splice(i, 1);
  else seleccion.push({ modulo: nodo.modulo, caso: nodo.id, descripcion: nodo.descripcion || null });
  cambioDeSeleccion();
  return true;
}

export function quitar(modulo, caso) {
  if (ocupado()) return;
  seleccion = seleccion.filter((s) => !(s.modulo === modulo && s.caso === caso));
  cambioDeSeleccion();
}

/** Cancelar selección: vacía la lista y sale del modo flujo. */
export function limpiar() {
  if (ocupado()) return;
  seleccion = [];
  fase = "seleccion";
  estado = null;
  corrida = null;
  residual = null;
  plan = null;
  cambioDeSeleccion();
}

// ---------------------------------------------------------------------------
// Plan (lo calcula el framework) y estado de la corrida (lo escribe el runner)
// ---------------------------------------------------------------------------
let residual = null; // [{ modulo, caso, claves:[nombre] }] con valores dirigidos en el Execution Context
let plan = null; // { ok, orden:[{modulo,caso}], avisos, errores, produce, requiere } | { ok:false, motivo }
let planPendiente = false;
let planSeq = 0;
let estado = null; // respuesta de /api/flujo/estado
let corrida = null; // { modulo, runId } — de la línea "Reportes del flujo:" de la consola
let sondeo = null;
const abiertos = new Set(); // casos desplegados (se conservan entre refrescos)

let raiz = null; // contenedor de la pantalla actual
let onRunExterno = null;

const visible = () => raiz && raiz.isConnected;

async function calcularPlan() {
  const mio = ++planSeq;
  planPendiente = false;
  if (!seleccion.length) {
    plan = null;
    return;
  }
  const r = await api.planFlujo(seleccion.map(({ modulo, caso }) => ({ modulo, caso })));
  if (mio !== planSeq) return; // llegó una selección más nueva
  plan = r;
  if (visible() && fase === "seleccion") render();
}

/**
 * Data residual: valores NO vacíos que el Execution Context INDIVIDUAL de cada test seleccionado
 * ya tiene guardados. Se detectan y se AVISAN; nunca se borran ni se bloquea la ejecución.
 * Un flujo NO usa esos valores (el flujo tiene sus propios datos, lo que produce y el modo
 * automático); siguen intactos para la ejecución individual.
 * (Mismo criterio de "vacío" que `testContext`: '' / false / [] no dirigen nada.)
 */
const dirigido = (v) => {
  if (v == null || v === false) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

let residualSeq = 0;
async function calcularResidual() {
  const mio = ++residualSeq;
  const lista = seleccion.map((s) => ({ modulo: s.modulo, caso: s.caso }));
  const secciones = await Promise.all(lista.map((s) => api.contexto(s.modulo, s.caso).catch(() => null)));
  if (mio !== residualSeq) return; // llego una consulta mas nueva
  residual = lista
    .map((s, i) => ({
      ...s,
      claves: ((secciones[i] && secciones[i].claves) || []).filter((k) => dirigido(k.valor)).map((k) => k.nombre),
    }))
    .filter((r) => r.claves.length);
  if (visible() && fase === "seleccion") render();
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------
export function mostrar(cont, onRun) {
  raiz = cont;
  onRunExterno = onRun || onRunExterno;
  render();
  if (planPendiente) calcularPlan();
  // Los valores guardados pueden haber cambiado desde la última vez que se vio esta pantalla.
  if (fase === "seleccion" && seleccion.length) calcularResidual();
}

const entradaDe = (modulo, caso) => seleccion.find((s) => s.modulo === modulo && s.caso === caso);

function ordenMostrado() {
  // En ejecución / terminado se muestra el orden con que corrió; antes, el del plan
  // (si el planner lo resolvió) o, si no, el de selección.
  if (fase !== "seleccion" && estado && estado.existe) {
    return estado.orden.map((caso) => ({ modulo: estado.casos[caso].modulo, caso }));
  }
  if (plan && plan.ok && !plan.errores.length) return plan.orden;
  return seleccion.map(({ modulo, caso }) => ({ modulo, caso }));
}

function seAjustoElOrden(orden) {
  if (!plan || !plan.ok || plan.errores.length) return false;
  return orden.some((o, i) => seleccion[i] && (o.caso !== seleccion[i].caso || o.modulo !== seleccion[i].modulo));
}

function render() {
  raiz.innerHTML = "";
  if (!seleccion.length) {
    raiz.append(pantallaInicio());
    return;
  }

  const orden = ordenMostrado();
  const planFallo = plan && (!plan.ok || plan.errores.length);
  const ejecutando = fase === "ejecutando";

  const ejecutar = boton(ejecutando ? "Ejecutando…" : "Ejecutar Flujo", {
    variante: "burgundy",
    icono: "▷",
    onClick: iniciar,
  });
  ejecutar.disabled = ejecutando || !plan || planFallo;
  const acciones = el("div", { class: "flujo-acciones" }, ejecutar);
  if (!ejecutando) acciones.append(boton("Cancelar selección", { onClick: limpiar }));

  const cab = el(
    "div",
    { class: "flujo-cab" },
    el("img", { src: "/assets/logo.png", alt: "Triple", class: "inicio-logo" }),
    el("div", { class: "flujo-titulo" }, "Selección de tests para Flujo de prueba"),
    acciones
  );
  if (planFallo) {
    const errores = plan.ok ? plan.errores : [`No se pudo planificar el flujo (${plan.motivo || "error"}).`];
    cab.append(el("div", { class: "err-headline flujo-aviso" }, ...errores.map((e) => el("div", {}, e))));
  } else if (fase === "seleccion" && seAjustoElOrden(orden)) {
    cab.append(el("div", { class: "flujo-nota" }, "Orden de ejecución ajustado por dependencias"));
  }
  // (solo los tests que siguen seleccionados: la consulta puede estar a medio refrescar)
  const conResidual = (residual || []).filter((r) => entradaDe(r.modulo, r.caso));
  if (fase === "seleccion" && conResidual.length) cab.append(avisoResidual(conResidual));
  if (fase === "terminado" && estado && !estado.existe) {
    cab.append(el("div", { class: "err-headline flujo-aviso" }, "El flujo no llegó a ejecutarse. Revise la consola."));
  }

  const lista = el("div", { class: "flujo-lista" });
  lista.append(el("div", { class: "flujo-lista-tit" }, fase === "seleccion" ? "Tests seleccionados" : resumenTitulo(orden)));
  orden.forEach((o, i) => lista.append(item(o, i)));
  if (fase === "seleccion" && plan && plan.ok && plan.avisos.length) {
    lista.append(
      colapsable("Detalles del plan", plan.avisos.length, (c) => plan.avisos.forEach((a) => c.append(el("p", { class: "vacio-min" }, a))))
    );
  }

  raiz.append(el("div", { class: "flujo" }, cab, lista));
}

// ⚠ Advertencia (no bloquea): estilo "warn" ya existente, mismo bloque que el motivo de un bloqueo.
function avisoResidual(residual) {
  const aviso = el("div", { class: "flujo-motivo flujo-aviso" });
  aviso.append(
    el("strong", {}, "⚠ Data residual detectada"),
    el(
      "p",
      { class: "flujo-det" },
      "Algunos de los tests seleccionados tienen datos dirigidos guardados de ejecuciones individuales (Execution Context). Los datos dirigidos de ejecuciones individuales no se aplicarán al flujo: el flujo usa solo sus propios datos, lo que producen los tests del flujo y el modo automático. Esos valores no se borran y siguen disponibles para la ejecución individual."
    )
  );
  for (const r of residual) {
    const nombres = r.claves.length > 4 ? `${r.claves.slice(0, 4).join(", ")} y ${r.claves.length - 4} más` : r.claves.join(", ");
    aviso.append(el("div", {}, `${capitalizar(r.modulo)} / ${r.caso} — ${r.claves.length} valor(es): ${nombres}`));
  }
  return aviso;
}

function resumenTitulo(orden) {
  if (!estado || !estado.existe) return "Tests del flujo";
  const c = Object.values(estado.casos);
  const n = (e) => c.filter((x) => x.estado === e).length;
  const partes = [`${n("passed")} de ${orden.length} aprobados`];
  if (n("failed") + n("contrato-incumplido")) partes.push(`${n("failed") + n("contrato-incumplido")} con fallo`);
  if (n("bloqueado")) partes.push(`${n("bloqueado")} bloqueados`);
  return `Tests del flujo · ${partes.join(" · ")}`;
}

// Estado visual de un test (reutiliza chips/glifos del Panel).
function vistaEstado(info) {
  if (!info) return null;
  let e = info.estado;
  if (e === "contrato-incumplido") e = "failed";
  if (fase === "terminado" && (e === "running" || e === "pendiente")) e = "cancelled";
  if (e === "pendiente") e = "pending";
  return e;
}
const GLIFO = { passed: "✓", failed: "✕", bloqueado: "⊘", running: "◍", pending: "○", cancelled: "○" };

function item(o, i) {
  const entrada = entradaDe(o.modulo, o.caso) || { modulo: o.modulo, caso: o.caso, descripcion: null };
  const info = fase !== "seleccion" && estado && estado.existe ? estado.casos[o.caso] : null;
  const ev = vistaEstado(info);

  const cab = el(
    "span",
    { class: "flujo-it-cab" },
    ev ? el("span", { class: `glifo flujo-glifo g-${ev}` }, GLIFO[ev] || "○") : null,
    el("span", { class: "flujo-num" }, String(i + 1)),
    el("span", { class: "flujo-nombre" }, el("span", { class: "flujo-mod" }, `${capitalizar(o.modulo)} / `), o.caso),
    ev ? chipEstado(ev) : null
  );

  const cuerpo = (c) => {
    if (entrada.descripcion) c.append(el("p", { class: "flujo-det" }, entrada.descripcion));
    if (info) {
      c.append(
        el(
          "p",
          { class: "flujo-det" },
          el("span", { class: "flujo-det-lbl" }, "Estado: "),
          chipEstado(ev),
          info.duracionMs != null ? el("span", { class: "flujo-det-lbl" }, `   Duración: ${(info.duracionMs / 1000).toFixed(1)} s`) : null
        )
      );
      if (info.motivo) c.append(el("div", { class: "flujo-motivo" }, el("strong", {}, "Motivo: "), info.motivo));
      if (ev === "cancelled") {
        const cuando = info.estado === "running" ? "mientras se ejecutaba este test" : "antes de llegar a este test";
        c.append(el("div", { class: "flujo-motivo" }, el("strong", {}, "Cancelado: "), `el flujo se detuvo ${cuando}.`));
      }
      if (info.error) c.append(el("div", { class: "err-headline" }, el("strong", {}, "Falló: "), info.error));
    }
    dependencias(c, o.caso);
    if (info && info.screenshots && info.screenshots.length) {
      c.append(el("div", { class: "flujo-det-sub" }, `Screenshots (${info.screenshots.length})`));
      reporte.screenshots(c, info.screenshots);
    }
    if (info && info.evidencias && info.evidencias.length) {
      c.append(el("div", { class: "flujo-det-sub" }, `Evidencias (${info.evidencias.length})`));
      reporte.evidencias(c, info.evidencias);
    }
    if (!info) {
      c.append(
        el(
          "p",
          { class: "vacio-min" },
          "En un flujo este test no usa los datos guardados de su ejecución individual: usa lo producido por otros tests del flujo o el modo automático."
        )
      );
    }
  };

  const fila = colapsable(cab, null, cuerpo, abiertos.has(o.caso));
  fila.querySelector(".colap-cab").addEventListener("click", () => {
    if (fila.classList.contains("abierto")) abiertos.add(o.caso);
    else abiertos.delete(o.caso);
  });
  const wrap = el("div", { class: "flujo-it" }, fila);
  if (fase === "seleccion") {
    wrap.append(
      el("button", { class: "btn btn--ghost flujo-quitar", title: "Quitar del flujo", onclick: () => quitar(o.modulo, o.caso) }, "✕")
    );
  }
  return wrap;
}

// "Requiere / Produce" tal como los declara la metadata del framework (solo lectura).
function dependencias(c, caso) {
  if (!plan || !plan.ok) return;
  if (plan.conMetadata && plan.conMetadata[caso] === false) {
    c.append(el("p", { class: "flujo-det" }, el("span", { class: "flujo-det-lbl" }, "Sin metadata de flujo: "), "corre como paso independiente."));
  }
  const req = ((plan.requiere || {})[caso] || []).map((r) => r.tipo);
  const prod = (plan.produce || {})[caso] || [];
  if (req.length) c.append(el("p", { class: "flujo-det" }, el("span", { class: "flujo-det-lbl" }, "Requiere: "), [...new Set(req)].join(", ")));
  if (prod.length) c.append(el("p", { class: "flujo-det" }, el("span", { class: "flujo-det-lbl" }, "Produce: "), prod.join(", ")));
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------
async function iniciar() {
  if (!seleccion.length || ocupado()) return;
  fase = "ejecutando";
  estado = null;
  corrida = null;
  abiertos.clear();
  render();
  avisar("fase");
  // El Panel entrega la selección en el ORDEN DEL USUARIO; el planner del
  // framework decide el orden real.
  const run = { tipo: "flujo", casos: seleccion.map(({ modulo, caso }) => ({ modulo, caso })) };
  const ok = await consola.ejecutar(run, "Flujo de prueba", alTerminar, alLinea);
  if (!ok) {
    fase = "seleccion";
    avisar("fase");
    if (visible()) render();
  }
}

function alLinea(linea) {
  // run-flow.js imprime "Reportes del flujo: <modulo>/<RUN_ID>" apenas planifica.
  const m = /^Reportes del flujo:\s*(\S+?)\/(\S+)\s*$/.exec(linea);
  if (m && !corrida) {
    corrida = { modulo: m[1], runId: m[2] };
    iniciarSondeo();
  }
}

function iniciarSondeo() {
  detenerSondeo();
  const tick = async () => {
    if (!corrida) return;
    const r = await api.estadoFlujo(corrida.modulo, corrida.runId);
    if (r.existe && JSON.stringify(r) !== JSON.stringify(estado)) {
      estado = r;
      if (visible()) render();
    }
  };
  tick();
  sondeo = setInterval(tick, 1500);
}

function detenerSondeo() {
  if (sondeo) clearInterval(sondeo);
  sondeo = null;
}

async function alTerminar() {
  detenerSondeo();
  if (corrida) {
    const r = await api.estadoFlujo(corrida.modulo, corrida.runId);
    if (r.existe) estado = r;
  }
  fase = "terminado";
  avisar("fase");
  if (visible()) render();
}
