const assert = require('assert');
const { testContext } = require('@triple/core');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'agregar-comentario-requisicion';
// Entradas del caso (Execution Context): identifican una requisición YA EXISTENTE
// a editar. `comentario` es opcional (default en requisiciones.data). Este caso NO
// crea requisición.
testContext.registrarCaso(CASO, ['codigo', 'nombre', 'estado', 'comentario']);

/**
 * Agrega un comentario a una requisición EXISTENTE (no crea ninguna) usando la
 * sección "Comentarios" (widget `CommentEditor` del core, compuesto por
 * `RequisicionDetallePage.agregarComentario`) — NO el campo de formulario
 * "Comentario" (ese es un control distinto, `RequisicionFormPage.setComentario`).
 */
describe('Reclutamiento - Agregar comentario a requisición existente', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: agrega un comentario mediante el editor de comentarios y confirma el guardado`, async function () {
    const comentario = testContext.get(CASO, 'comentario') || datos.comentario;

    const { detalle } = await fixtures.abrirRequisicionExistente(ctx, CASO);
    const guardado = await detalle.agregarComentario(comentario);

    assert.ok(guardado, 'Se esperaba que el comentario se guardara correctamente en el editor');
  });
});
