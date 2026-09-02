const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const ComportamientoConceptoNominaDetallePage = require('../pages/ComportamientoConceptoNominaDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'editar-comportamiento-concepto-nomina';
// Clave de BÚSQUEDA (identifica el Comportamiento EXISTENTE a abrir, por su
// "Concepto" — columna real del listado), separada a propósito de
// "Concepto"/"Tipo Nómina" (campos del formulario, reales y editables).
const CLAVE_BUSQUEDA = 'Comportamiento (Concepto) a editar';
testContext.registrarCasoDesdeFormulario(CASO, ComportamientoConceptoNominaDetallePage.ESTRATEGIAS, [CLAVE_BUSQUEDA]);

/**
 * Edita un Comportamiento concepto Nómina ya existente: consulta antes de
 * editar (evidencia), entra a "Editar", cambia los campos que el Panel
 * dirija, Guarda, y vuelve a consultar para confirmar el cambio (evidencia
 * después).
 *
 * A diferencia del resto de entidades de Configuración, ESTA no tiene
 * ningún campo de texto libre "seguro" como default automático: "Concepto"/
 * "Tipo Nómina" son selects que referencian catálogos (cambiarlos sin
 * dirección puntual podría chocar con la restricción de combinación única
 * ya documentada en `crear-comportamiento-concepto-nomina`, o apuntar a
 * data real del ambiente) y "Todos los intervalos"/"Intervalo" no se tocan
 * (ver `ComportamientoConceptoNominaDetallePage`). Por eso, si el Panel NO
 * dirige ningún campo, el caso se da por CUMPLIDO sin editar nada — no
 * inventa un cambio riesgoso solo para tener algo que verificar.
 */
describe('Configuración - Editar Comportamiento Concepto Nómina', function () {
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
  const ctx = fixtures.usarListadoComportamientoConceptoNomina();

  it(`${CASO}: edita un Comportamiento concepto Nómina existente y confirma el cambio`, async function () {
    const cambiosDirigidos = {};
    for (const label of Object.keys(ComportamientoConceptoNominaDetallePage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined) cambiosDirigidos[label] = dirigido;
    }
    if (!Object.keys(cambiosDirigidos).length) {
      logger.info(
        `${CASO}: el Panel no dirigió ningún campo y esta entidad no tiene un default automático seguro (ver comentario del archivo) — se da por cumplido el caso sin editar nada.`
      );
      return;
    }

    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let nombreUsado = nombreDirigido;

    if (!nombreUsado) {
      const filas = await ctx.lista.grid.filasPorColumnas();
      if (!filas.length) {
        logger.info(`${CASO}: el listado de Comportamiento Concepto Nómina está vacío — nada que editar, se termina el test.`);
        return;
      }
      nombreUsado = filas[0]['Concepto'];
      logger.info(`${CASO}: Comportamiento elegido automáticamente -> "${nombreUsado}"`);
    }

    // --- Consulta ANTES de editar (evidencia) ---
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta ANTES de editar - "${nombreUsado}"` });

    const infoEditar = await detalle.editar();
    assert.ok(infoEditar.accionado, `No se pudo entrar en modo edición para "${nombreUsado}" (header: ${JSON.stringify(infoEditar)}).`);

    logger.info(`${CASO}: editando -> ${JSON.stringify(cambiosDirigidos)}`);
    for (const [label, valor] of Object.entries(cambiosDirigidos)) {
      await detalle.setCampo(label, valor);
    }

    await detalle.guardar();
    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba edición exitosa para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Consulta DESPUÉS de editar (evidencia + verificación) ---
    const finales = {};
    for (const label of Object.keys(cambiosDirigidos)) {
      finales[label] = await detalle.esperarValor(label, cambiosDirigidos[label]);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Consulta DESPUÉS de editar - "${nombreUsado}"` });

    for (const label of Object.keys(cambiosDirigidos)) {
      assertTextoIgual(
        finales[label],
        cambiosDirigidos[label],
        `"${label}" no quedó en "${cambiosDirigidos[label]}" (quedó "${finales[label]}").`
      );
    }
  });
});
