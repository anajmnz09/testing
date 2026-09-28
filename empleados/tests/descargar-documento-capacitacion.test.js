const assert = require('assert');
const { testContext, evidence, testFiles } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'descargar-documento-capacitacion';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Capacitación';
const CLAVE_CAPACITACION = 'Nombre de la Capacitación con el documento (opcional)';
const CLAVE_DOCUMENTO = 'Nombre del Documento a descargar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_CAPACITACION, CLAVE_DOCUMENTO]);

/**
 * Descarga un documento adjunto de una Capacitación: entra a la pantalla de
 * adjuntos (ícono de clip "Adjuntar documento" de la columna "Acción") y
 * clickea el ícono de descarga de la ÚLTIMA columna del grid (columna SIN
 * título — confirmado real: header `""`, ícono `.dx-icon-download`) — ver
 * `CapacitacionAdjuntosPage.descargar`.
 *
 * Empleado: dirigido desde el Panel o el PRIMERO del listado. Capacitación:
 * opcionalmente dirigida por nombre; si no, la PRIMERA fila del grid de
 * Capacitación. Si el empleado NO tiene ninguna capacitación -> el test
 * FALLA. Documento: opcionalmente dirigido por nombre; si la capacitación
 * NO tiene ningún documento (ni el dirigido, ni ninguno en modo auto), este
 * test ADJUNTA uno primero (mismo PDF genérico que `adjuntar-capacitacion`)
 * para no depender de que otro test haya corrido antes.
 *
 * BUG/PERMISO CONOCIDO (confirmado con Selenium real, 2026-09-09 — ver
 * `CapacitacionAdjuntosPage.descargar`): el usuario/ambiente actual NO tiene
 * autorización para esta acción — la app responde "Operación Inválida — No
 * estás autorizado para realizar esta acción" en vez de iniciar la
 * descarga. Este test queda codificado con el flujo y la aserción CORRECTA
 * (como si el permiso existiera); SE ESPERA QUE SIGA FALLANDO hasta que se
 * otorgue el permiso — no "arreglar" este test agregando una excepción para
 * el bloqueo de autorización.
 */
describe('Empleados - Descargar Documento de Capacitación', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: descarga un documento adjunto sin error`, async function () {
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
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ninguna Capacitación registrada — no hay a qué descargarle un documento.`
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

    const adjuntos = await detalle.abrirAdjuntarCapacitacion(objetivoCap);
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
      logger.info(`${CASO}: "${nombreCap}" no tiene documentos adjuntos — subiendo uno para poder descargarlo`);
      const archivo = testFiles.resolver({ tipo: 'pdf', base: 'descargar-documento-capacitacion' });
      const resAdjuntar = await adjuntos.adjuntar(archivo.ruta);
      assert.ok(
        resAdjuntar.exito && !resAdjuntar.invalido,
        `${CASO}: no se pudo adjuntar un documento previo a "${nombreCap}" para poder descargarlo (notify: "${resAdjuntar.notify}").`
      );
      const base = archivo.nombre.replace(/\.[^.]+$/, '');
      filasDoc = await adjuntos.esperarAdjunto(base);
      nombreDoc = base;
    } else {
      nombreDoc = filasDoc[0].split(' ')[0]; // nombre de archivo = primer token de la fila (ver leerAdjuntos)
    }
    logger.info(`${CASO}: descargando el documento "${nombreDoc}" de "${nombreCap}"`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Documentos ANTES de descargar - "${nombreCap}"` });

    const res = await adjuntos.descargar(nombreDoc);
    logger.info(`${CASO}: resultado de descargar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras click en descargar - "${nombreCap}"` });

    assert.ok(res.encontrado, `No se encontró/clickeó el ícono de descarga del documento "${nombreDoc}".`);
    assert.strictEqual(
      res.notify,
      '',
      `Se esperaba descargar "${nombreDoc}" sin ningún notify de error (quedó "${res.notify}").`
    );
    logger.info(`${CASO}: verificado -> descarga de "${nombreDoc}" sin notify de error`);
  });
});
