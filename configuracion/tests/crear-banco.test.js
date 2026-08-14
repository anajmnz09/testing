const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const BancoDetallePage = require('../pages/BancoDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-banco';
testContext.registrarCasoDesdeFormulario(CASO, BancoDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'BANCO QA';

/** Sufijo corto y siempre distinto (evita choque con el nombre de una corrida anterior). */
function sufijoUnico() {
  return Date.now().toString().slice(-6);
}

/**
 * Crea un Banco nuevo desde Configuración > Empleados > Bancos, completando
 * "Nombre" (identificador) y "País" (requerido, selectbox con buscador). Si
 * el Panel dirige "Referencia"/"Código"/"Dígito verificador" (opcionales),
 * también se completan.
 *
 * El NOMBRE siempre lleva un sufijo único (timestamp): reutilizar el mismo
 * nombre en corridas sucesivas rompería la creación (mismo criterio que el
 * resto de entidades de Configuración).
 */
describe('Configuración - Crear Banco', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBancos();

  it(`${CASO}: crea un Banco nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const sufijo = sufijoUnico();
    const nombreBase = testContext.get(CASO, 'Nombre') || NOMBRE_BASE_QA;
    const nombreBanco = `${nombreBase} ${sufijo}`;
    logger.info(`${CASO}: nombre elegido -> "${nombreBanco}"`);
    await form.setCampo('Nombre', nombreBanco);

    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombreBanco}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFila(nombreBanco, (f) => f['Nombre'] === nombreBanco);
    assert.ok(filaCreada, `"${nombreBanco}" no aparece en el listado de Bancos tras crearlo.`);
  });
});
