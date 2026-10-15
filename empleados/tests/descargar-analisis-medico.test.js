const assert = require('assert');
const { testContext, evidence, testFiles, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'descargar-analisis-medico';
const CLAVE_EMPLEADO = 'Nombre del Empleado con Documentos de Análisis médicos';
const CLAVE_DOCUMENTO = 'Nombre del Documento a descargar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_DOCUMENTO]);

/**
 * Descarga un documento de la sección "Análisis médicos" (Documentos) del detalle de un Empleado: se clickea el ícono de descarga de la
 * ÚLTIMA columna del grid (ver `DocumentosAdjuntosPage.descargar`). Mismo funcionamiento que `descargar-documento-capacitacion`.
 *
 * AUTOMÁTICO por defecto: primer empleado y primer documento. El Panel puede dirigir el empleado y/o el documento. Si la sección no
 * tiene ningún documento, el test ADJUNTA uno primero (PDF genérico) para no depender de otro test. El éxito exige que la app NO
 * muestre ningún notify tras clickear la descarga.
 */
describe('Empleados - Descargar Análisis médico', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: descarga un documento de "Análisis médicos" sin error`, async function () {
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
    } else if (!filasDoc.length) {
      logger.info(`${CASO}: "Análisis médicos" de "${nombreEmpleado}" no tiene documentos — subiendo uno para poder descargarlo`);
      const archivo = testFiles.resolver({ tipo: 'pdf', base: 'descargar-analisis-medico' });
      const resAdjuntar = await adjuntos.adjuntar(archivo.ruta);
      assert.ok(
        resAdjuntar.exito && !resAdjuntar.invalido,
        `${CASO}: no se pudo adjuntar un documento previo en "Análisis médicos" para poder descargarlo (notify: "${resAdjuntar.notify}").`
      );
      nombreDoc = archivo.nombre.replace(/\.[^.]+$/, '');
      filasDoc = await adjuntos.esperarAdjunto(nombreDoc);
    } else {
      nombreDoc = null; // el primero del grid
    }
    logger.info(`${CASO}: descargando ${nombreDoc ? `el documento "${nombreDoc}"` : 'el primer documento'} de "Análisis médicos"`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos ANTES de descargar - "Análisis médicos"` });

    const res = await adjuntos.descargar(nombreDoc || undefined);
    logger.info(`${CASO}: resultado de descargar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras click en descargar - "Análisis médicos"` });

    assert.ok(res.encontrado, `No se encontró/clickeó el ícono de descarga del documento ${nombreDoc ? `"${nombreDoc}"` : '(primero)'}.`);
    assert.strictEqual(res.notify, '', `Se esperaba descargar sin ningún notify de error (quedó "${res.notify}").`);
    logger.info(`${CASO}: verificado -> descarga sin notify de error`);
  });
});
