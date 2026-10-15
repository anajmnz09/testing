const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const datos = require('@triple/core/utils/datos');

const CASO = 'agregar-educacion';
const CLAVE_BUSQUEDA = 'Nombre de Empleado que recibe la Educación';
// No es un formulario respaldado por `Form`/`ESTRATEGIAS` (ver
// `EmpleadoDetallePage` — el mini-form "Nueva educación o experiencia" usa
// `<span>` en vez de `<label>`) — se registra manualmente, mismo criterio
// que "Non-form Tests"/"Repeatable add via popup widgets" del skill.
testContext.registrarCaso(CASO, [
  CLAVE_BUSQUEDA,
  'Nombre programa educativo',
  'Lugar',
  'Fecha de inicio',
  'Fecha finalización',
  'Descripción',
]);

/**
 * Agrega una entrada de "Educación" en la sección "Resumen/CV" del detalle
 * de un Empleado ya existente (Tipo FIJO = "Educación" — para "Experiencia"
 * ver `agregar-experiencia.test.js`, mismo mini-form con Tipo distinto; ver
 * `EmpleadoDetallePage.agregarEducacionOExperiencia`). Se separó en 2 tests
 * en vez de uno con "Tipo" dirigible porque el segundo campo del mini-form
 * cambia de pregunta de negocio según el Tipo ("Nombre programa educativo"
 * vs. "Puesto") — decisión explícita del usuario.
 *
 * Sin notify tras Guardar (mismo criterio que "Crear Empleado"): la
 * verificación relee el texto del bloque "Educación y experiencia" y
 * confirma que los valores agregados aparecen — nunca se asume el guardado
 * por la sola ausencia de error.
 */
describe('Empleados - Agregar Educación (Resumen/CV)', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: agrega una entrada de Educación al Resumen/CV de un Empleado existente`, async function () {
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

    const nombrePrograma = datos.valor(testContext.get(CASO, 'Nombre programa educativo'), { fuente: 'educacion.programa', unico: true });
    const lugar = datos.valor(testContext.get(CASO, 'Lugar'), 'educacion.lugar');
    const fechaInicio = testContext.get(CASO, 'Fecha de inicio') || '01/01/2020';
    const fechaFin = testContext.get(CASO, 'Fecha finalización');
    const descripcion = testContext.get(CASO, 'Descripción');

    logger.info(`${CASO}: agregando Educación "${nombrePrograma}" en "${lugar}" a "${nombreUsado}"`);
    const guardado = await detalle.agregarEducacionOExperiencia('Educación', {
      nombreOPuesto: nombrePrograma,
      lugar,
      fechaInicio,
      fechaFin,
      descripcion,
    });
    assert.ok(guardado.exito, `Se esperaba guardado exitoso de Educación para "${nombreUsado}". Notify: "${guardado.notify}"`);

    const textoBloque = await detalle.esperarEducacionExperienciaContiene(nombrePrograma);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Educación agregada - "${nombreUsado}"` });

    assert.ok(
      textoBloque.includes(nombrePrograma),
      `No se encontró "${nombrePrograma}" en el bloque "Educación y experiencia" tras guardar (bloque: "${textoBloque}").`
    );
    assert.ok(
      textoBloque.includes(lugar),
      `No se encontró "${lugar}" en el bloque "Educación y experiencia" tras guardar (bloque: "${textoBloque}").`
    );
    logger.info(`${CASO}: verificado -> "${nombrePrograma}" / "${lugar}" aparecen en "Educación y experiencia"`);
  });
});
