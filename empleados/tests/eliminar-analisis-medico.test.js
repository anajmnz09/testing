const assert = require('assert');
const { testContext, evidence, testFiles, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const navigationFlow = require('@triple/core/flows/navigationFlow');
const fixtures = require('../support/fixtures');
const EmpleadosPage = require('../pages/EmpleadosPage');

const CASO = 'eliminar-analisis-medico';
const CLAVE_EMPLEADO = 'Nombre del Empleado con Documentos de Análisis médicos';
const CLAVE_DOCUMENTO = 'Nombre del Documento a eliminar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_DOCUMENTO]);

/**
 * Elimina un documento de la sección "Análisis médicos" (Documentos) del detalle de un Empleado: se marca el checkbox del documento, se
 * clickea "Eliminar" y se confirma el popup con "Aceptar" (ver `DocumentosAdjuntosPage.eliminar`). Mismo funcionamiento que
 * `eliminar-documento-capacitacion`.
 *
 * AUTOMÁTICO por defecto: primer empleado; el Panel puede dirigir el empleado y/o el documento. Sin documento dirigido, el test ADJUNTA
 * uno propio (PDF genérico) y elimina ESE: así nunca borra por sorpresa un documento real del empleado.
 *
 * El grid en pantalla puede no refrescarse solo tras eliminar: si el documento sigue listado, la persistencia se verifica REABRIENDO el
 * Empleado desde el dashboard (la sección vive dentro del panel del Empleado, no tiene pantalla propia que recargar con F5).
 */
describe('Empleados - Eliminar Análisis médico', function () {
  this.timeout(300000);
  // No idempotente (elimina un registro real): un reintento buscaría un documento que ya no debería existir.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: elimina un documento de "Análisis médicos" y confirma que ya no aparece`, async function () {
    const documentoDirigido = testContext.get(CASO, CLAVE_DOCUMENTO);
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
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

    const adjuntos = await detalle.abrirAnalisisMedicos(); // Documentos > Análisis médicos
    assertTextoIgual(await adjuntos.tituloSeccion(), 'Análisis médicos', `El título de la sección no es "Análisis médicos" (empleado: "${nombreEmpleado}").`);

    let filasDoc = await adjuntos.leerAdjuntos();
    let nombreDoc = documentoDirigido;
    if (documentoDirigido) {
      if (!filasDoc.some((f) => f.toLowerCase().includes(documentoDirigido.toLowerCase()))) {
        assert.fail(`${CASO}: "Análisis médicos" de "${nombreEmpleado}" no tiene un documento que contenga "${documentoDirigido}". Documentos: ${JSON.stringify(filasDoc)}.`);
      }
    } else {
      logger.info(`${CASO}: subiendo un documento propio a "Análisis médicos" para eliminarlo (no se toca ninguno ya existente)`);
      const archivo = testFiles.resolver({ tipo: 'pdf', base: 'eliminar-analisis-medico' });
      const resAdjuntar = await adjuntos.adjuntar(archivo.ruta);
      assert.ok(
        resAdjuntar.exito && !resAdjuntar.invalido,
        `${CASO}: no se pudo adjuntar un documento previo en "Análisis médicos" para poder eliminarlo (notify: "${resAdjuntar.notify}").`
      );
      nombreDoc = archivo.nombre.replace(/\.[^.]+$/, '');
      filasDoc = await adjuntos.esperarAdjunto(nombreDoc);
    }
    logger.info(`${CASO}: eliminando el documento "${nombreDoc}" de "Análisis médicos" (de ${filasDoc.length} documento(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos ANTES de eliminar - "Análisis médicos"` });

    const res = await adjuntos.eliminar(nombreDoc);
    logger.info(`${CASO}: resultado de eliminar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Aceptar" en eliminar documento - "Análisis médicos"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) el documento "${nombreDoc}" para eliminar.`);
    assert.ok(res.popupApareció, `No apareció el popup de confirmación al eliminar el documento "${nombreDoc}".`);
    assert.ok(res.popupCerrado, `El popup de confirmación no cerró tras "Aceptar" al eliminar "${nombreDoc}". Notify: "${res.notify}".`);
    assert.ok(/exitos/i.test(res.notify), `Se esperaba un notify de éxito al eliminar el documento "${nombreDoc}" (quedó "${res.notify}").`);

    // Persistencia: se espera a que el grid tenga una coincidencia menos; si no se refresca solo, se reabre el Empleado desde el dashboard.
    // Se compara la CANTIDAD de coincidencias (no su mera presencia): en un flujo, otro caso pudo adjuntar documentos con el mismo nombre.
    const coincidencias = (filas) => filas.filter((f) => f.toLowerCase().includes(nombreDoc.toLowerCase())).length;
    const antes = coincidencias(filasDoc);
    const sigueListado = (filas) => coincidencias(filas) >= antes;
    let filasTras = await adjuntos.leerAdjuntos();
    await ctx.driver
      .wait(async () => {
        filasTras = await adjuntos.leerAdjuntos().catch(() => filasTras);
        return !sigueListado(filasTras);
      }, 8000)
      .catch(() => {});
    if (sigueListado(filasTras)) {
      logger.info(`${CASO}: el grid no se refrescó solo: se reabre el Empleado "${nombreEmpleado}" para releer la sección`);
      await ctx.driver.get(`${new URL(await ctx.driver.getCurrentUrl()).origin}/`);
      await navigationFlow.abrirModulo(ctx.driver, 'Empleados');
      const lista2 = await new EmpleadosPage(ctx.driver).listo();
      const detalle2 = await lista2.abrirDetalle(nombreEmpleado);
      const adjuntos2 = await detalle2.abrirAnalisisMedicos();
      filasTras = await adjuntos2.leerAdjuntos();
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos DESPUÉS de eliminar - "Análisis médicos"` });
    assert.ok(
      !sigueListado(filasTras),
      `El documento "${nombreDoc}" no se eliminó: había ${antes} coincidencia(s) y siguen ${coincidencias(filasTras)} en "Análisis médicos" tras eliminarlo y reabrir al Empleado. Documentos: ${JSON.stringify(filasTras)}.`
    );
    logger.info(`${CASO}: verificado -> "${nombreDoc}" pasó de ${antes} a ${coincidencias(filasTras)} coincidencia(s)`);
  });
});
