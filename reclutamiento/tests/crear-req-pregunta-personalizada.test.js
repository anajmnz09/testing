const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'crear-req-pregunta-personalizada';
// Input Model: todos los campos del formulario (labels reales) + las claves EXTRA
// del modal de Pregunta Personalizada ("pregunta" y "nombreCampo"), que NO son
// controles del formulario principal sino del diálogo.
testContext.registrarCasoDesdeFormulario(CASO, RequisicionFormPage.ESTRATEGIAS, ['pregunta', 'nombreCampo']);

const { RAZON } = RequisicionFormPage;

/**
 * Crea una requisición con una Pregunta Personalizada y valida que quedó
 * almacenada al reabrir la requisición.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: la pregunta queda almacenada y se ve al reabrir`, async function () {
    const pregunta = {
      pregunta: testContext.get(CASO, 'pregunta') || datos.preguntaPersonalizada.pregunta,
      nombreCampo: testContext.get(CASO, 'nombreCampo') || datos.preguntaPersonalizada.nombreCampo,
    };

    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    const d = await form.completarRequeridosConContexto(CASO);
    await form.agregarPreguntaPersonalizada(pregunta);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    await ctx.lista.volverAlListado();
    const detalle = await ctx.lista.abrirDetalle(d.nombre);
    // La pregunta puede mostrarse por su "Nombre del campo" o por el texto de la pregunta.
    const porNombre = await detalle.tienePreguntaPersonalizada(pregunta.nombreCampo);
    const porTexto = await detalle.tienePreguntaPersonalizada('disponibilidad inmediata');
    assert.ok(porNombre || porTexto, 'La pregunta personalizada no quedó almacenada');
  });
});
