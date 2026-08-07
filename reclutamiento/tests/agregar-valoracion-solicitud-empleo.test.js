const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'agregar-valoracion-solicitud-empleo';
// Entradas del caso (Execution Context): `codigo` dirige a una solicitud
// puntual; sin él, se elige una al azar del listado (`abrirAleatoria`).
// `estrellas` (1-5) dirige la cantidad; sin ella, se usa un valor al azar.
testContext.registrarCaso(CASO, ['codigo', 'estrellas']);

/**
 * Agrega una valoración por estrellas a una Solicitud de Empleo existente
 * (no crea ninguna). Sin datos del Panel, automatiza: cualquier solicitud
 * del listado + una cantidad de estrellas al azar (1-5). Con datos del
 * Panel, dirige ambos.
 */
describe('Reclutamiento - Agregar Valoración a Solicitud de Empleo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: agrega una valoración por estrellas y confirma que se guardó`, async function () {
    const codigo = testContext.get(CASO, 'codigo');
    const { detalle, codigo: codigoUsado } = codigo
      ? { detalle: await ctx.lista.abrirDetalle(codigo), codigo }
      : await ctx.lista.abrirAleatoria();

    const estrellasInput = testContext.get(CASO, 'estrellas');
    const estrellas = estrellasInput ? Number(estrellasInput) : 1 + Math.floor(Math.random() * 5);
    logger.info(`${CASO}: solicitud "${codigoUsado}" -> ${estrellas} estrella(s)`);

    await detalle.editar();
    await detalle.setValoracion(estrellas);
    await detalle.guardar();

    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba guardado exitoso para "${codigoUsado}". Notify: "${res.notify}"`);

    const valoracionFinal = await detalle.getValoracion();
    assert.strictEqual(
      valoracionFinal,
      estrellas,
      `La valoración de "${codigoUsado}" no quedó en ${estrellas} estrella(s) (quedó en ${valoracionFinal}).`
    );
  });
});
