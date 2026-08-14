const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const BancoDetallePage = require('../pages/BancoDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-banco';
// Clave de BÚSQUEDA (identifica el banco EXISTENTE a abrir), separada a
// propósito de "Nombre" (campo del formulario, real y editable — mismo
// criterio que `editar-departamento`/`editar-beneficio`).
const CLAVE_BUSQUEDA = 'Nombre de Banco a editar';
testContext.registrarCasoDesdeFormulario(CASO, BancoDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

// Default QA solo para el campo que SIEMPRE se cambia si el Panel no dirige
// nada (texto libre opcional, sin efectos colaterales de identidad/negocio
// — no se toca "Nombre"/"País" por defecto, mismo criterio que
// Sucursales/Horarios).
const DEFAULTS_QA = {
  Referencia: 'REF BANCO QA',
};

/**
 * Edita un Banco ya existente: consulta antes de editar (evidencia), entra
 * a "Editar", cambia los campos que el Panel dirija (o, si no dirige
 * ninguno, "Referencia"), Guarda, y vuelve a consultar para confirmar el
 * cambio (evidencia después).
 */
describe('Configuración - Editar Banco', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBancos();

  it(`${CASO}: edita un Banco existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Bancos está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: banco elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +
    // los defaults QA para lo que no se dirigió.
    const cambios = {};
    for (const label of Object.keys(BancoDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      } else if (DEFAULTS_QA[label] !== undefined) {
        cambios[label] = DEFAULTS_QA[label];
      }
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
