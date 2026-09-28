const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const EmpleadoFormPage = require('../pages/EmpleadoFormPage');
const { siguienteNombreQA, armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-datos-personales';
const CLAVE_BUSQUEDA = 'Nombre de Empleado a editar';
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_DATOS_PERSONALES, [CLAVE_BUSQUEDA]);

/**
 * Edita SOLO la sección "Datos personales" de un Empleado ya existente.
 *
 * A diferencia de Crear (un solo form navegable entre secciones), Editar es
 * POR SECCIÓN: hay que estar parado en la sección deseada EN MODO CONSULTA
 * (`abrirSeccion`) y desde ahí entrar a "Editar" — confirmado con Selenium
 * real que "Editar" activa el modo edición de la sección actualmente
 * mostrada, no siempre "Datos básicos". Navegar DENTRO del modo Editar hacia
 * otra sección del sidemenu saca del modo edición (confirmado real, con o
 * sin el popup "¿Desea cambiar la página?" de por medio).
 *
 * Cascada propia de esta sección: "País" (Dirección) habilita "Ciudad",
 * que habilita "Sector", que habilita "Calle" — si se dirige "País", se
 * fuerza también el resto de la cascada (aunque no se dirijan) para que
 * quede consistente.
 */
describe('Empleados - Editar Datos personales', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: edita la sección "Datos personales" de un Empleado existente`, async function () {
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

    const abierta = await detalle.abrirSeccion('Datos personales');
    assert.ok(abierta.activada, `No se pudo activar la sección "Datos personales" para "${nombreUsado}".`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Datos personales ANTES de editar - "${nombreUsado}"` });

    const form = await detalle.editar();

    const cambios = armarCambiosDirigidos(CASO, EmpleadoFormPage.ESTRATEGIAS_DATOS_PERSONALES, {
      excluir: [CLAVE_BUSQUEDA],
    });
    await aplicarDefaultSiVacio(cambios, {
      defaults: [
        {
          campo: 'Condición médica',
          valor: async () => siguienteNombreQA(await form.form.getValor('Condición médica')),
        },
      ],
    });

    const aplicados = {};
    if (cambios['País'] !== undefined) {
      const pais = cambios['País'];
      const ciudad = cambios['Ciudad'];
      const sector = cambios['Sector'];
      const calle = cambios['Calle'];
      delete cambios['País'];
      delete cambios['Ciudad'];
      delete cambios['Sector'];
      delete cambios['Calle'];
      await form.cascadaDireccion({ pais, ciudad, sector, calle, forzar: true });
      aplicados['País'] = await form.form.getValor('País');
      aplicados['Ciudad'] = await form.form.getValor('Ciudad');
      aplicados['Sector'] = await form.form.getValor('Sector');
      aplicados['Calle'] = await form.form.getValor('Calle');
    }

    logger.info(`${CASO}: editando "${nombreUsado}" -> ${JSON.stringify(cambios)}`);
    Object.assign(aplicados, await form.aplicarCambios(EmpleadoFormPage.ESTRATEGIAS_DATOS_PERSONALES, cambios));

    const guardado = await form.guardar();
    const res = await form.resultadoGuardado(guardado);
    assert.ok(res.exito, `Se esperaba edición exitosa de "Datos personales" para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Verificación DESPUÉS de editar (evidencia + confirmación real) ---
    const finales = {};
    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      finales[label] = await form.form.esperarValor(label, valorEsperado);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Datos personales DESPUÉS de editar - "${nombreUsado}"` });

    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      assertTextoIgual(finales[label], valorEsperado, `"${label}" no quedó en "${valorEsperado}" (quedó "${finales[label]}").`);
    }
    logger.info(`${CASO}: verificado -> ${JSON.stringify(finales)}`);
  });
});
