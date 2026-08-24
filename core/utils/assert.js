const assert = require('assert');

/**
 * Aserciones compartidas del framework.
 *
 * `assertTextoIgual` es el mecanismo OBLIGATORIO para comparar texto
 * renderizado por la app (grid, formulario, página de detalle, título, etc.)
 * contra un valor esperado: la app puede devolver el mismo valor con distinto
 * case (ej. "Inactivo" vs "inactivo" tipeado desde el Panel) y eso NO debe
 * fallar un test. No repetir `.trim().toLowerCase()` a mano en los tests —
 * usar este helper, para que el criterio quede en un solo lugar.
 */

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
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Compara dos STRINGS ignorando mayúsculas/minúsculas y espacios al borde
 * (`trim`). Lanza `AssertionError` (igual que cualquier `assert.*`) si no
 * coinciden, con `mensaje` como descripción del fallo.
 *
 * Exige que ambos valores sean `string`: no convierte números, booleans,
 * `null`/`undefined` u otros tipos a texto. Comparaciones numéricas o de
 * otro tipo deben seguir usando `assert.strictEqual`/`assert.equal` directo.
 */
function assertTextoIgual(actual, esperado, mensaje) {
  assert.ok(
    textoIgual(actual, esperado),
    mensaje || `Se esperaba "${esperado}" (case-insensitive) y quedó en "${actual}".`
  );
}

module.exports = { assertTextoIgual, textoIgual };
