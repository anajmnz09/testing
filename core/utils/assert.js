const assert = require('assert');

/**
 * Aserciones compartidas del framework.
 *
 * `assertTextoIgual` es el mecanismo OBLIGATORIO para comparar texto
 * renderizado por la app (grid, formulario, página de detalle, título, etc.)
 * contra un valor esperado: la app puede devolver el mismo valor con distinto
 * case (ej. "Inactivo" vs "inactivo" tipeado desde el Panel) o con acentos
 * inconsistentes (ej. "Renovación" vs "Renovacion") y eso NO debe fallar un
 * test. No repetir `.trim().toLowerCase()` a mano en los tests — usar este
 * helper, para que el criterio quede en un solo lugar.
 *
 * Trade-off aceptado a propósito: plegar acentos puede igualar dos palabras
 * distintas en español (ej. "año" vs "ano"). Se acepta porque el caso real
 * que motivó esto (un valor tipeado desde el Panel/Execution Context sin
 * tilde, comparado contra el mismo valor que la app SÍ acentúa al
 * renderizar) es mucho más frecuente en este framework que una colisión
 * semántica real entre dos valores de negocio distintos que solo difieran
 * en un acento — no se conoce ningún caso así en las entidades del sistema
 * hoy. Si alguna vez aparece uno, la solución es el escape hatch de
 * `contrato-comparacion-texto-ui.spec.js` para ESE call site puntual, no
 * revertir el plegado acá.
 */

/** Recorta, pliega a minúscula y elimina diacríticos (acentos) vía NFD. */
function normalizarTexto(s) {
  return String(s)
    .trim()
    .normalize('NFD')
    .replace(new RegExp('[\u0300-\u036f]', 'g'), '')
    .toLowerCase();
}

/**
 * Versión BOOLEANA (no lanza) del mismo criterio que `assertTextoIgual`: para
 * cuando hace falta USAR la comparación en un predicado (ej. `Array.find`
 * sobre filas de un grid) en vez de afirmarla. Exige `string` en ambos lados
 * por la misma razón: no inventar coerciones de tipo silenciosas.
 */
function textoIgual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    throw new TypeError(`textoIgual espera dos strings (a=${typeof a}, b=${typeof b}).`);
  }
  return normalizarTexto(a) === normalizarTexto(b);
}

/**
 * Compara dos STRINGS ignorando mayúsculas/minúsculas, acentos y espacios al
 * borde (`trim`). Lanza `AssertionError` (igual que cualquier `assert.*`) si
 * no coinciden, con `mensaje` como descripción del fallo.
 *
 * Exige que ambos valores sean `string`: no convierte números, booleans,
 * `null`/`undefined` u otros tipos a texto. Comparaciones numéricas o de
 * otro tipo deben seguir usando `assert.strictEqual`/`assert.equal` directo.
 */
function assertTextoIgual(actual, esperado, mensaje) {
  assert.ok(
    textoIgual(actual, esperado),
    mensaje || `Se esperaba "${esperado}" (case/acento-insensitive) y quedó en "${actual}".`
  );
}

module.exports = { assertTextoIgual, textoIgual, normalizarTexto };
