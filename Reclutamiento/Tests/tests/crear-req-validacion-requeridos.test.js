const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-req-validacion-requeridos';
testContext.registrarCaso(CASO, []);

/**
 * La aplicación no debe permitir guardar una requisición con campos requeridos
 * vacíos: debe marcar el formulario como inválido y permanecer en él.
 *
 * No crea ningún registro.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: no permite guardar dejando requeridos vacíos`, async function () {
    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();

    await form.guardar(); // sin completar nada
    const res = await form.resultadoGuardado();

    assert.ok(!res.exito, 'No debería haberse creado la requisición');
    assert.ok(res.invalido, `Debería marcar el formulario como inválido. Notify: "${res.notify}"`);
    assert.ok(await form.sigueEnFormulario(), 'Debe seguir en el formulario de creación');
  });
});
