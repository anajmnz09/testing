const assert = require('assert');
const { testContext, evidence, testFiles, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'adjuntar-otro-documento';
const CLAVE_EMPLEADO = 'Nombre del Empleado con Documentos de Otros Documentos';
// `archivo`: ruta opcional a un archivo propio; vacío -> PDF genérico del framework (el uploader solo acepta .pdf/.docx/.doc/.png/.jpg/.jpeg).
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, 'archivo']);

/**
 * Adjunta un documento en la sección "Otros Documentos" (Documentos) del detalle de un Empleado: "Adjuntar" abre el popup "Importar
 * Documentos", se carga el archivo, "Guardar", y se verifica que el grid de la sección lo lista. Mismas acciones y componentes que las
 * otras secciones de Documentos (Análisis médicos, Contratos, Otros Documentos, Cartas) y que `adjuntar-capacitacion`.
 *
 * AUTOMÁTICO por defecto: primer empleado del listado; el Panel puede dirigir el empleado. Archivo: el del Panel (`archivo`) o un PDF
 * genérico.
 */
describe('Empleados - Adjuntar Otro Documento', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: adjunta un documento en "Otros Documentos" y confirma la carga`, async function () {
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

    const adjuntos = await detalle.abrirOtrosDocumentos(); // Documentos > Otros Documentos
    assertTextoIgual(await adjuntos.tituloSeccion(), 'Otros Documentos', `El título de la sección no es "Otros Documentos" (empleado: "${nombreEmpleado}").`);

    const archivo = testFiles.resolver({ ruta: testContext.get(CASO, 'archivo'), tipo: 'pdf', base: 'otro-documento-adjunto' });
    logger.info(`${CASO}: archivo -> ${archivo.nombre} (por defecto=${archivo.porDefecto})`);

    const res = await adjuntos.adjuntar(archivo.ruta);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Adjunto en "Otros Documentos" - ${archivo.nombre}` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba adjuntado exitoso de "${archivo.nombre}" en "Otros Documentos" (empleado "${nombreEmpleado}", popup cerrado=${res.cerrado}, notify="${res.notify}").`
    );

    // El grid lista el archivo con un sufijo UUID (`<base>_<uuid>`): se busca por el nombre SIN extensión.
    const base = archivo.nombre.replace(/\.[^.]+$/, '');
    const listado = await adjuntos.esperarAdjunto(base);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Listado de documentos - "Otros Documentos"` });
    assert.ok(
      listado.some((f) => f.toLowerCase().includes(base.toLowerCase())),
      `El adjunto "${archivo.nombre}" no aparece en el grid de "Otros Documentos" tras Guardar. Filas: ${JSON.stringify(listado)}.`
    );
    logger.info(`${CASO}: verificado -> "${archivo.nombre}" adjunto en "Otros Documentos" de "${nombreEmpleado}"`);
  });
});
