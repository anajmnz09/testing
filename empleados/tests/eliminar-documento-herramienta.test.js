const assert = require('assert');
const { testContext, evidence, testFiles } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const { elegirHerramienta, verificarTituloHerramienta } = require('../support/herramientas');

const CASO = 'eliminar-documento-herramienta';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Herramienta';
const CLAVE_HERRAMIENTA = 'Descripción de la Herramienta con el documento (opcional)';
const CLAVE_DOCUMENTO = 'Nombre del Documento a eliminar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_HERRAMIENTA, CLAVE_DOCUMENTO]);

/**
 * Elimina un documento adjunto de una Herramienta: Opciones > Adjuntar abre su pantalla de adjuntos, se marca el checkbox del
 * documento, se clickea "Eliminar" y se confirma el popup con "Aceptar" (ver `DocumentosAdjuntosPage.eliminar`). Mismo funcionamiento
 * que `eliminar-documento-capacitacion`.
 *
 * AUTOMÁTICO por defecto: primer empleado y primera herramienta; el Panel puede dirigir empleado, herramienta y documento. Sin documento
 * dirigido, el test ADJUNTA uno propio (PDF genérico) y elimina ESE: así nunca borra por sorpresa un documento que ya tenía la herramienta.
 *
 * La eliminación funciona en el backend pero el grid en pantalla no se refresca solo: la persistencia se verifica RECARGANDO (F5) la
 * pantalla de adjuntos.
 */
describe('Empleados - Eliminar Documento de Herramienta', function () {
  this.timeout(300000);
  // No idempotente (elimina un registro real): un reintento buscaría un documento que ya no debería existir.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: elimina un documento adjunto y confirma que ya no aparece (recargando la pantalla)`, async function () {
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

    // La clave de la herramienta llega INLINE al localizador (`herramientaDirigida || objetivo`): así el escáner de flujos demuestra que
    // el test CONSUME una herramienta (`requires herramienta`), no solo un empleado.
    const herramientaDirigida = testContext.get(CASO, CLAVE_HERRAMIENTA);
    const { nombreHerramienta, objetivo } = await elegirHerramienta(detalle, nombreEmpleado, CASO, {
      herramienta: herramientaDirigida,
      accion: 'eliminarle un documento',
    });
    const adjuntos = await detalle.abrirAdjuntarHerramienta(herramientaDirigida || objetivo); // Opciones (3 puntos) > Adjuntar
    await verificarTituloHerramienta(adjuntos, nombreHerramienta);

    let filasDoc = await adjuntos.leerAdjuntos();
    let nombreDoc = documentoDirigido;
    if (documentoDirigido) {
      if (!filasDoc.some((f) => f.toLowerCase().includes(documentoDirigido.toLowerCase()))) {
        assert.fail(`${CASO}: la Herramienta "${nombreHerramienta}" no tiene un documento que contenga "${documentoDirigido}". Documentos: ${JSON.stringify(filasDoc)}.`);
      }
    } else {
      logger.info(`${CASO}: subiendo un documento propio a "${nombreHerramienta}" para eliminarlo (no se toca ninguno ya existente)`);
      const archivo = testFiles.resolver({ tipo: 'pdf', base: 'eliminar-documento-herramienta' });
      const resAdjuntar = await adjuntos.adjuntar(archivo.ruta);
      assert.ok(
        resAdjuntar.exito && !resAdjuntar.invalido,
        `${CASO}: no se pudo adjuntar un documento previo a "${nombreHerramienta}" para poder eliminarlo (notify: "${resAdjuntar.notify}").`
      );
      nombreDoc = archivo.nombre.replace(/\.[^.]+$/, '');
      filasDoc = await adjuntos.esperarAdjunto(nombreDoc);
    }
    logger.info(`${CASO}: eliminando el documento "${nombreDoc}" de "${nombreHerramienta}" (de ${filasDoc.length} documento(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos ANTES de eliminar - "${nombreHerramienta}"` });

    const res = await adjuntos.eliminar(nombreDoc);
    logger.info(`${CASO}: resultado de eliminar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Aceptar" en eliminar documento - "${nombreHerramienta}"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) el documento "${nombreDoc}" para eliminar.`);
    assert.ok(res.popupApareció, `No apareció el popup de confirmación al eliminar el documento "${nombreDoc}".`);
    assert.ok(res.popupCerrado, `El popup de confirmación no cerró tras "Aceptar" al eliminar "${nombreDoc}". Notify: "${res.notify}".`);
    assert.ok(/exitos/i.test(res.notify), `Se esperaba un notify de éxito al eliminar el documento "${nombreDoc}" (quedó "${res.notify}").`);

    // Persistencia: se recarga la MISMA pantalla de adjuntos (el grid in-place no se refresca solo).
    await ctx.driver.navigate().refresh();
    await adjuntos.estaCargado();
    const filasTras = await adjuntos.leerAdjuntos();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos DESPUÉS de eliminar (recargado) - "${nombreHerramienta}"` });
    assert.ok(
      !filasTras.some((f) => f.toLowerCase().includes(nombreDoc.toLowerCase())),
      `El documento "${nombreDoc}" sigue apareciendo tras eliminarlo y recargar la pantalla. Documentos: ${JSON.stringify(filasTras)}.`
    );
    logger.info(`${CASO}: verificado (pantalla recargada) -> "${nombreDoc}" ya no aparece`);
  });
});
