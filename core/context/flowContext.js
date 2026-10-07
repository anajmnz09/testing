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
 * (solicitud → solicitud) es un publish más, no un ciclo.
 */
const fs = require('fs');

let _plan;
const _entidades = new Map();
let _driver = null;
let _sesion = null; // driver que ya inició sesión en este flujo
let _casoActual = null; // caso en ejecución (lo fija flowHooks): productor por defecto de publish

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
  _entidades.set(tipo, { datos, version: previa ? previa.version + 1 : 1, productor: productor || _casoActual });
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
  const e = _entidades.get(tipo);
  return e ? e.datos : undefined;
}

function entidad(tipo) {
  return _entidades.get(tipo);
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
}

function clear() {
  _entidades.clear();
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
  driverCompartido, setDriverCompartido, marcarSesion, sesionIniciada,
};
