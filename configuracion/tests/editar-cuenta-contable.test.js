const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const CuentaContableDetallePage = require('../pages/CuentaContableDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

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
  // Reintento GLOBAL (mocha --retries, TEST_RETRIES) desactivado a propósito
  // acá: este caso busca el registro por nombre Y le cambia ESE MISMO nombre —
  // no es idempotente. Si el intento 1 ya renombró el registro pero terminó
  // en falla por otro motivo (verificación lenta, timeout puntual), un
  // reintento automático buscaría el nombre VIEJO, que ya no existe, y
  // fallaría garantizado — confirmado con evidencia real (2026-08-27,
  // editar-usuario): el intento 1 renombró "QA Usuario 911669" -> "fulano
  // de tal" con éxito pero terminó "desconocido" por un timeout de
  // verificación; el reintento buscó "QA Usuario 911669" de nuevo, nunca lo
  // encontró, y voló el estado del navegador. Mejor un fallo fuerte y claro
  // una sola vez que un segundo intento condenado.
  this.retries(0);
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
    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA (ver `cambiosEditar.js`), un default seguro
    // (renombrar "Descripción" a partir de su valor ACTUAL, no de
    // `nombreUsado` — acá el criterio de búsqueda es "No. Cuenta Contable",
    // un campo DISTINTO al que se renombra).
    const cambios = armarCambiosDirigidos(CASO, CuentaContableDetallePage.ESTRATEGIAS);
    await aplicarDefaultSiVacio(cambios, {
      defaults: [{ campo: 'Descripción', valor: async () => siguienteNombreQA(await detalle.getValor('Descripción')) }],
    });
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
