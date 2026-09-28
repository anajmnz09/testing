const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const EmpleadoFormPage = require('../pages/EmpleadoFormPage');
const { siguienteNumeroQA, armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-datos-basicos-rh';
const CLAVE_BUSQUEDA = 'Nombre de Empleado a editar';
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_RH_DATOS_BASICOS, [CLAVE_BUSQUEDA]);

/**
 * Edita SOLO la sección "Datos básicos RH" de un Empleado ya existente —
 * mismo patrón que `editar-datos-basicos.test.js` (por sección: `abrirSeccion`
 * en modo consulta y desde ahí "Editar", nunca navegación dentro del modo
 * Editar). Esta sección no tiene ningún campo de texto libre (todo es select
 * o numérico), por eso el default QA usa "Saldo a favor ISR" con
 * `siguienteNumeroQA`.
 */
describe('Empleados - Editar Datos básicos RH', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: edita la sección "Datos básicos RH" de un Empleado existente`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
    let detalle;
    let nombreUsado = nombreDirigido;

    if (nombreDirigido) {
      detalle = await ctx.lista.abrirDetalle(nombreDirigido);
    } else {
      const hayFilas = (await ctx.lista.grid.contarFilas()) > 0;
      if (!hayFilas) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — ` +
            `la suite asume que siempre hay al menos un registro. Puede deberse a una compañía ` +
            `nueva sin datos semilla (seed) o a un problema del API/entorno — no se trata como ` +
            `"sin datos, se omite": es una precondición del escenario que no se cumplió.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreUsado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreUsado}"`);
    }

    const abierta = await detalle.abrirSeccion('Datos básicos RH');
    assert.ok(abierta.activada, `No se pudo activar la sección "Datos básicos RH" para "${nombreUsado}".`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Datos básicos RH ANTES de editar - "${nombreUsado}"` });

    const form = await detalle.editar();

    const cambios = armarCambiosDirigidos(CASO, EmpleadoFormPage.ESTRATEGIAS_RH_DATOS_BASICOS, {
      excluir: [CLAVE_BUSQUEDA],
    });
    await aplicarDefaultSiVacio(cambios, {
      defaults: [
        {
          campo: 'Saldo a favor ISR',
          valor: async () => siguienteNumeroQA(await form.form.getValor('Saldo a favor ISR')),
        },
      ],
    });

    logger.info(`${CASO}: editando "${nombreUsado}" -> ${JSON.stringify(cambios)}`);
    const aplicados = await form.aplicarCambios(EmpleadoFormPage.ESTRATEGIAS_RH_DATOS_BASICOS, cambios);

    const guardado = await form.guardar();
    const res = await form.resultadoGuardado(guardado);
    assert.ok(res.exito, `Se esperaba edición exitosa de "Datos básicos RH" para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Verificación DESPUÉS de editar (evidencia + confirmación real) ---
    const finales = {};
    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      finales[label] = await form.form.esperarValor(label, valorEsperado);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Datos básicos RH DESPUÉS de editar - "${nombreUsado}"` });

    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      assertTextoIgual(finales[label], valorEsperado, `"${label}" no quedó en "${valorEsperado}" (quedó "${finales[label]}").`);
    }
    logger.info(`${CASO}: verificado -> ${JSON.stringify(finales)}`);
  });
});
