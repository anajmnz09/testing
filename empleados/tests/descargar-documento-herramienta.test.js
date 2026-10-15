const assert = require('assert');
const { testContext, evidence, testFiles } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const { elegirHerramienta, verificarTituloHerramienta } = require('../support/herramientas');

const CASO = 'descargar-documento-herramienta';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Herramienta';
const CLAVE_HERRAMIENTA = 'Descripción de la Herramienta con el documento (opcional)';
const CLAVE_DOCUMENTO = 'Nombre del Documento a descargar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_HERRAMIENTA, CLAVE_DOCUMENTO]);

/**
 * Descarga un documento adjunto de una Herramienta: Opciones > Adjuntar abre su pantalla de adjuntos y se clickea el ícono de descarga
 * de la ÚLTIMA columna del grid (ver `DocumentosAdjuntosPage.descargar`). Mismo funcionamiento que `descargar-documento-capacitacion`.
 *
 * AUTOMÁTICO por defecto: primer empleado, primera herramienta y primer documento. El Panel puede dirigir cualquiera de los tres. Si la
 * herramienta no tiene ningún documento (ni el dirigido, ni ninguno), el test ADJUNTA uno primero (PDF genérico) para no depender de
 * otro test. El éxito exige que la app NO muestre ningún notify tras clickear la descarga.
 */
describe('Empleados - Descargar Documento de Herramienta', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: descarga un documento adjunto sin error`, async function () {
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
      accion: 'descargarle un documento',
    });
    const adjuntos = await detalle.abrirAdjuntarHerramienta(herramientaDirigida || objetivo); // Opciones (3 puntos) > Adjuntar
    await verificarTituloHerramienta(adjuntos, nombreHerramienta);

    let filasDoc = await adjuntos.leerAdjuntos();
    let nombreDoc = documentoDirigido;
    if (documentoDirigido) {
      if (!filasDoc.some((f) => f.toLowerCase().includes(documentoDirigido.toLowerCase()))) {
        assert.fail(`${CASO}: la Herramienta "${nombreHerramienta}" no tiene un documento que contenga "${documentoDirigido}". Documentos: ${JSON.stringify(filasDoc)}.`);
      }
    } else if (!filasDoc.length) {
      logger.info(`${CASO}: "${nombreHerramienta}" no tiene documentos adjuntos — subiendo uno para poder descargarlo`);
      const archivo = testFiles.resolver({ tipo: 'pdf', base: 'descargar-documento-herramienta' });
      const resAdjuntar = await adjuntos.adjuntar(archivo.ruta);
      assert.ok(
        resAdjuntar.exito && !resAdjuntar.invalido,
        `${CASO}: no se pudo adjuntar un documento previo a "${nombreHerramienta}" para poder descargarlo (notify: "${resAdjuntar.notify}").`
      );
      nombreDoc = archivo.nombre.replace(/\.[^.]+$/, '');
      filasDoc = await adjuntos.esperarAdjunto(nombreDoc);
    } else {
      nombreDoc = null; // el primero del grid
    }
    logger.info(`${CASO}: descargando ${nombreDoc ? `el documento "${nombreDoc}"` : 'el primer documento'} de "${nombreHerramienta}"`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos ANTES de descargar - "${nombreHerramienta}"` });

    const res = await adjuntos.descargar(nombreDoc || undefined);
    logger.info(`${CASO}: resultado de descargar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras click en descargar - "${nombreHerramienta}"` });

    assert.ok(res.encontrado, `No se encontró/clickeó el ícono de descarga del documento ${nombreDoc ? `"${nombreDoc}"` : '(primero)'}.`);
    assert.strictEqual(res.notify, '', `Se esperaba descargar sin ningún notify de error (quedó "${res.notify}").`);
    logger.info(`${CASO}: verificado -> descarga sin notify de error`);
  });
});
