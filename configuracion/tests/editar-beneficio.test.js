const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const BeneficioDetallePage = require('../pages/BeneficioDetallePage');
const fixtures = require('../support/fixtures');
const { siguienteNombreQA } = require('../support/nombresQA');
const { armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-beneficio';
// Clave de BÚSQUEDA (identifica el beneficio EXISTENTE a abrir), separada a
// propósito de "Beneficio" (que es un campo del formulario, real y editable
// — mismo criterio ya aplicado en `editar-departamento`: si compartieran la
// misma clave del Execution Context no habría forma de dirigir un RENOMBRE).
// El resto de los campos del formulario se siembran desde
// `BeneficioDetallePage.ESTRATEGIAS` (Input Model).
const CLAVE_BUSQUEDA = 'Nombre de Beneficio a editar';
testContext.registrarCasoDesdeFormulario(CASO, BeneficioDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Beneficio ya existente: consulta antes de editar (evidencia),
 * entra a "Editar", cambia los campos que el Panel dirija, Guarda, y vuelve a
 * consultar para confirmar el cambio (evidencia después).
 *
 * Igual que Departamentos: solo "Beneficio" (nombre) es un texto libre
 * seguro como default automático — "Concepto de nómina"/"Estado" son
 * selectbox sin un valor QA "seguro" inventable. Por eso, si el Panel no
 * dirige NINGÚN campo, el default automático es renombrar "Beneficio" con
 * `siguienteNombreQA` (`support/nombresQA.js`: "QA-1", "QA-2"… nunca
 * concatena sobre el nombre actual, así no crece sin límite en corridas
 * repetidas sobre el mismo registro); cualquier otro campo declarado se suma
 * al cambio SOLO si el Panel lo dirige explícitamente.
 */
describe('Configuración - Editar Beneficio', function () {
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
  const ctx = fixtures.usarListadoBeneficios();

  it(`${CASO}: edita un Beneficio existente y confirma el cambio`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Beneficios está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Nombre'];
      logger.info(`${CASO}: beneficio elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = await ctx.lista.abrirDetalle(nombreUsado);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    // Arma los cambios: lo que el Panel dirija (cualquier campo declarado) +,
    // si no se dirigió NADA (ver `cambiosEditar.js`), un default seguro
    // (renombrar "Beneficio").
    const cambios = armarCambiosDirigidos(CASO, BeneficioDetallePage.ESTRATEGIAS);
    await aplicarDefaultSiVacio(cambios, {
      defaults: [{ campo: 'Beneficio', valor: siguienteNombreQA(nombreUsado) }],
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
