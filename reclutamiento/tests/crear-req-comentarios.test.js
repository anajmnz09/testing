const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'crear-req-comentarios';
testContext.registrarCaso(CASO, ['nombreRequisicion', 'comentario']);

const { RAZON } = RequisicionFormPage;

/**
 * Crea una requisición con un comentario y valida que quedó almacenado al
 * reabrir la requisición.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: el comentario queda almacenado y se ve al reabrir`, async function () {
    const nombre = testContext.get(CASO, 'nombreRequisicion') || datos.nombreQA(CASO);
    const comentario = testContext.get(CASO, 'comentario') || datos.comentario;

    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    await form.completarRequeridos(nombre);
    await form.setComentario(comentario);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    await ctx.lista.volverAlListado();
    const detalle = await ctx.lista.abrirDetalle(nombre);
    assert.ok((await detalle.getComentario()).includes(comentario), 'El comentario no quedó almacenado');
  });
});
