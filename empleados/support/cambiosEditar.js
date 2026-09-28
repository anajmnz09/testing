const { testContext } = require('@triple/core');

const PREFIJO = 'QA';

/**
 * Próximo nombre de una serie QA ACOTADA ("QA-1", "QA-2", ...) — mismo
 * criterio que `configuracion/support/nombresQA.js#siguienteNombreQA`
 * (duplicado localmente a propósito: Empleados es un módulo propio, no
 * depende de `configuracion`). Nunca crece sin límite corrida tras corrida.
 */
function siguienteNombreQA(actual) {
  const match = /^QA-(\d+)$/.exec(String(actual || '').trim());
  const siguiente = match ? parseInt(match[1], 10) + 1 : 1;
  return `${PREFIJO}-${siguiente}`;
}

/** Igual que `siguienteNombreQA`, pero para campos NUMÉRICOS (Rate, montos) — nunca texto en un editor numérico. Acotado 1-9999. */
function siguienteNumeroQA(actual) {
  const n = parseInt(actual, 10);
  if (Number.isFinite(n) && n >= 1 && n < 9999) return String(n + 1);
  return '1';
}

/**
 * Arma el dict `{ campo: valor }` de SOLO los campos que el Panel dirigió
 * explícitamente para `caso` (Execution Context), de la lista/mapa `campos`.
 * Mismo criterio "a nivel de CASO, no por campo" que
 * `configuracion/support/cambiosEditar.js` (ver incidente documentado en el
 * skill "testing-patterns": decidir el default automático mirando el
 * conjunto completo de cambios dirigidos, nunca campo por campo).
 */
function armarCambiosDirigidos(caso, campos, { excluir = [] } = {}) {
  const labels = Array.isArray(campos) ? campos : Object.keys(campos);
  const cambios = {};
  for (const label of labels) {
    if (excluir.includes(label)) continue;
    const valor = testContext.get(caso, label);
    if (valor !== undefined && valor !== '') cambios[label] = valor;
  }
  return cambios;
}

/**
 * Si `cambios` quedó VACÍO (el Panel no dirigió NADA para este caso) y
 * `condicionExtra` tampoco aplica, agrega los `defaults` provistos — nunca
 * si el Panel ya dirigió algo (para no pisar lo que el usuario pidió).
 * `defaults`: array de `{ campo, valor: string | () => Promise<string> }`.
 */
async function aplicarDefaultSiVacio(cambios, { condicionExtra = false, defaults = [] } = {}) {
  if (Object.keys(cambios).length || condicionExtra) return cambios;
  for (const { campo, valor } of defaults) {
    cambios[campo] = typeof valor === 'function' ? await valor() : valor;
  }
  return cambios;
}

module.exports = { siguienteNombreQA, siguienteNumeroQA, armarCambiosDirigidos, aplicarDefaultSiVacio };
