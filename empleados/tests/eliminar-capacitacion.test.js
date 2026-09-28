const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'eliminar-capacitacion';
const CLAVE_EMPLEADO = 'Nombre de Empleado con la Capacitación a eliminar';
const CLAVE_CAPACITACION = 'Nombre de la Capacitación a eliminar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_CAPACITACION]);

/**
 * Elimina una Capacitación de un Empleado: en la sección "Capacitación",
 * selecciona el checkbox (primera columna del grid) de la fila objetivo,
 * clickea "Eliminar" (al lado de "Agregar") y confirma el popup ("Eliminar
 * Capacitación... ¿Seguro que desea eliminar los registros seleccionados?")
 * con "Aceptar" — ver `EmpleadoDetallePage.eliminarCapacitacion`.
 *
 * Empleado: dirigido desde el Panel o el PRIMERO del listado. Capacitación:
 * opcionalmente dirigida por nombre; si no, la PRIMERA fila del grid. Si el
 * empleado NO tiene ninguna capacitación -> el test FALLA (precondición no
 * cumplida, mismo criterio que `adjuntar-capacitacion`).
 *
 * Nota sobre el reporte inicial de bug (usuario, 2026-09-09): un probe
 * exploratorio con clicks crudos SÍ reprodujo 2/2 veces un popup de
 * confirmación que nunca cerraba — consistente con lo reportado. Pero esta
 * implementación real (que usa `Popup.accionar`, con poll hasta que el
 * botón exista/esté habilitado, en vez de un click crudo) completó el
 * flujo exitosamente 3/3 veces reales al validarla — ver el historial
 * completo en `EmpleadoDetallePage.eliminarCapacitacion`. Las aserciones de
 * este test verifican el comportamiento CORRECTO end-to-end (popup cierra +
 * notify de éxito + la fila desaparece del grid); si el cuelgue vuelve a
 * aparecer en una corrida futura, este test lo va a atrapar solo (fallará
 * en `popupCerrado`) — no hace falta una excepción especial para eso.
 */
describe('Empleados - Eliminar Capacitación', function () {
  this.timeout(300000);
  // No idempotente (elimina un registro real) — mismo criterio que
  // `editar-cuenta-contable`: un reintento automático buscaría una fila que
  // ya no debería existir. Desactivado a propósito.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: elimina una Capacitación existente y confirma que ya no aparece`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const capacitacionDirigida = testContext.get(CASO, CLAVE_CAPACITACION);
    let detalle;
    let nombreEmpleado = empleadoDirigido;

    if (empleadoDirigido) {
      detalle = await ctx.lista.abrirDetalle(empleadoDirigido);
    } else {
      const hayFilas = (await ctx.lista.grid.contarFilas()) > 0;
      if (!hayFilas) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — ` +
            `la suite asume que siempre hay al menos un registro.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreEmpleado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreEmpleado}"`);
    }

    const abierta = await detalle.abrirSeccion('Capacitación');
    const titulo = await detalle.esperarTituloContenido('Capacitación');
    assert.ok(titulo.coincide, `El área de título no muestra "Capacitación" (empleado: "${nombreEmpleado}").`);
    assert.ok(abierta.activada, `La sección "Capacitación" no quedó activa para "${nombreEmpleado}".`);

    const filasAntes = await detalle.leerFilasCapacitacion();
    if (!filasAntes.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ninguna Capacitación registrada — no hay nada que eliminar. ` +
          `(Precondición del escenario: se esperaba al menos una fila en la sección "Capacitación".)`
      );
    }

    let nombreCap = filasAntes[0].Nombre;
    if (capacitacionDirigida) {
      const existe = filasAntes.some((f) => String(f.Nombre || '').trim().toLowerCase() === capacitacionDirigida.trim().toLowerCase());
      if (!existe) {
        assert.fail(
          `${CASO}: "${nombreEmpleado}" no tiene una Capacitación llamada "${capacitacionDirigida}". ` +
            `Capacitaciones: ${JSON.stringify(filasAntes.map((f) => f.Nombre))}.`
        );
      }
      nombreCap = capacitacionDirigida;
    }
    logger.info(`${CASO}: eliminando la Capacitación "${nombreCap}" de "${nombreEmpleado}" (de ${filasAntes.length} fila(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Capacitación ANTES de eliminar - "${nombreCap}"` });

    const res = await detalle.eliminarCapacitacion(capacitacionDirigida || undefined);
    logger.info(`${CASO}: resultado de eliminar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Aceptar" en eliminar Capacitación - "${nombreCap}"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) la Capacitación "${nombreCap}" para eliminar.`);
    assert.ok(res.botonEliminarClickeado, `No se encontró/clickeó el botón "Eliminar" de la sección "Capacitación".`);
    assert.ok(
      res.popupApareció,
      `No apareció el popup de confirmación al eliminar "${nombreCap}" (empleado "${nombreEmpleado}").`
    );
    assert.ok(
      res.popupCerrado,
      `El popup de confirmación no cerró tras "Aceptar" al eliminar la Capacitación "${nombreCap}" ` +
        `(empleado "${nombreEmpleado}"). Notify: "${res.notify}".`
    );

    // Verificación de persistencia: la fila ya NO debe estar en el grid.
    const filasDespues = await detalle.leerFilasCapacitacion();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Capacitación DESPUÉS de eliminar - "${nombreCap}"` });
    const siguePresente = filasDespues.some((f) => String(f.Nombre || '').trim().toLowerCase() === nombreCap.trim().toLowerCase());
    assert.ok(
      !siguePresente,
      `La Capacitación "${nombreCap}" sigue apareciendo en el grid tras eliminarla (empleado "${nombreEmpleado}"). ` +
        `Filas restantes: ${JSON.stringify(filasDespues.map((f) => f.Nombre))}.`
    );
    logger.info(`${CASO}: verificado -> "${nombreCap}" ya no aparece en la sección "Capacitación"`);
  });
});
