const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const fixtures = require('../support/fixtures');
const datos = require('@triple/core/utils/datos');

const CASO = 'agregar-comentario-solicitud-empleo';

// Sin restricción de etapa/estado: se le puede agregar un comentario a
// CUALQUIER Solicitud de Empleo. Por eso no hay descubrimiento automático
// (no hay ningún requisito que filtrar) — el código es de entrada OBLIGATORIA
// desde el Panel/Execution Context.
testContext.registrarCaso(CASO, ['codigo', 'comentario']);

/**
 * Agrega un comentario a una Solicitud de Empleo EXISTENTE (cualquier
 * etapa/estado) usando la sección "Comentarios" (widget `CommentEditor` del
 * core, compuesto por `SolicitudEmpleoDetallePage.agregarComentario`) — el
 * mismo componente ya reutilizado en Requisición, sin selectores propios.
 */
describe('Reclutamiento - Agregar comentario a Solicitud de Empleo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: agrega un comentario mediante el editor de comentarios y confirma el guardado`, async function () {
    const codigo = testContext.get(CASO, 'codigo');
    if (!codigo) {
      assert.fail(
        `${CASO}: se requiere indicar el "codigo" de la Solicitud de Empleo (Execution Context/Panel) — no aplica descubrimiento automático.`
      );
    }
    const comentario = datos.valor(testContext.get(CASO, 'comentario'), 'comentario.texto');

    const detalle = await ctx.lista.abrirDetalle(codigo);
    await detalle.estaCargado();
    const guardado = await detalle.agregarComentario(comentario);
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Comentario agregado' });

    assert.ok(guardado, `Se esperaba que el comentario se guardara correctamente en "${codigo}".`);
  });
});
