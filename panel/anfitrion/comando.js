'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const SEGURO = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * ÚNICA fuente de verdad del comando de ejecución (Command Discovery).
 *
 * El frontend nunca arma comandos: recibe un `run` opaco en el descriptor de
 * cada nodo y lo devuelve tal cual. Acá se traduce a la MISMA línea que un
 * desarrollador correría en la consola. Si mañana cambia la forma de ejecutar
 * (otro flag, otro script, otro motor), se cambia SOLO este archivo; ni el resto
 * del anfitrión ni la UI se tocan.
 *
 * `run` = { tipo: 'caso'|'carpeta'|'modulo'|'flujo', modulo, target?, casos? }
 *   - caso    → npm test -- tests/<archivo>.test.js
 *   - carpeta → npm test -- "tests/<glob>"        (el runner ya soporta globs)
 *   - modulo  → npm test
 *   - flujo   → node core/scripts/run-flow.js <modulo>/<caso> ...   (`casos` en el ORDEN DE
 *               SELECCIÓN del usuario; el orden real lo decide el planner del framework según
 *               `requires`/`produces`, no el Panel; un flujo no recibe datos)
 */

/**
 * Valida los casos de un flujo. El comando se ejecuta con `shell: true`, así que
 * solo se aceptan nombres "seguros" que además correspondan a un test existente.
 * Devuelve `[{ modulo, caso }]` normalizado o lanza un Error.
 */
function validarCasosFlujo(casos) {
  if (!Array.isArray(casos) || !casos.length) throw new Error('flujo sin casos');
  return casos.map((c) => {
    const modulo = c && c.modulo;
    const caso = c && c.caso;
    if (!SEGURO.test(String(modulo)) || !SEGURO.test(String(caso))) throw new Error('caso de flujo inválido');
    if (!fs.existsSync(path.join(RAIZ, modulo, 'tests', `${caso}.test.js`))) {
      throw new Error(`no existe el test ${modulo}/${caso}`);
    }
    return { modulo, caso };
  });
}

/** Argumentos de run-flow.js (`<modulo>/<caso>` por caso, en el orden recibido). */
function argsFlujo(casos) {
  return validarCasosFlujo(casos).map((c) => `${c.modulo}/${c.caso}`);
}

function resolver(run) {
  if (!run || typeof run !== 'object') throw new Error('run inválido');
  const { tipo, modulo, target } = run;

  if (tipo === 'flujo') {
    return { cwd: '.', comando: `node core/scripts/run-flow.js ${argsFlujo(run.casos).join(' ')}` };
  }

  if (!modulo) throw new Error('run sin módulo');

  switch (tipo) {
    case 'modulo':
      return { cwd: modulo, comando: 'npm test' };
    case 'caso':
      if (!target) throw new Error('run de caso sin target');
      return { cwd: modulo, comando: `npm test -- ${target}` };
    case 'carpeta':
      if (!target) throw new Error('run de carpeta sin target');
      return { cwd: modulo, comando: `npm test -- "${target}"` };
    default:
      throw new Error(`tipo de run desconocido: ${tipo}`);
  }
}

module.exports = { resolver, argsFlujo, validarCasosFlujo };
