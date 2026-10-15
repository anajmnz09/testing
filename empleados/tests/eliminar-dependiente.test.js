const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const navigationFlow = require('@triple/core/flows/navigationFlow');
const fixtures = require('../support/fixtures');
const EmpleadosPage = require('../pages/EmpleadosPage');

const CASO = 'eliminar-dependiente';
const CLAVE_EMPLEADO = 'Nombre de Empleado con el Dependiente a eliminar';
const CLAVE_DEPENDIENTE = 'Identificación o nombre del Dependiente a eliminar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_DEPENDIENTE]);

/**
 * Elimina un Dependiente de un Empleado: en la sección "Dependientes" selecciona el checkbox de la fila, clickea "Eliminar" y
 * confirma el popup con "Aceptar" (la columna "Acción" solo tiene "Editar").
 *
 * AUTOMÁTICO por defecto: sin dirección del Panel elige el PRIMER empleado del listado y el PRIMER dependiente de ese empleado.
 * Se puede dirigir el empleado, el dependiente (identificación o nombre exacto) o ambos. Sin dependientes el test FALLA
 * (precondición no cumplida).
 */
describe('Empleados - Eliminar Dependiente', function () {
  this.timeout(300000);
  // No idempotente (elimina un registro real): un reintento buscaría una fila que ya no debería existir.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: elimina un Dependiente existente y confirma que ya no aparece`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const dependienteDirigido = testContext.get(CASO, CLAVE_DEPENDIENTE);
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

    const abierta = await detalle.abrirSeccion('Dependientes');
    const titulo = await detalle.esperarTituloContenido('Dependientes');
    assert.ok(titulo.coincide, `El área de título no muestra "Dependientes" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Dependientes" no quedó activa para "${nombreEmpleado}".`);

    const filasAntes = await detalle.leerFilasDependientes();
    if (!filasAntes.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ningún Dependiente registrado — no hay nada que eliminar. ` +
          `(Precondición del escenario: se esperaba al menos una fila en la sección "Dependientes".)`
      );
    }
    const objetivo = dependienteDirigido || 0;
    const indice = detalle._indiceDependiente(filasAntes, objetivo);
    if (indice < 0) {
      assert.fail(
        `${CASO}: "${nombreEmpleado}" no tiene un Dependiente "${dependienteDirigido}". ` +
          `Dependientes: ${JSON.stringify(filasAntes.map((f) => `${f['Identificación']} (${f.Nombre})`))}.`
      );
    }
    const { Identificación: identificacion, Nombre: nombreDep } = filasAntes[indice];
    logger.info(`${CASO}: eliminando el Dependiente "${nombreDep}" (Identificación ${identificacion}) de "${nombreEmpleado}" (de ${filasAntes.length} fila(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Dependiente ANTES de eliminar - "${identificacion}"` });

    const res = await detalle.eliminarDependiente(identificacion);
    logger.info(`${CASO}: resultado de eliminar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Aceptar" en eliminar Dependiente - "${identificacion}"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) el Dependiente "${identificacion}" para eliminar.`);
    assert.ok(res.botonEliminarClickeado, 'No se encontró/clickeó el botón "Eliminar" de la sección "Dependientes".');
    assert.ok(res.popupApareció, `No apareció el popup de confirmación al eliminar "${identificacion}" (empleado "${nombreEmpleado}").`);
    assert.ok(res.popupCerrado, `El popup de confirmación no cerró tras "Aceptar" al eliminar el Dependiente "${identificacion}". Notify: "${res.notify}".`);

    // Persistencia: la fila ya NO debe estar en el grid.
    // Tras eliminar, el grid de esta sección NO se refresca solo (confirmado real: notify "Eliminado exitosamente" y la fila sigue
    // visible aunque se cambie de sección y se vuelva). La persistencia se verifica reabriendo el Empleado desde el listado.
    await ctx.driver.get(`${new URL(await ctx.driver.getCurrentUrl()).origin}/`); // dashboard (la sesión sigue abierta)
    await navigationFlow.abrirModulo(ctx.driver, 'Empleados');
    const lista2 = await new EmpleadosPage(ctx.driver).listo();
    const detalle2 = await lista2.abrirDetalle(nombreEmpleado);
    await detalle2.abrirSeccion('Dependientes');
    await detalle2.esperarTituloContenido('Dependientes');
    const filasDespues = await detalle2.leerFilasDependientes();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Dependiente DESPUÉS de eliminar - "${identificacion}"` });
    assert.ok(
      !filasDespues.some((f) => f['Identificación'] === identificacion),
      `El Dependiente "${identificacion}" sigue apareciendo en el grid tras eliminarlo (empleado "${nombreEmpleado}"). Filas: ${JSON.stringify(filasDespues.map((f) => f['Identificación']))}.`
    );
    logger.info(`${CASO}: verificado -> "${identificacion}" ya no aparece en la sección "Dependientes"`);
  });
});
