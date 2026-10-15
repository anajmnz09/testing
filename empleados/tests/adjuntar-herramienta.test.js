const assert = require('assert');
const { testContext, evidence, testFiles } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const { elegirHerramienta, verificarTituloHerramienta } = require('../support/herramientas');

const CASO = 'adjuntar-herramienta';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Herramienta';
const CLAVE_HERRAMIENTA = 'Descripción de la Herramienta a la que se adjunta (opcional)';
// `archivo`: ruta opcional a un archivo propio; vacío -> PDF genérico del framework (el uploader solo acepta .pdf/.docx/.doc/.png/.jpg/.jpeg).
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_HERRAMIENTA, 'archivo']);

/**
 * Adjunta un documento a una Herramienta de un Empleado. En la columna "Opciones" del grid de Herramientas, el botón de 3 puntos
 * verticales abre un dropdown ("Retornar" abre un popup con un mini form; "Adjuntar" NAVEGA a una pantalla propia titulada con la
 * descripción de la herramienta, con "Adjuntar" y "Eliminar"). Mismo funcionamiento que `adjuntar-capacitacion`.
 *
 * AUTOMÁTICO por defecto: primer empleado del listado y primera herramienta de ese empleado; el Panel puede dirigir el empleado, la
 * herramienta (por descripción) o ambos. Sin herramientas el test FALLA (precondición no cumplida). Archivo: el del Panel (`archivo`)
 * o un PDF genérico.
 */
describe('Empleados - Adjuntar documento a Herramienta', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: adjunta un documento a una Herramienta y confirma la carga`, async function () {
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
      accion: 'adjuntar',
    });
    const adjuntos = await detalle.abrirAdjuntarHerramienta(herramientaDirigida || objetivo); // Opciones (3 puntos) > Adjuntar
    await verificarTituloHerramienta(adjuntos, nombreHerramienta);

    const archivo = testFiles.resolver({ ruta: testContext.get(CASO, 'archivo'), tipo: 'pdf', base: 'herramienta-adjunto' });
    logger.info(`${CASO}: archivo -> ${archivo.nombre} (por defecto=${archivo.porDefecto})`);

    const res = await adjuntos.adjuntar(archivo.ruta);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Adjunto en Herramienta "${nombreHerramienta}" - ${archivo.nombre}` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba adjuntado exitoso de "${archivo.nombre}" en la Herramienta "${nombreHerramienta}" ` +
        `(empleado "${nombreEmpleado}", popup cerrado=${res.cerrado}, notify="${res.notify}").`
    );

    // El grid lista el archivo con un sufijo UUID (`<base>_<uuid>`): se busca por el nombre SIN extensión.
    const base = archivo.nombre.replace(/\.[^.]+$/, '');
    const listado = await adjuntos.esperarAdjunto(base);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Listado de adjuntos - "${nombreHerramienta}"` });
    assert.ok(
      listado.some((f) => f.toLowerCase().includes(base.toLowerCase())),
      `El adjunto "${archivo.nombre}" no aparece en el grid de la Herramienta "${nombreHerramienta}" tras Guardar. Filas: ${JSON.stringify(listado)}.`
    );
    logger.info(`${CASO}: verificado -> "${archivo.nombre}" adjunto a "${nombreHerramienta}"`);
  });
});
