const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const HabilidadesPage = require('../pages/HabilidadesPage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-habilidad';
// Clave de BÚSQUEDA (identifica la Habilidad EXISTENTE a abrir), separada a
// propósito de "Habilidad" (que es un campo del formulario, real y editable
// — si compartieran la misma clave del Execution Context no habría forma de
// dirigir un RENOMBRE, mismo criterio que `editar-departamento`/
// `editar-beneficio`). El buscador de esta pantalla está roto en el
// ambiente actual — el código queda LISTO para buscar apenas lo arreglen;
// mientras tanto, sin nombre dirigido, cae automáticamente a la PRIMERA
// Habilidad del listado (`editarPrimero()`/`consultarPrimero()`, sin pasar
// por el buscador).
const CLAVE_BUSQUEDA = 'Habilidad a editar';
testContext.registrarCasoDesdeFormulario(CASO, HabilidadesPage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita el popup de una Habilidad: si el Panel dirige la clave de búsqueda,
 * la busca (`consultarPorNombre`/`editarPorNombre`); si no, usa la PRIMERA
 * del listado. Cambia los campos que el Panel dirija (o, si no dirige
 * ninguno, renombra "Habilidad" con un sufijo único — a diferencia de
 * Grados Académicos, acá no hay otro campo de texto libre seguro como
 * default), Guarda. Como evidencia, adjunta el popup de CONSULTA antes y
 * después del cambio.
 */
describe('Configuración - Editar Habilidad', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoHabilidades();

  it(`${CASO}: edita una Habilidad existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Habilidades está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Habilidad'];
      logger.info(`${CASO}: habilidad elegida (primera fila, sin buscador) -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    if (nombreDirigido) {
      await ctx.lista.consultarPorNombre(nombreDirigido);
    } else {
      await ctx.lista.consultarPrimero();
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });
    const { Key } = require('selenium-webdriver');
    await ctx.driver.actions().sendKeys(Key.ESCAPE).perform();
    await ctx.driver.sleep(500);

    const modal = nombreDirigido
      ? await ctx.lista.editarPorNombre(nombreDirigido)
      : await ctx.lista.editarPrimero();

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA, un default seguro (renombrar "Habilidad").
    const cambios = {};
    for (const label of Object.keys(HabilidadesPage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }
    if (!Object.keys(cambios).length) {
      cambios['Habilidad'] = `${nombreUsado} EDITADO ${Date.now().toString().slice(-6)}`;
    }
    logger.info(`${CASO}: editando -> ${JSON.stringify(cambios)}`);
    for (const [label, valor] of Object.entries(cambios)) {
      await modal.setCampo(label, valor);
    }

    await modal.guardar();
    const res = await modal.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba edición exitosa para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Consulta DESPUÉS de editar (evidencia + verificación) ---
    if (nombreDirigido) {
      await ctx.lista.consultarPorNombre(nombreDirigido);
    } else {
      await ctx.lista.consultarPrimero();
    }
    const finales = {};
    for (const label of Object.keys(cambios)) {
      finales[label] = await ctx.lista.esperarValor(label, cambios[label]);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta DESPUÉS de editar - "${nombreUsado}"` });

    for (const label of Object.keys(cambios)) {
      assert.strictEqual(
        finales[label],
        cambios[label],
        `"${label}" no quedó en "${cambios[label]}" (quedó "${finales[label]}").`
      );
    }
  });
});
