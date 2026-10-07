/**
 * flowContext — entidades producidas DURANTE la ejecución de un flujo (varios
 * tests en un mismo proceso/navegador). Capa ADICIONAL y separada de
 * `testContext`: aquel guarda lo dirigido por el usuario (Panel / archivo
 * `execution-context.json`); este guarda resultados efímeros, solo en memoria,
 * y NUNCA se escribe a disco ni aparece en el Panel.
 *
 * Solo está ACTIVO cuando el runner de flujos exporta `TRIPLE_FLOW_PLAN` (ruta
 * al plan generado por `utils/flowPlanner.js`). Sin esa variable, todo aquí es
 * inerte (`activo()` === false, `valorEnlazado()` === undefined) y los tests
 * individuales se comportan exactamente como siempre.
 *
 * Plan (JSON): `{ orden: [{caso, modulo, archivo}], bindings: [{caso, clave,
 * tipo, campo}], produce: {caso: [tipo]} }`.
 *
 * Representación de una entidad: `{ datos, version, productor }`. `publish` de
 * un tipo ya existente REEMPLAZA y sube la versión — así una transformación
 * (solicitud → solicitud) es un publish más, no un ciclo. Dos publicaciones del MISMO tipo por el
 * MISMO caso en el MISMO paso (p. ej. la capa común de un formulario y luego el propio test) se
 * FUSIONAN en una sola, sin subir la versión (nunca se produce dos veces lo mismo por un paso).
 *
 * Capa común de publicación (ver `utils/flowInstrumentar.js`): un método declarado como creador /
 * editor en `ENTIDAD_FLUJO` arma una operación pendiente (`armar`) y el guardado confirmado de un
 * formulario compartido la resuelve (`confirmar`): crear → `publish`, editar → `update`. Eliminar
 * INVALIDA la entidad (`invalidar`): deja de estar disponible para pasos posteriores.
 */
const fs = require('fs');

let _plan;
const _entidades = new Map();
let _driver = null;
let _sesion = null; // driver que ya inició sesión en este flujo
let _casoActual = null; // caso en ejecución (lo fija flowHooks): productor por defecto de publish
const _publicadasEnPaso = new Set(); // tipos publicados por el caso actual en el paso actual
const _eliminadas = new Map(); // tipo -> caso que la eliminó
let _pendiente = null; // { modo: 'crear' | 'editar', tipo } armado por un creador/editor declarado

function _cargarPlan() {
  if (_plan !== undefined) return _plan;
  const ruta = process.env.TRIPLE_FLOW_PLAN;
  if (!ruta) {
    _plan = null;
  } else {
    try {
      _plan = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    } catch (e) {
      throw new Error(`flowContext: no se pudo leer el plan TRIPLE_FLOW_PLAN="${ruta}": ${e.message}`);
    }
  }
  return _plan;
}

function activo() {
  return !!_cargarPlan();
}

function plan() {
  return _cargarPlan();
}

/** Publica (o reemplaza) una entidad del flujo. No-op fuera de un flujo. */
function publish(tipo, datos, productor) {
  if (!activo()) return;
  const previa = _entidades.get(tipo);
  const quien = productor || _casoActual;
  _eliminadas.delete(tipo); // publicar de nuevo "revive" el tipo (p. ej. se creó otra)
  if (previa && previa.productor === quien && _publicadasEnPaso.has(tipo)) {
    previa.datos = { ...previa.datos, ...datos }; // mismo paso: se fusiona, sin versión nueva
    return;
  }
  _publicadasEnPaso.add(tipo);
  _entidades.set(tipo, { datos, version: previa ? previa.version + 1 : 1, productor: quien });
}

/**
 * Actualiza una entidad existente (merge superficial) y sube su versión: para
 * tests que TRANSFORMAN una entidad ya publicada (solicitud → solicitud) sin
 * crearla. Si no existía (flujo que arranca a mitad), se crea con `cambios`.
 * No-op fuera de un flujo.
 */
function update(tipo, cambios, productor) {
  if (!activo()) return;
  publish(tipo, { ...(get(tipo) || {}), ...cambios }, productor);
}

