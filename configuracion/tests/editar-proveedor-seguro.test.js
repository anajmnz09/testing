const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const ProveedorSeguroDetallePage = require('../pages/ProveedorSeguroDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');

const CASO = 'editar-proveedor-seguro';
// Clave de BÚSQUEDA (identifica el proveedor de seguros EXISTENTE a abrir),
// separada a propósito de "Proveedor" (campo del formulario, real y
// editable — mismo criterio que `editar-departamento`/`editar-beneficio`).
// El buscador de esta pantalla está ROTO en el ambiente actual (confirmado
// con evidencia real: "Error cargando registro(s)" en rojo, reproducido 3/3
// veces) — el código queda LISTO para buscar apenas lo arreglen; mientras
// tanto, sin nombre dirigido, cae automáticamente al PRIMER Proveedor de
// seguros del listado (`abrirPrimero()`, sin pasar por el buscador) — mismo
// criterio ya aplicado en Horarios/Grados Académicos.
const CLAVE_BUSQUEDA = 'Proveedor de seguros a editar';
testContext.registrarCasoDesdeFormulario(CASO, ProveedorSeguroDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Proveedor de seguros ya existente: consulta antes de editar
 * (evidencia), entra a "Editar", cambia los campos que el Panel dirija,
 * Guarda, y vuelve a consultar para confirmar el cambio (evidencia
 * después).
 *
 * Solo "Proveedor" es un texto libre seguro como default automático —
 * "Estado" es un selectbox sin un valor QA "seguro" inventable. Por eso, si
 * el Panel no dirige NINGÚN campo, el default automático es renombrar
 * "Proveedor" con `siguienteNombreQA` (`support/nombresQA.js`: "QA-1",
 * "QA-2"… nunca concatena sobre el nombre actual, así no crece sin límite en
 * corridas repetidas sobre el mismo registro).
 */
describe('Configuración - Editar Proveedor de seguros', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoProveedoresDeSeguros();

  it(`${CASO}: edita un Proveedor de seguros existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Proveedores de seguros está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Proveedor'];
      logger.info(`${CASO}: proveedor de seguros elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA, un default seguro (renombrar "Proveedor").
    const cambios = {};
    for (const label of Object.keys(ProveedorSeguroDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }
    if (!Object.keys(cambios).length) {
      cambios['Proveedor'] = siguienteNombreQA(nombreUsado);
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
      assertTextoIgual(
        finales[label],
        cambios[label],
        `"${label}" no quedó en "${cambios[label]}" (quedó "${finales[label]}").`
      );
    }
  });
});
