'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * Execution Context: se REUTILIZA el mismo `data/execution-context.json` del
 * framework, mismo formato. El panel solo lee la sección del caso y (al guardar)
 * hace un merge NO destructivo, igual criterio que `registrarCaso` — no pisa
 * otras secciones ni claves ajenas.
 *
 * Nota de alcance (según docs/panel-de-control-web-arquitectura.md §10): mientras
 * el Input Model formal no exista como código en el framework, el panel renderiza
 * las CLAVES YA PRESENTES en la sección del caso (las que sembró `registrarCaso`),
 * infiriendo el control. Nunca inventa campos.
 */
function archivo(modulo) {
  return path.join(RAIZ, modulo, 'data', 'execution-context.json');
}

function leerTodo(modulo) {
  const p = archivo(modulo);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

// Mismo literal que `SECCION_MULTIVALOR` en `core/context/testContext.js`
// (esa es la fuente de verdad de quién escribe acá) — lista de labels por
// caso que aceptan varios valores separados por "|". Se mira APARTE del
// valor sembrado (nunca a partir de si el valor ES un array) para que el
// hint del Panel no dependa de qué haya guardado el usuario la última vez:
// una clave sigue siendo "multivalor" aunque su valor actual sea un string
// vacío o uno ya completado.
const SECCION_MULTIVALOR = '_camposMultivalor';

function inferirTipo(clave, valor, esMultivalor) {
  if (/archivo|file/i.test(clave)) return 'file';
  if (typeof valor === 'boolean') return 'switch';
  if (esMultivalor || Array.isArray(valor)) return 'lista';
  return 'texto';
}

/**
 * Metadata OPCIONAL de agrupación visual por sección + requerido, SOLO para
 * el Panel — `<modulo>/data/campos-<caso>.js` (ej.
 * `empleados/data/campos-crear-empleado.js`). No es Input Model ni afecta la
 * ejecución del test: si el archivo no existe para un caso, no agrupa nada
 * (mismo criterio tolerante que `organizacion-tests.js`/`cargarOrganizacion`
 * del descubridor). Se invalida el cache de `require` en cada lectura, mismo
 * motivo que `descubridor.js#cargarOrganizacion`: el anfitrión es
 * long-lived.
 */
function camposCaso(modulo, caso) {
  const ruta = path.join(RAIZ, modulo, 'data', `campos-${caso}.js`);
  try {
    const resuelta = require.resolve(ruta);
    delete require.cache[resuelta];
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(resuelta);
  } catch (e) {
    return {};
  }
}

/** Sección del caso como Input Model degradado (nombre real + tipo inferido). */
function seccion(modulo, caso) {
  const todo = leerTodo(modulo);
  const s = todo[caso] || {};
  const multivalor = new Set((todo[SECCION_MULTIVALOR] && todo[SECCION_MULTIVALOR][caso]) || []);
  const campos = camposCaso(modulo, caso);
  return {
    caso,
    tieneSeccion: caso in todo,
    claves: Object.keys(s).map((k) => ({
      nombre: k,
      valor: s[k],
      tipo: inferirTipo(k, s[k], multivalor.has(k)),
      seccion: (campos[k] && campos[k].seccion) || null,
      requerido: !!(campos[k] && campos[k].requerido),
    })),
  };
}

/** Merge no destructivo de valores en la sección del caso. */
function guardar(modulo, caso, valores) {
  const p = archivo(modulo);
  const todo = leerTodo(modulo);
  todo[caso] = { ...(todo[caso] || {}), ...(valores || {}) };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(todo, null, 2), 'utf8');
  return seccion(modulo, caso);
}

module.exports = { seccion, guardar };
