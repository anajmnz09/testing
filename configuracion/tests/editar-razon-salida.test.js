const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const RazonSalidaDetallePage = require('../pages/RazonSalidaDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-razon-salida';
// Clave de BÚSQUEDA (identifica la razón de salida EXISTENTE a abrir),
// separada a propósito de "Razón" (campo del formulario, real y editable —
// mismo criterio que `editar-departamento`/`editar-beneficio`).
const CLAVE_BUSQUEDA = 'Razón de Salida a editar';
testContext.registrarCasoDesdeFormulario(CASO, RazonSalidaDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita una Razón de Salida ya existente: consulta antes de editar
 * (evidencia), entra a "Editar", cambia los campos que el Panel dirija,
 * Guarda, y vuelve a consultar para confirmar el cambio (evidencia
 * después).
 *
 * Solo "Razón" es un texto libre seguro como default automático — "Estado"
 * es un selectbox sin un valor QA "seguro" inventable. Por eso, si el Panel
 * no dirige NINGÚN campo, el default automático es renombrar "Razón" (con
 * un sufijo único, mismo criterio que `crear-razon-salida`).
 */
describe('Configuración - Editar Razón de Salida', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRazonesDeSalidas();

  it(`${CASO}: edita una Razón de Salida existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Razones de Salidas está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Razón'];
      logger.info(`${CASO}: razón de salida elegida automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA, un default seguro (renombrar "Razón").
    const cambios = {};
    for (const label of Object.keys(RazonSalidaDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }
    if (!Object.keys(cambios).length) {
      cambios['Razón'] = `${nombreUsado} EDITADO ${Date.now().toString().slice(-6)}`;
    }
    logger.info(`${CASO}: editando -> ${JSON.stringify(cambios)}`);
    for (const [label, valor] of Object.entries(cambios)) {
      await detalle.setCampo(label, valor);
    }

    await detalle.guardar();
    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba edición exitosa para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Consulta DESPUÉS de editar (evidencia + verificación) ---
    const finales = {};
    for (const label of Object.keys(cambios)) {
      finales[label] = await detalle.esperarValor(label, cambios[label]);
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
