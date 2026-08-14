const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const RazonSalidaDetallePage = require('../pages/RazonSalidaDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-razon-salida';
testContext.registrarCasoDesdeFormulario(CASO, RazonSalidaDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'RAZON SALIDA QA';

/** Sufijo corto y siempre distinto (evita choque con el nombre de una corrida anterior). */
function sufijoUnico() {
  return Date.now().toString().slice(-6);
}

/**
 * Crea una Razón de Salida nueva desde Configuración > Empleados > Razones
 * de Salidas, completando "Razón" (único campo de texto requerido). La
 * sección "Derechos Adquiridos" NUNCA se toca (a pedido explícito, ni
 * siquiera está declarada en ESTRATEGIAS — ver mapeo de
 * `RazonSalidaDetallePage`).
 *
 * El NOMBRE siempre lleva un sufijo único (timestamp): reutilizar el mismo
 * nombre en corridas sucesivas rompería la creación (mismo criterio que el
 * resto de entidades de Configuración).
 */
describe('Configuración - Crear Razón de Salida', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRazonesDeSalidas();

  it(`${CASO}: crea una Razón de Salida nueva completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const sufijo = sufijoUnico();
    const nombreBase = testContext.get(CASO, 'Razón') || NOMBRE_BASE_QA;
    const nombreRazon = `${nombreBase} ${sufijo}`;
    logger.info(`${CASO}: nombre elegido -> "${nombreRazon}"`);
    await form.setCampo('Razón', nombreRazon);

    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombreRazon}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFila(nombreRazon, (f) => f['Razón'] === nombreRazon);
    assert.ok(filaCreada, `"${nombreRazon}" no aparece en el listado de Razones de Salidas tras crearla.`);
  });
});
