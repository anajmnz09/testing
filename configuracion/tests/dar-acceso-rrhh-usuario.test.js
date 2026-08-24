const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'dar-acceso-rrhh-usuario';
// `nombre` dirige a un Usuario puntual; sin él, se elige el PRIMERO del
// listado. Test DEDICADO a "Tiene acceso a RRHH" — mismo criterio que
// `marcar-usuario-administrador`: separado de crear/editar a pedido
// explícito del usuario.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Enciende el switch "Tiene acceso a RRHH" de un Usuario EXISTENTE (no crea
 * ninguno) y confirma que quedó aplicado. Si el usuario elegido YA tiene
 * acceso a RRHH, el test lo deja igual (idempotente) — no lo apaga ni lo
 * vuelve a encender.
 */
describe('Configuración - Dar Acceso a RRHH a Usuario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoUsuarios();

  it(`${CASO}: marca "Tiene acceso a RRHH" en un Usuario existente y confirma`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    const nombreUsado = nombreDirigido || (await detalle.getNombre());

    const yaTieneAcceso = await detalle.estadoInterruptor('Tiene acceso a RRHH');
    if (yaTieneAcceso) {
      logger.info(`${CASO}: "${nombreUsado}" ya tiene acceso a RRHH — se da por cumplido el caso sin editar nada.`);
      return;
    }

    await detalle.editar();
    await detalle.setCampo('Tiene acceso a RRHH', true);
    await detalle.guardar();

    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba guardado exitoso para "${nombreUsado}". Notify: "${res.notify}"`);

    await evidence.attachScreenshot(ctx.driver, this, { label: `"Tiene acceso a RRHH" activado - "${nombreUsado}"` });

    const estadoFinal = await detalle.esperarInterruptor('Tiene acceso a RRHH', true);
    assert.strictEqual(estadoFinal, true, `"Tiene acceso a RRHH" no quedó activado para "${nombreUsado}" tras guardar.`);
  });
});
