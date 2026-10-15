const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-herramienta';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Herramienta';
const CLAVE_HERRAMIENTA = 'Descripción de la Herramienta a consultar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_HERRAMIENTA]);

/**
 * Consulta una Herramienta de un Empleado en la sección "Herramientas" del detalle (modo SOLO CONSULTA: no abre Opciones ni modifica
 * nada). Lee la fila de la herramienta en el listado y verifica que muestre sus datos (Fecha de asignación, Descripción; Referencia y
 * Fecha de Devolución son opcionales y se registran en el log); si el Panel dirigió la herramienta, comprueba además que la fila es esa.
 *
 * AUTOMÁTICO por defecto: primer empleado del listado y primera herramienta de ese empleado. Se puede dirigir el empleado, la
 * herramienta (por descripción) o ambos. Sin herramientas el test FALLA (precondición no cumplida). Distinto de
 * `consultar-herramientas`, que solo abre la sección.
 */
describe('Empleados - Consultar Herramienta', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: consulta una Herramienta de un Empleado existente y verifica sus datos`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const herramientaDirigida = testContext.get(CASO, CLAVE_HERRAMIENTA);
    let detalle;
    let nombreEmpleado = empleadoDirigido;
    if (empleadoDirigido) {
      detalle = await ctx.lista.abrirDetalle(empleadoDirigido);
    } else {
      if (!((await ctx.lista.grid.contarFilas()) > 0)) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — la suite asume que siempre hay al menos un registro.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreEmpleado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreEmpleado}"`);
    }

    const abierta = await detalle.abrirSeccion('Herramientas');
    const titulo = await detalle.esperarTituloContenido('Herramientas');
    assert.ok(titulo.coincide, `El área de título no muestra "Herramientas" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Herramientas" no quedó activa para "${nombreEmpleado}".`);

    const filas = await detalle.leerFilasHerramientas();
    if (!filas.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ninguna Herramienta registrada — no hay nada que consultar. ` +
          `(Precondición del escenario: se esperaba al menos una fila en la sección "Herramientas".)`
      );
    }
    if (herramientaDirigida && detalle._indiceHerramienta(filas, herramientaDirigida) < 0) {
      assert.fail(`${CASO}: "${nombreEmpleado}" no tiene una Herramienta con descripción "${herramientaDirigida}". Herramientas: ${JSON.stringify(filas.map((f) => f['Descripción']))}.`);
    }

    // La clave llega inline al localizador (`herramientaDirigida || 0`): el escáner de flujos demuestra que el test consume una herramienta.
    const fila = await detalle.leerHerramienta(herramientaDirigida || 0);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Herramienta consultada - "${fila['Descripción']}"` });
    logger.info(`${CASO}: fila consultada -> ${JSON.stringify(fila)}`);

    for (const columna of ['Fecha de asignación', 'Descripción']) {
      assert.ok(String(fila[columna] || '').trim(), `La columna "${columna}" de la Herramienta consultada está vacía. Fila: ${JSON.stringify(fila)}.`);
    }
    if (herramientaDirigida) {
      assertTextoIgual(String(fila['Descripción']).trim(), herramientaDirigida.trim(), 'La herramienta consultada no coincide con la dirigida.');
    }
    logger.info(`${CASO}: verificado -> Herramienta "${fila['Descripción']}" de "${nombreEmpleado}" (referencia "${fila.Referencia}", devolución "${fila['Fecha de Devolución']}")`);
  });
});
