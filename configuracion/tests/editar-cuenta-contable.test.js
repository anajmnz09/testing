const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const CuentaContableDetallePage = require('../pages/CuentaContableDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');

const CASO = 'editar-cuenta-contable';
// Clave de BÚSQUEDA (identifica la cuenta contable EXISTENTE a abrir),
// separada a propósito de "No. cuenta" (campo del formulario, real y
// editable — mismo criterio que `editar-departamento`/`editar-beneficio`).
// El buscador rápido del listado SOLO indexa "Descripción" (ver
// `consultar-cuenta-contable`/`CuentaContableDetallePage`) — mismo efecto
// práctico que un buscador roto. Sin nombre dirigido, cae automáticamente a
// la PRIMERA Cuenta Contable del listado (`abrirPrimero()`, sin buscador).
const CLAVE_BUSQUEDA = 'No. de Cuenta Contable a editar';
testContext.registrarCasoDesdeFormulario(CASO, CuentaContableDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita una Cuenta Contable ya existente: consulta antes de editar
 * (evidencia), entra a "Editar", cambia los campos que el Panel dirija (o,
 * si no dirige ninguno, "Descripción"), Guarda, y vuelve a consultar para
 * confirmar el cambio (evidencia después).
 *
 * BUG DE APP conocido (ver `CuentaContableDetallePage`): Guardar tras Editar
 * falla SIEMPRE con "Ya existe un fila con este campo", reproducido en 2
 * registros distintos con datos garantizado únicos — no es un bug de este
 * test. Se espera que este caso siga FALLANDO hasta que se corrija del lado
 * de la app.
 */
describe('Configuración - Editar Cuenta Contable', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoCuentasContables();

  it(`${CASO}: edita una Cuenta Contable existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Cuentas Contables está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['No. Cuenta Contable'];
      logger.info(`${CASO}: cuenta contable elegida (primera fila, sin buscador) -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA, un default seguro (renombrar "Descripción" con
    // `siguienteNombreQA` — "Descripción" tiene restricción de UNICIDAD en la
    // app, confirmado con evidencia real: reusar un valor fijo entre corridas
    // sucesivas sobre el mismo registro revienta con "Ya existe una fila con
    // este campo"; "QA-1", "QA-2"… nunca choca, mismo criterio que el resto
    // de los `editar-*` que renombran su propio campo identificador).
    const cambios = {};
    for (const label of Object.keys(CuentaContableDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) {
        cambios[label] = dirigido;
      }
    }
    // Chequeo a nivel de CASO, no de campo: el default de "Descripción" solo
    // aplica si el Panel no dirigió NADA (ni un solo campo) — si dirigió
    // cualquier otro campo, "Descripción" vacío significa "no tocar".
    if (!Object.keys(cambios).length) {
      cambios['Descripción'] = siguienteNombreQA(await detalle.getValor('Descripción'));
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
