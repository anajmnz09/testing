const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'marcar-usuario-administrador';
// `nombre` dirige a un Usuario puntual; sin él, se elige el PRIMERO del
// listado. Test DEDICADO a "Es administrador" — a pedido explícito del
// usuario, separado de `crear-usuario`/`editar-usuario` (que nunca tocan
// este switch), para no mezclar el otorgamiento de un permiso sensible con
// el flujo normal de alta/edición.
testContext.registrarCaso(CASO, ['nombre']);

/**
 * Enciende el switch "Es administrador" de un Usuario EXISTENTE (no crea
 * ninguno) y confirma que quedó aplicado. Si el usuario elegido YA es
 * administrador, el test lo deja igual (idempotente) — no lo apaga ni lo
 * vuelve a encender, evita un Guardar innecesario sobre un registro real.
 */
describe('Configuración - Marcar Usuario como Administrador', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoUsuarios();

  it(`${CASO}: marca "Es administrador" en un Usuario existente y confirma`, async function () {
    const nombreDirigido = testContext.get(CASO, 'nombre');
    const detalle = nombreDirigido ? await ctx.lista.abrirDetalle(nombreDirigido) : await ctx.lista.abrirPrimero();
    const nombreUsado = nombreDirigido || (await detalle.getNombre());

    const yaEsAdministrador = await detalle.estadoInterruptor('Es administrador');
    if (yaEsAdministrador) {
      logger.info(`${CASO}: "${nombreUsado}" ya es administrador — se da por cumplido el caso sin editar nada.`);
      return;
    }

    await detalle.editar();
    await detalle.setCampo('Es administrador', true);
    await detalle.guardar();

    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba guardado exitoso para "${nombreUsado}". Notify: "${res.notify}"`);

    await evidence.attachScreenshot(ctx.driver, this, { label: `"Es administrador" activado - "${nombreUsado}"` });

    const estadoFinal = await detalle.esperarInterruptor('Es administrador', true);
    assert.strictEqual(estadoFinal, true, `"Es administrador" no quedó activado para "${nombreUsado}" tras guardar.`);
  });
});
