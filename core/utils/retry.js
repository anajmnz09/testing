const logger = require('./logger');
const config = require('./../config');

/**
 * Ejecuta `fn` con un número ACOTADO de intentos y una recuperación opcional
 * entre intentos. Evita ciclos de exploración/ejecución prácticamente infinitos:
 * si tras `intentos` sigue fallando, propaga el último error (el llamador
 * registra el bloqueo y marca el test como Failed, continuando con el siguiente).
 *
 * OJO con operaciones que CREAN registros: reintentarlas puede duplicar datos.
 * Usar este wrapper para pasos de lectura/navegación/preparación, no para el
 * "guardar" en sí (para el guardar, el reintento a nivel test —TEST_RETRIES—
 * ya provee el límite, y solo re-crea si el intento previo no llegó a guardar).
 *
 * @param fn         async (intento:number) => any
 * @param intentos   máximo de intentos (default: TEST_RETRIES+1, mínimo 1)
 * @param recuperar  async (intento:number) => void  (ej. recovery.recuperarEstado)
 * @param etiqueta   texto para el log
 */
async function conRecuperacion(fn, { intentos, recuperar = null, etiqueta = '' } = {}) {
  const maxIntentos = Math.max(1, intentos != null ? intentos : (config.retries || 0) + 1);
  let ultimoError;

  for (let i = 1; i <= maxIntentos; i++) {
    try {
      return await fn(i);
    } catch (err) {
      ultimoError = err;
      logger.error(
        `Intento ${i}/${maxIntentos} falló${etiqueta ? ` [${etiqueta}]` : ''}: ${String((err && err.message) || err).split('\n')[0]}`
      );
      if (i < maxIntentos && typeof recuperar === 'function') {
        try {
          await recuperar(i);
        } catch (e) {
          logger.error('La recuperación entre intentos también falló', e);
        }
      }
    }
  }

  throw ultimoError;
}

module.exports = { conRecuperacion };
