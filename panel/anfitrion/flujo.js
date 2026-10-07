'use strict';

const { execFile } = require('child_process');
const path = require('path');
const comando = require('./comando');

const RAIZ = path.resolve(__dirname, '..', '..');
const RUN_FLOW = path.join(RAIZ, 'core', 'scripts', 'run-flow.js');
const MARCA = '@@FLOW_PLAN@@';

/**
 * Previsualización del orden de un flujo. El Panel NO planifica: delega en
 * `core/scripts/run-flow.js --plan` (el MISMO planner y la MISMA lectura de
 * contextos por módulo que usa la ejecución real) y devuelve su resultado tal
 * cual: { orden:[{modulo,caso}], avisos, errores, produce, requiere }.
 *
 * Sin shell (execFile con argumentos) y sin tocar reports/ (--plan no crea nada).
 */
function planear(casos) {
  return new Promise((resolve) => {
    let args;
    try {
      args = comando.argsFlujo(casos);
    } catch (e) {
      return resolve({ ok: false, motivo: String(e.message || e) });
    }
    execFile(process.execPath, [RUN_FLOW, '--plan', ...args], { cwd: RAIZ, timeout: 20000 }, (err, stdout, stderr) => {
      const linea = String(stdout || '')
        .split(/\r?\n/)
        .find((l) => l.startsWith(MARCA));
      if (!linea) {
        const detalle = String(stderr || (err && err.message) || 'sin respuesta del planner').trim();
        return resolve({ ok: false, motivo: detalle.split('\n').slice(-1)[0] });
      }
      try {
        resolve({ ok: true, ...JSON.parse(linea.slice(MARCA.length)) });
      } catch (e) {
        resolve({ ok: false, motivo: 'respuesta del planner ilegible' });
      }
    });
  });
}

module.exports = { planear };
