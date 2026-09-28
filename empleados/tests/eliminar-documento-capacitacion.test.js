const assert = require('assert');
const { testContext, evidence, testFiles } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'eliminar-documento-capacitacion';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Capacitación';
const CLAVE_CAPACITACION = 'Nombre de la Capacitación con el documento (opcional)';
const CLAVE_DOCUMENTO = 'Nombre del Documento a eliminar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_CAPACITACION, CLAVE_DOCUMENTO]);

/**
 * Elimina un documento adjunto de una Capacitación: entra a la pantalla de
 * adjuntos (ícono de clip "Adjuntar documento" de la columna "Acción"),
 * selecciona el checkbox (primera columna del grid) del documento objetivo,
 * clickea "Eliminar" (al lado de "Adjuntar") y confirma el popup con
 * "Aceptar" — ver `CapacitacionAdjuntosPage.eliminar`.
 *
 * Empleado: dirigido desde el Panel o el PRIMERO del listado. Capacitación:
 * opcionalmente dirigida por nombre; si no, la PRIMERA fila del grid de
 * Capacitación. Si el empleado NO tiene ninguna capacitación -> el test
 * FALLA (precondición no cumplida). Documento: opcionalmente dirigido por
 * nombre; si la capacitación NO tiene ningún documento adjunto (ni el
 * dirigido, ni ninguno en modo auto), este test ADJUNTA uno primero (mismo
 * PDF genérico que `adjuntar-capacitacion`) para no depender de que otro
 * test haya corrido antes.
 *
 * Esta eliminación SÍ funciona en el backend, pero el grid en pantalla NO se
 * refresca solo tras eliminar (confirmado con Selenium real, 2026-09-09): la
 * verificación de persistencia por eso RECARGA (F5) la pantalla de adjuntos
 * en vez de releer el grid in-place — ver el docblock de
 * `CapacitacionAdjuntosPage.eliminar`.
 */
describe('Empleados - Eliminar Documento de Capacitación', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: elimina un documento adjunto y confirma que ya no aparece (recargando la pantalla)`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const capacitacionDirigida = testContext.get(CASO, CLAVE_CAPACITACION);
    const documentoDirigido = testContext.get(CASO, CLAVE_DOCUMENTO);
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

    await detalle.abrirSeccion('Capacitación');
    await detalle.esperarTituloContenido('Capacitación');

    const filasCap = await detalle.leerFilasCapacitacion();
    if (!filasCap.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ninguna Capacitación registrada — no hay a qué eliminarle un documento.`
      );
    }
    let objetivoCap = 0;
    let nombreCap = filasCap[0].Nombre;
    if (capacitacionDirigida) {
      const idx = filasCap.findIndex((f) => String(f.Nombre || '').trim().toLowerCase() === capacitacionDirigida.trim().toLowerCase());
      if (idx < 0) {
        assert.fail(
          `${CASO}: "${nombreEmpleado}" no tiene una Capacitación llamada "${capacitacionDirigida}". ` +
            `Capacitaciones: ${JSON.stringify(filasCap.map((f) => f.Nombre))}.`
        );
      }
      objetivoCap = capacitacionDirigida;
      nombreCap = filasCap[idx].Nombre;
    }
    logger.info(`${CASO}: usando la Capacitación "${nombreCap}" de "${nombreEmpleado}"`);

    let adjuntos = await detalle.abrirAdjuntarCapacitacion(objetivoCap);
    let filasDoc = await adjuntos.leerAdjuntos();

    let nombreDoc = documentoDirigido;
    if (documentoDirigido) {
      const existe = filasDoc.some((f) => f.toLowerCase().includes(documentoDirigido.toLowerCase()));
      if (!existe) {
        assert.fail(
          `${CASO}: la Capacitación "${nombreCap}" no tiene un documento que contenga "${documentoDirigido}". ` +
            `Documentos: ${JSON.stringify(filasDoc)}.`
        );
      }
    } else if (!filasDoc.length) {
      // Sin documento dirigido y sin ninguno existente: se adjunta uno para no depender de otro test.
      logger.info(`${CASO}: "${nombreCap}" no tiene documentos adjuntos — subiendo uno para poder eliminarlo`);
      const archivo = testFiles.resolver({ tipo: 'pdf', base: 'eliminar-documento-capacitacion' });
      const resAdjuntar = await adjuntos.adjuntar(archivo.ruta);
      assert.ok(
        resAdjuntar.exito && !resAdjuntar.invalido,
        `${CASO}: no se pudo adjuntar un documento previo a "${nombreCap}" para poder eliminarlo (notify: "${resAdjuntar.notify}").`
      );
      const base = archivo.nombre.replace(/\.[^.]+$/, '');
      filasDoc = await adjuntos.esperarAdjunto(base);
      nombreDoc = base;
    } else {
      nombreDoc = filasDoc[0].split(' ')[0]; // nombre de archivo = primer token de la fila (ver leerAdjuntos)
    }
    logger.info(`${CASO}: eliminando el documento "${nombreDoc}" de "${nombreCap}" (de ${filasDoc.length} documento(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos ANTES de eliminar - "${nombreCap}"` });

    const res = await adjuntos.eliminar(nombreDoc);
    logger.info(`${CASO}: resultado de eliminar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Aceptar" en eliminar documento - "${nombreCap}"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) el documento "${nombreDoc}" para eliminar.`);
    assert.ok(res.popupApareció, `No apareció el popup de confirmación al eliminar el documento "${nombreDoc}".`);
    assert.ok(
      res.popupCerrado,
      `El popup de confirmación no cerró tras "Aceptar" al eliminar el documento "${nombreDoc}". Notify: "${res.notify}".`
    );
    assert.ok(
      /exitos/i.test(res.notify),
      `Se esperaba un notify de éxito al eliminar el documento "${nombreDoc}" (quedó "${res.notify}").`
    );

    // Verificación de persistencia: RECARGA (F5) la MISMA pantalla de
    // adjuntos (el grid in-place no se refresca solo tras eliminar — ver
    // docblock de `eliminar()`). No se vuelve a `abrirAdjuntarCapacitacion`
    // desde el grid de Capacitación: el navegador sigue en
    // `.capacitaciones-docs-page` (pantalla propia, navegada por URL), no en
    // el listado — reintentar el click del ícono de clip ahí fallaría
    // ("el grid de Capacitación no se pudo leer").
    await ctx.driver.navigate().refresh();
    await adjuntos.estaCargado();
    const filasTras = await adjuntos.leerAdjuntos();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos DESPUÉS de eliminar (recargado) - "${nombreCap}"` });
    const siguePresente = filasTras.some((f) => f.toLowerCase().includes(nombreDoc.toLowerCase()));
    assert.ok(
      !siguePresente,
      `El documento "${nombreDoc}" sigue apareciendo tras eliminarlo y reabrir la pantalla. Documentos: ${JSON.stringify(filasTras)}.`
    );
    logger.info(`${CASO}: verificado (pantalla recargada) -> "${nombreDoc}" ya no aparece`);
  });
});
