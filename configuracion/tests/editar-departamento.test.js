const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const DepartamentoDetallePage = require('../pages/DepartamentoDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-departamento';
// Clave de BÚSQUEDA (identifica el departamento EXISTENTE a abrir), separada
// a propósito de "Departamento" (que es un campo del formulario, real y
// editable — mismo criterio ya aplicado en `editar-sucursal`: si compartieran
// la misma clave del Execution Context no habría forma de dirigir un
// RENOMBRE). El resto de los campos del formulario se siembran desde
// `DepartamentoDetallePage.ESTRATEGIAS` (Input Model).
const CLAVE_BUSQUEDA = 'Nombre de Departamento a editar';
testContext.registrarCasoDesdeFormulario(CASO, DepartamentoDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Departamento ya existente: consulta antes de editar (evidencia),
 * entra a "Editar", cambia los campos que el Panel dirija, Guarda, y vuelve a
 * consultar para confirmar el cambio (evidencia después).
 *
 * A diferencia de Sucursales (que tiene varios campos de texto libre
 * seguros como default automático: Correo/Dirección/RNL), Departamentos solo
 * tiene UN campo de texto libre ("Departamento", el nombre) — el resto son
 * selectbox de catálogo (Clasificación 1/2/3, Departamento Padre, Gerente
 * Departamento) sin un valor QA "seguro" inventable. Por eso, si el Panel no
 * dirige NINGÚN campo, el default automático es renombrar "Departamento"
 * (con un sufijo único, mismo criterio que `crear-departamento`); cualquier
 * otro campo declarado se suma al cambio SOLO si el Panel lo dirige
 * explícitamente.
 */
describe('Configuración - Editar Departamento', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoDepartamentos();

  it(`${CASO}: edita un Departamento existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Departamentos está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: departamento elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA, un default seguro (renombrar "Departamento").
    const cambios = {};
    for (const label of Object.keys(DepartamentoDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }
    if (!Object.keys(cambios).length) {
      cambios['Departamento'] = `${nombreUsado} EDITADO ${Date.now().toString().slice(-6)}`;
    }
    logger.info(`${CASO}: editando -> ${JSON.stringify(cambios)}`);
    for (const [label, valor] of Object.entries(cambios)) {
      await detalle.setCampo(label, valor);
    }

    await detalle.guardar();
    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba edición exitosa para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Consulta DESPUÉS de editar (evidencia + verificación) ---
    // Tras Guardar, confirmado con evidencia real: la app RECARGA la
    // pantalla ("Cargando...") antes de mostrar el registro actualizado —
    // se espera (poll) cada valor, no se lee inmediatamente.
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
