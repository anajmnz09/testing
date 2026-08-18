const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const BancoDetallePage = require('../pages/BancoDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-banco';
testContext.registrarCasoDesdeFormulario(CASO, BancoDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'BANCO QA';

/**
 * Crea un Banco nuevo desde Configuración > Empleados > Bancos, completando
 * "Nombre" (identificador) y "País" (requerido, selectbox con buscador). Si
 * el Panel dirige "Referencia"/"Código"/"Dígito verificador" (opcionales),
 * también se completan.
 *
 * El NOMBRE, si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 */
describe('Configuración - Crear Banco', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBancos();

  it(`${CASO}: crea un Banco nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombreBanco = nombreUnicoQA(testContext.get(CASO, 'Nombre'), NOMBRE_BASE_QA);
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
