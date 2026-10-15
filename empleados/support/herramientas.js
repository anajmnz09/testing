const assert = require('assert');
const logger = require('@triple/core/utils/logger');

/**
 * Pasos comunes de los casos de documentos de una Herramienta (adjuntar / descargar / eliminar), idénticos en los tres, DESPUÉS de
 * abrir el Empleado: entrar a "Herramientas" y elegir la herramienta (dirigida por descripción o la PRIMERA). Sin herramientas el
 * caso FALLA (precondición no cumplida). Cada test abre al Empleado (`ctx.lista.abrirDetalle`/`abrirPrimero`) y luego la pantalla de
 * adjuntos (`detalle.abrirAdjuntarHerramienta(objetivo)`) EN SU PROPIO CÓDIGO: así el escáner de flujos (que analiza el test, no los
 * helpers) ve qué páginas usa.
 *
 * @param {object} detalle `EmpleadoDetallePage` ya abierta
 * @param {string} nombreEmpleado
 * @param {string} caso nombre del caso (para los mensajes)
 * @param {{ herramienta?: string, accion: string }} dirigido descripción dirigida desde el Panel; `accion` = qué se hará (mensajes)
 * @returns {Promise<{ nombreHerramienta: string, objetivo: string|number }>}
 */
async function elegirHerramienta(detalle, nombreEmpleado, caso, { herramienta, accion }) {
  const abierta = await detalle.abrirSeccion('Herramientas');
  const titulo = await detalle.esperarTituloContenido('Herramientas');
  assert.ok(titulo.coincide, `El área de título no muestra "Herramientas" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
  assert.ok(abierta.activada, `La sección "Herramientas" no quedó activa para "${nombreEmpleado}".`);

  const filas = await detalle.leerFilasHerramientas();
  if (!filas.length) {
    assert.fail(
      `${caso}: el empleado "${nombreEmpleado}" no tiene ninguna Herramienta registrada — no hay a quién ${accion}. ` +
        `(Precondición del escenario: se esperaba al menos una fila en la sección "Herramientas".)`
    );
  }
  const objetivo = herramienta || 0;
  const indice = detalle._indiceHerramienta(filas, objetivo);
  if (indice < 0) {
    assert.fail(
      `${caso}: "${nombreEmpleado}" no tiene una Herramienta con descripción "${herramienta}". ` +
        `Herramientas: ${JSON.stringify(filas.map((f) => f['Descripción']))}.`
    );
  }
  const nombreHerramienta = filas[indice]['Descripción'];
  logger.info(`${caso}: usando la Herramienta "${nombreHerramienta}" de "${nombreEmpleado}"`);

  return { nombreHerramienta, objetivo };
}

/** Confirma que la pantalla de adjuntos abierta es la de ESA herramienta (la app capitaliza la descripción: "kkk" -> "Kkk"). */
async function verificarTituloHerramienta(adjuntos, nombreHerramienta) {
  const tituloPantalla = await adjuntos.tituloHerramienta();
  assert.ok(
    tituloPantalla.toLowerCase().includes(String(nombreHerramienta).toLowerCase()),
    `La pantalla de adjuntos no está titulada con la Herramienta "${nombreHerramienta}" (título leído: "${tituloPantalla}").`
  );
}

module.exports = { elegirHerramienta, verificarTituloHerramienta };
