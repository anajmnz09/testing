'use strict';

/**
 * ÚNICA fuente de verdad del comando de ejecución (Command Discovery).
 *
 * El frontend nunca arma comandos: recibe un `run` opaco en el descriptor de
 * cada nodo y lo devuelve tal cual. Acá se traduce a la MISMA línea que un
 * desarrollador correría en la consola. Si mañana cambia la forma de ejecutar
 * (otro flag, otro script, otro motor), se cambia SOLO este archivo; ni el resto
 * del anfitrión ni la UI se tocan.
 *
 * `run` = { tipo: 'caso'|'carpeta'|'modulo', modulo, target? }
 *   - caso    → npm test -- tests/<archivo>.test.js
 *   - carpeta → npm test -- "tests/<glob>"        (el runner ya soporta globs)
 *   - modulo  → npm test
 */
function resolver(run) {
  if (!run || typeof run !== 'object') throw new Error('run inválido');
  const { tipo, modulo, target } = run;
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

module.exports = { resolver };
