const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const PlanDeSeguroDetallePage = require('../pages/PlanDeSeguroDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-plan-de-seguro';
// Clave de BÚSQUEDA (identifica el plan de seguro EXISTENTE a abrir),
// separada a propósito de "Nombre Plan de seguro" (campo del formulario,
// real y editable — mismo criterio que `editar-departamento`/`editar-beneficio`).
// El buscador de esta pantalla es INESTABLE en el ambiente actual
// (confirmado con evidencia real: "Error cargando registro(s)" en rojo,
// reproducido 2/2 veces) — el código queda LISTO para buscar apenas lo
// arreglen; mientras tanto, sin nombre dirigido, cae automáticamente al
// PRIMER Plan de seguro del listado (`abrirPrimero()`, sin pasar por el
// buscador) — mismo criterio ya aplicado en Horarios/Grados Académicos.
const CLAVE_BUSQUEDA = 'Nombre de Plan de seguro a editar';
testContext.registrarCasoDesdeFormulario(CASO, PlanDeSeguroDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Plan de seguro ya existente: consulta antes de editar (evidencia),
 * entra a "Editar", cambia los campos que el Panel dirija, Guarda, y vuelve a
 * consultar para confirmar el cambio (evidencia después).
 *
 * Igual que Departamentos/Beneficios: solo "Nombre Plan de seguro" es un
 * texto libre seguro como default automático — el resto son selectbox/
 * numberbox sin un valor QA "seguro" inventable. Por eso, si el Panel no
 * dirige NINGÚN campo, el default automático es renombrar "Nombre Plan de
 * seguro" (con un sufijo único, mismo criterio que `crear-plan-de-seguro`);
 * cualquier otro campo declarado se suma al cambio SOLO si el Panel lo
 * dirige explícitamente.
 */
describe('Configuración - Editar Plan de seguro', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoPlanesDeSeguros();

  it(`${CASO}: edita un Plan de seguro existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Planes de seguros está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: plan de seguro elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA, un default seguro (renombrar "Nombre Plan de seguro").
    const cambios = {};
    for (const label of Object.keys(PlanDeSeguroDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }
    if (!Object.keys(cambios).length) {
      cambios['Nombre Plan de seguro'] = `${nombreUsado} EDITADO ${Date.now().toString().slice(-6)}`;
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
