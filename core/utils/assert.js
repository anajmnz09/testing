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
 * Compara dos STRINGS ignorando mayúsculas/minúsculas y espacios al borde
 * (`trim`). Lanza `AssertionError` (igual que cualquier `assert.*`) si no
 * coinciden, con `mensaje` como descripción del fallo.
 *
 * Exige que ambos valores sean `string`: no convierte números, booleans,
 * `null`/`undefined` u otros tipos a texto. Comparaciones numéricas o de
 * otro tipo deben seguir usando `assert.strictEqual`/`assert.equal` directo.
 */
function assertTextoIgual(actual, esperado, mensaje) {
  if (typeof actual !== 'string' || typeof esperado !== 'string') {
    throw new TypeError(
      `assertTextoIgual espera dos strings (actual=${typeof actual}, esperado=${typeof esperado}). ` +
        'Para comparar otros tipos, usar assert.strictEqual/assert.equal directamente.'
    );
  }
  const a = actual.trim().toLowerCase();
  const e = esperado.trim().toLowerCase();
  assert.ok(a === e, mensaje || `Se esperaba "${esperado}" (case-insensitive) y quedó en "${actual}".`);
}

module.exports = { assertTextoIgual };
