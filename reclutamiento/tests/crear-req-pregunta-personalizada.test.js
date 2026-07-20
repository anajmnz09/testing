const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'crear-req-pregunta-personalizada';
testContext.registrarCaso(CASO, ['nombreRequisicion', 'pregunta', 'nombreCampo']);

const { RAZON } = RequisicionFormPage;

/**
 * Crea una requisición con una Pregunta Personalizada y valida que quedó
 * almacenada al reabrir la requisición.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: la pregunta queda almacenada y se ve al reabrir`, async function () {
    const nombre = testContext.get(CASO, 'nombreRequisicion') || datos.nombreQA(CASO);
    const pregunta = {
      pregunta: testContext.get(CASO, 'pregunta') || datos.preguntaPersonalizada.pregunta,
      nombreCampo: testContext.get(CASO, 'nombreCampo') || datos.preguntaPersonalizada.nombreCampo,
    };

    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    await form.completarRequeridos(nombre);
    await form.agregarPreguntaPersonalizada(pregunta);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    await ctx.lista.volverAlListado();
    const detalle = await ctx.lista.abrirDetalle(nombre);
    // La pregunta puede mostrarse por su "Nombre del campo" o por el texto de la pregunta.
    const porNombre = await detalle.tienePreguntaPersonalizada(pregunta.nombreCampo);
    const porTexto = await detalle.tienePreguntaPersonalizada('disponibilidad inmediata');
    assert.ok(porNombre || porTexto, 'La pregunta personalizada no quedó almacenada');
  });
});
