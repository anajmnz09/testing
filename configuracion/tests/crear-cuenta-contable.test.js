const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const CuentaContableDetallePage = require('../pages/CuentaContableDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');
const bancos = require('../support/bancos');

const CASO = 'crear-cuenta-contable';
testContext.registrarCasoDesdeFormulario(CASO, CuentaContableDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'CTA QA';

/**
 * Crea una Cuenta Contable nueva desde Configuración > Nómina > Cuentas
 * Contables, completando "No. cuenta" (identificador) y "Descripción"
 * (ambos requeridos). "Estado" ya llega con un valor por defecto y no es
 * requerido (a diferencia del resto de entidades de Configuración) — se deja
 * intacto salvo que el Panel lo dirija explícitamente.
 *
 * "No. cuenta", si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 */
describe('Configuración - Crear Cuenta Contable', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoCuentasContables();

  it(`${CASO}: crea una Cuenta Contable nueva completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const numeroCuenta = nombreUnicoQA(testContext.get(CASO, 'No. cuenta'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: "No. cuenta" elegido -> "${numeroCuenta}"`);
    await form.setCampo('No. cuenta', numeroCuenta);

    const descripcion = bancos.cuentaContable.valor(testContext.get(CASO, 'Descripción'), 'descripcion');
    await form.setCampo('Descripción', descripcion);

    // "Estado" — solo si el Panel lo dirigió explícitamente (ya trae un valor válido por defecto).
    await form.completarConContexto(CASO, { incluirOpcionales: false });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${numeroCuenta}". Notify: "${res.notify}"`);

    // El buscador rápido del listado SOLO indexa "Descripción" (confirmado con
    // evidencia real: buscar por "No. Cuenta Contable" da "no hay datos para
    // mostrar" aunque la fila exista) — se busca por Descripción y se filtra
    // la fila exacta por "No. Cuenta Contable" (ver CuentaContableDetallePage).
    const filaCreada = await ctx.lista.grid.esperarFila(
      descripcion,
      (f) => f['No. Cuenta Contable'] === numeroCuenta
    );
    assert.ok(filaCreada, `"${numeroCuenta}" no aparece en el listado de Cuentas Contables tras crearla.`);
  });
});
