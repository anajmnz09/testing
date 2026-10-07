const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');
const bancos = require('../support/bancos');

const CASO = 'agregar-habilidad';
const CLAVE_BUSQUEDA = 'Nombre de Empleado que recibe la Habilidad';
testContext.registrarCaso(CASO, [CLAVE_BUSQUEDA, 'Tipo', 'Habilidad', 'Nivel']);

/**
 * Agrega una entrada de "Habilidades" en la sección "Resumen/CV" del
 * detalle de un Empleado ya existente (ver `EmpleadoDetallePage.agregarHabilidad`).
 * "Tipo" es un catálogo fijo requerido (ej. "Habilidades técnicas",
 * "Habilidades blandas"...) — si no se dirige, se elige la primera opción
 * disponible (modo automático estándar del framework para selects). "Nivel"
 * (Básico/Medio/Avanzado) es opcional.
 *
 * Sin notify tras Guardar: la verificación relee el texto del bloque
 * "Habilidades" y confirma que los valores agregados aparecen.
 */
describe('Empleados - Agregar Habilidad (Resumen/CV)', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: agrega una Habilidad al Resumen/CV de un Empleado existente`, async function () {
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

    const tipoDirigido = testContext.get(CASO, 'Tipo');
    const habilidad = nombreUnicoQA(testContext.get(CASO, 'Habilidad'), bancos.habilidad.texto('nombre'));
    const nivel = testContext.get(CASO, 'Nivel');

    logger.info(`${CASO}: agregando Habilidad "${habilidad}" (Tipo dirigido: ${tipoDirigido || '(automático)'}) a "${nombreUsado}"`);
    const guardado = await detalle.agregarHabilidad({ tipo: tipoDirigido, habilidad, nivel });
    assert.ok(guardado.exito, `Se esperaba guardado exitoso de Habilidad para "${nombreUsado}". Notify: "${guardado.notify}"`);
    const { tipoUsado } = guardado;

    const textoBloque = await detalle.esperarHabilidadesContiene(habilidad);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Habilidad agregada - "${nombreUsado}"` });

    assert.ok(
      textoBloque.includes(habilidad),
      `No se encontró "${habilidad}" en el bloque "Habilidades" tras guardar (bloque: "${textoBloque}").`
    );
    assert.ok(
      textoBloque.includes(tipoUsado),
      `No se encontró el Tipo "${tipoUsado}" en el bloque "Habilidades" tras guardar (bloque: "${textoBloque}").`
    );
    logger.info(`${CASO}: verificado -> "${habilidad}" (Tipo "${tipoUsado}") aparece en "Habilidades"`);
  });
});
