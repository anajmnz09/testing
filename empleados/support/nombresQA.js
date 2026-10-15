const { unicoQA } = require('@triple/core/utils/datos');

/**
 * Mismo criterio que `configuracion/support/nombresQA.js#nombreUnicoQA`
 * (copia local — mismo patrón de "una copia por módulo" ya usado para
 * `siguienteNombreQA`/`siguienteNumeroQA` en `empleados/support/cambiosEditar.js`).
 *
 * Nombre para el default automático de "agregar-*" (cada corrida crea un
 * registro NUEVO — a diferencia de "editar-*", acá no hay un valor previo
 * que incrementar). Si `dirigido` tiene valor, se devuelve TAL CUAL — sin
 * sufijo — para que el dato guardado sea exactamente el pedido desde el
 * Panel. Solo si NO se dirigió nada se arma `base + sufijo corto y siempre
 * distinto` (últimos 6 dígitos del timestamp), para que corridas
 * automáticas sucesivas no dejen texto idéntico repetido (lo que rompería
 * la verificación de persistencia: un texto ya presente de una corrida
 * anterior no prueba que ESTA corrida guardó nada).
 */
function nombreUnicoQA(dirigido, base) {
  // Compatibilidad: ya no es una copia local, delega en el punto de acceso común (`@triple/core/utils/datos`).
  return unicoQA(dirigido, base);
}

module.exports = { nombreUnicoQA };
