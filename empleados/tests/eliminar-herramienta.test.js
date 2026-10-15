const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const navigationFlow = require('@triple/core/flows/navigationFlow');
const fixtures = require('../support/fixtures');
const EmpleadosPage = require('../pages/EmpleadosPage');
const HerramientaFormPage = require('../pages/HerramientaFormPage');

const CASO = 'eliminar-herramienta';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Herramienta a eliminar';
const CLAVE_HERRAMIENTA = 'Descripción de la Herramienta a eliminar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_HERRAMIENTA]);

/**
 * Elimina una Herramienta de un Empleado: en la sección "Herramientas" marca el checkbox de la fila, clickea "Eliminar" y confirma el
 * popup con "Aceptar" (la columna "Opciones" solo ofrece Retornar y Adjuntar).
 *
 * AUTOMÁTICO por defecto: primer empleado del listado; si el Panel no dirige la herramienta, el test ASIGNA una propia (mismo flujo y
 * datos que `agregar-herramienta`) y elimina ESA: así nunca borra por sorpresa una herramienta que el empleado ya tenía. Con la
 * herramienta dirigida por el Panel (descripción) elimina esa; si no existe, el test FALLA.
 *
 * RESTRICCIÓN DE LA APP (confirmada con Selenium real en flujo, 2026-10-13): una herramienta con documentos adjuntos NO se puede eliminar
 * ("Error eliminando detalle de herramientas de trabajo del empleado"); una devuelta (retornada) o sin adjuntos sí. Por eso en un flujo
 * `adjuntar-herramienta` + `eliminar-herramienta` sobre la misma herramienta falla este test (y, mientras la app no deje eliminar
 * documentos de herramienta, `eliminar-documento-herramienta` tampoco puede liberarla).
 *
 * El grid de la sección no se refresca solo tras eliminar: la persistencia se verifica reabriendo el Empleado desde el listado.
 */
describe('Empleados - Eliminar Herramienta', function () {
  this.timeout(300000);
  // No idempotente (elimina un registro real): un reintento buscaría una fila que ya no debería existir.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: elimina una Herramienta existente y confirma que ya no aparece`, async function () {
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

    let filas = await detalle.leerFilasHerramientas();
    let nombreHerramienta = herramientaDirigida;
    if (herramientaDirigida) {
      if (detalle._indiceHerramienta(filas, herramientaDirigida) < 0) {
        assert.fail(`${CASO}: "${nombreEmpleado}" no tiene una Herramienta con descripción "${herramientaDirigida}". Herramientas: ${JSON.stringify(filas.map((f) => f['Descripción']))}.`);
      }
    } else {
      logger.info(`${CASO}: asignando una Herramienta propia a "${nombreEmpleado}" para eliminarla (no se toca ninguna ya existente)`);
      const alta = await detalle.abrirAgregarHerramienta();
      const valores = datos.deFormulario('agregar-herramienta', HerramientaFormPage.ESTRATEGIAS);
      await alta.completar(valores, { autofill: false });
      const resAlta = await alta.guardar();
      assert.ok(resAlta.exito && !resAlta.invalido, `${CASO}: no se pudo asignar una Herramienta previa a "${nombreEmpleado}" (notify: "${resAlta.notify}").`);
      nombreHerramienta = valores.Descripción;
      await detalle.abrirSeccion('Herramientas');
      await detalle.esperarTituloContenido('Herramientas');
      filas = await detalle.leerFilasHerramientas();
    }
    logger.info(`${CASO}: eliminando la Herramienta "${nombreHerramienta}" de "${nombreEmpleado}" (de ${filas.length} fila(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Herramienta ANTES de eliminar - "${nombreHerramienta}"` });

    // La clave llega inline al eliminador (`herramientaDirigida || nombreHerramienta`): el escáner de flujos demuestra que el test consume una herramienta.
    const res = await detalle.eliminarHerramienta(herramientaDirigida || nombreHerramienta);
    logger.info(`${CASO}: resultado de eliminar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Aceptar" en eliminar Herramienta - "${nombreHerramienta}"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) la Herramienta "${nombreHerramienta}" para eliminar.`);
    assert.ok(res.botonEliminarClickeado, 'No se encontró/clickeó el botón "Eliminar" de la sección "Herramientas".');
    assert.ok(res.popupApareció, `No apareció el popup de confirmación al eliminar "${nombreHerramienta}" (empleado "${nombreEmpleado}").`);
    assert.ok(res.popupCerrado, `El popup de confirmación no cerró tras "Aceptar" al eliminar la Herramienta "${nombreHerramienta}". Notify: "${res.notify}".`);
    assert.ok(/exitos/i.test(res.notify), `Se esperaba un notify de éxito al eliminar la Herramienta "${nombreHerramienta}" (quedó "${res.notify}").`);

    // Persistencia: el grid in-place no se refresca solo; se reabre el Empleado desde el listado (dashboard -> Empleados -> detalle).
    await ctx.driver.get(`${new URL(await ctx.driver.getCurrentUrl()).origin}/`);
    await navigationFlow.abrirModulo(ctx.driver, 'Empleados');
    const lista2 = await new EmpleadosPage(ctx.driver).listo();
    const detalle2 = await lista2.abrirDetalle(nombreEmpleado);
    await detalle2.abrirSeccion('Herramientas');
    await detalle2.esperarTituloContenido('Herramientas');
    const filasDespues = await detalle2.leerFilasHerramientas();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Herramientas DESPUÉS de eliminar - "${nombreHerramienta}"` });
    assert.ok(
      detalle2._indiceHerramienta(filasDespues, nombreHerramienta) < 0,
      `La Herramienta "${nombreHerramienta}" sigue apareciendo tras eliminarla y reabrir el Empleado. Filas: ${JSON.stringify(filasDespues.map((f) => f['Descripción']))}.`
    );
    logger.info(`${CASO}: verificado -> "${nombreHerramienta}" ya no aparece en "Herramientas"`);
  });
});
