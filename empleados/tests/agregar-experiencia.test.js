const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const datos = require('@triple/core/utils/datos');

const CASO = 'agregar-experiencia';
const CLAVE_BUSQUEDA = 'Nombre de Empleado que recibe la Experiencia';
testContext.registrarCaso(CASO, [CLAVE_BUSQUEDA, 'Puesto', 'Lugar', 'Fecha de inicio', 'Fecha finalización', 'Descripción']);

/**
 * Agrega una entrada de "Experiencia" en la sección "Resumen/CV" del
 * detalle de un Empleado ya existente (Tipo FIJO = "Experiencia" — para
 * "Educación" ver `agregar-educacion.test.js`, mismo mini-form con Tipo
 * distinto; ver `EmpleadoDetallePage.agregarEducacionOExperiencia`).
 *
 * Sin notify tras Guardar: la verificación relee el texto del bloque
 * "Educación y experiencia" y confirma que los valores agregados aparecen.
 */
describe('Empleados - Agregar Experiencia (Resumen/CV)', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: agrega una entrada de Experiencia al Resumen/CV de un Empleado existente`, async function () {
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

    const abierta = await detalle.abrirSeccion('Resumen/CV');
    assert.ok(abierta.activada, `No se pudo activar la sección "Resumen/CV" para "${nombreUsado}".`);

    const puesto = datos.valor(testContext.get(CASO, 'Puesto'), { fuente: 'experiencia.puesto', unico: true });
    const lugar = datos.valor(testContext.get(CASO, 'Lugar'), 'experiencia.lugar');
    const fechaInicio = testContext.get(CASO, 'Fecha de inicio') || '01/01/2020';
    const fechaFin = testContext.get(CASO, 'Fecha finalización');
    const descripcion = testContext.get(CASO, 'Descripción');

    logger.info(`${CASO}: agregando Experiencia "${puesto}" en "${lugar}" a "${nombreUsado}"`);
    const guardado = await detalle.agregarEducacionOExperiencia('Experiencia', {
      nombreOPuesto: puesto,
      lugar,
      fechaInicio,
      fechaFin,
      descripcion,
    });
    assert.ok(guardado.exito, `Se esperaba guardado exitoso de Experiencia para "${nombreUsado}". Notify: "${guardado.notify}"`);

    const textoBloque = await detalle.esperarEducacionExperienciaContiene(puesto);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Experiencia agregada - "${nombreUsado}"` });

    assert.ok(
      textoBloque.includes(puesto),
      `No se encontró "${puesto}" en el bloque "Educación y experiencia" tras guardar (bloque: "${textoBloque}").`
    );
    assert.ok(
      textoBloque.includes(lugar),
      `No se encontró "${lugar}" en el bloque "Educación y experiencia" tras guardar (bloque: "${textoBloque}").`
    );
    logger.info(`${CASO}: verificado -> "${puesto}" / "${lugar}" aparecen en "Educación y experiencia"`);
  });
});
