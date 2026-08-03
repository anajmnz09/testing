const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'crear-req-comentarios';
// Input Model: siembra TODOS los campos del formulario (labels reales) — incluido
// "Comentario", que ya vive en ESTRATEGIAS con estrategia 'text'.
testContext.registrarCasoDesdeFormulario(CASO, RequisicionFormPage.ESTRATEGIAS);

const { RAZON } = RequisicionFormPage;

/**
 * Crea una requisición con un comentario y valida que quedó almacenado al
 * reabrir la requisición.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: el comentario queda almacenado y se ve al reabrir`, async function () {
    // El comentario tiene un default propio del caso (por eso no queda vacío):
    // valor del contexto si el usuario lo cargó, o el texto QA por defecto.
    const comentario = testContext.get(CASO, 'Comentario') || datos.comentario;

    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    const d = await form.completarRequeridosConContexto(CASO);
    await form.setComentario(comentario); // asegura el comentario (default si vacío)
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    await ctx.lista.volverAlListado();
    const detalle = await ctx.lista.abrirDetalle(d.nombre);
    assert.ok((await detalle.getComentario()).includes(comentario), 'El comentario no quedó almacenado');
  });
});
