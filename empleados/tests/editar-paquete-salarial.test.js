const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const EmpleadoFormPage = require('../pages/EmpleadoFormPage');
const { siguienteNumeroQA, armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-paquete-salarial';
const CLAVE_BUSQUEDA = 'Nombre de Empleado a editar';
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_RH_PAQUETE_SALARIAL, [CLAVE_BUSQUEDA]);

/**
 * Edita SOLO la sección "Paquete salarial" de un Empleado ya existente —
 * mismo patrón que `editar-datos-basicos.test.js` (por sección: `abrirSeccion`
 * en modo consulta y desde ahí "Editar", nunca navegación dentro del modo
 * Editar). Default QA: "Monto tope de comisión" con `siguienteNumeroQA`.
 */
describe('Empleados - Editar Paquete salarial', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: edita la sección "Paquete salarial" de un Empleado existente`, async function () {
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

    const abierta = await detalle.abrirSeccion('Paquete salarial');
    assert.ok(abierta.activada, `No se pudo activar la sección "Paquete salarial" para "${nombreUsado}".`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Paquete salarial ANTES de editar - "${nombreUsado}"` });

    const form = await detalle.editar();

    const cambios = armarCambiosDirigidos(CASO, EmpleadoFormPage.ESTRATEGIAS_RH_PAQUETE_SALARIAL, {
      excluir: [CLAVE_BUSQUEDA],
    });
    await aplicarDefaultSiVacio(cambios, {
      defaults: [
        {
          campo: 'Monto tope de comisión',
          valor: async () => siguienteNumeroQA(await form.form.getValor('Monto tope de comisión')),
        },
      ],
    });

    logger.info(`${CASO}: editando "${nombreUsado}" -> ${JSON.stringify(cambios)}`);
    const aplicados = await form.aplicarCambios(EmpleadoFormPage.ESTRATEGIAS_RH_PAQUETE_SALARIAL, cambios);

    const guardado = await form.guardar();
    const res = await form.resultadoGuardado(guardado);
    assert.ok(res.exito, `Se esperaba edición exitosa de "Paquete salarial" para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Verificación DESPUÉS de editar (evidencia + confirmación real) ---
    //
    // "Paquete salarial" en CONSULTA (recién guardado) NO reutiliza el mismo
    // dxForm de edición para los checkbox ("Indicador Nomina"/"Indicador
    // Comision"): confirmado con Selenium real (2026-09-04) que la vista de
    // solo-lectura de esta sección los renderiza con un componente propio de
    // la app (`.paquete-salarial-item`, no `.dx-field-item`), con OTRO texto
    // de label ("Indicador de nómina:"/"Indicador de comisiones:", no los
    // labels reales del formulario) y sin el atributo `name` en su `<input
    // type="hidden">` — no es un problema de timing/re-render (se confirmó
    // polleando 20 veces cada 1.5s sin que el campo declarado apareciera
    // nunca así). Por eso NO se verifica contra la vista de consulta: se
    // reabre la sección en modo Editar (el mismo dxForm ya validado arriba
    // por `validarControlesDeclarados`, con los labels reales) y se lee ahí.
    const abiertaVerificacion = await detalle.abrirSeccion('Paquete salarial');
    assert.ok(abiertaVerificacion.activada, `No se pudo reabrir "Paquete salarial" para verificar tras Guardar ("${nombreUsado}").`);
    const formVerificacion = await detalle.editar();
    const finales = {};
    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      finales[label] = await formVerificacion.form.esperarValor(label, valorEsperado);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Paquete salarial DESPUÉS de editar - "${nombreUsado}"` });

    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      assertTextoIgual(finales[label], valorEsperado, `"${label}" no quedó en "${valorEsperado}" (quedó "${finales[label]}").`);
    }
    logger.info(`${CASO}: verificado -> ${JSON.stringify(finales)}`);
  });
});