function get(tipo) {
  const e = entidad(tipo);
  return e ? e.datos : undefined;
}

/** La entidad vigente, o undefined si nunca se publicó o fue eliminada por un paso posterior. */
function entidad(tipo) {
  return _eliminadas.has(tipo) ? undefined : _entidades.get(tipo);
}

/**
 * Al terminar un test que PASÓ: si guardó (el formulario capturó la referencia con `capturar`) pero el test nunca pidió el
 * resultado del guardado (`resultadoGuardado`), la operación pendiente se resuelve con lo capturado. Devuelve true si publicó.
 */
function resolverPendienteGuardado() {
  if (!activo() || !_pendiente || !_pendiente.guardado) return false;
  return confirmar(undefined);
}

/** Marca la entidad como eliminada: deja de estar disponible (get/entidad/valorEnlazado → undefined). */
function invalidar(tipo, quien) {
  if (!activo()) return;
  _eliminadas.set(tipo, quien || _casoActual);
}

/**
 * Deshace las eliminaciones de un caso (el caso FALLÓ: la app no confirmó que eliminara nada, así que la entidad sigue
 * existiendo para los pasos posteriores). Lo llama `flowHooks` al terminar un test que no pasó.
 */
function restaurarEliminacionesDe(caso) {
  for (const [tipo, quien] of [..._eliminadas]) if (quien === caso) _eliminadas.delete(tipo);
}

/** Caso que eliminó el tipo, o undefined. */
function eliminadaPor(tipo) {
  return _eliminadas.get(tipo);
}

/** Arma la operación pendiente de un creador/editor declarado (la resuelve `confirmar`). */
function armar(modo, tipo, datos) {
  if (!activo()) return;
  _pendiente = { modo, tipo, datos: datos || {} };
}

function pendiente() {
  return _pendiente;
}

/**
 * Resuelve la operación pendiente con los datos de referencia ya leídos: crear → publish, editar →
 * update. Sin operación pendiente (p. ej. el test publica por su cuenta) no hace nada.
 */
function confirmar(datos) {
  if (!activo() || !_pendiente) return false;
  const { modo, tipo } = _pendiente;
  const todos = { ...(_pendiente.datos || {}), ...(datos || {}) }; // referencia tomada del argumento del creador + lo leído del formulario
  if (!Object.keys(todos).length) return false;
  _pendiente = null;
  if (modo === 'editar') update(tipo, todos);
  else publish(tipo, todos);
  return true;
}

/**
 * Valor que el flujo aporta a `(caso, clave)` según los bindings DECLARADOS
 * (metadata `requires`), o `undefined`. Es lo que `testContext.get` consulta
 * después del Panel. Nunca infiere nada: sin binding explícito, no hay valor.
 */
function valorEnlazado(caso, clave) {
  if (!activo()) return undefined;
  const b = (_cargarPlan().bindings || []).find((x) => x.caso === caso && x.clave === clave);
  if (!b) return undefined;
  const datos = get(b.tipo);
  if (datos === undefined || datos === null) return undefined;
  const v = datos[b.campo];
  return v === undefined || v === null || v === '' ? undefined : v;
}

function setCasoActual(c) {
  _casoActual = c;
  _publicadasEnPaso.clear(); // nuevo paso: las publicaciones de un caso anterior no se fusionan con las de este
  _pendiente = null;
}

function clear() {
  _entidades.clear();
  _eliminadas.clear();
  _publicadasEnPaso.clear();
  _pendiente = null;
  _casoActual = null;
  _driver = null;
  _sesion = null;
}

// --- driver / sesión compartidos (solo modo flujo) ---------------------------
function driverCompartido() {
  return _driver;
}
function setDriverCompartido(d) {
  _driver = d;
}
function marcarSesion(d) {
  _sesion = d;
}
function sesionIniciada(d) {
  return !!d && _sesion === d;
}

module.exports = {
  activo, plan, setCasoActual, publish, update, get, entidad, clear, valorEnlazado,
  invalidar, restaurarEliminacionesDe, eliminadaPor, armar, pendiente, confirmar, resolverPendienteGuardado,
  driverCompartido, setDriverCompartido, marcarSesion, sesionIniciada,
};
