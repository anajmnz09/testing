const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'agregar-pregunta-personalizada';
// Entradas del caso (Execution Context): identifican una requisición YA EXISTENTE
// a editar. `pregunta` y `nombreCampo` son opcionales (default en
// requisiciones.data). Este caso NO crea requisición.
testContext.registrarCaso(CASO, ['codigo', 'nombre', 'estado', 'pregunta', 'nombreCampo']);

/**
 * Agrega una pregunta personalizada a una requisición EXISTENTE (no crea ninguna)
 * y valida que quedó almacenada al reabrirla.
 *
 * Reutiliza la localización por código/nombre (`abrirRequisicionExistente`), la
 * edición del detalle (`detalle.editar`) y los métodos del formulario
 * (`agregarPreguntaPersonalizada`, `guardar`, `resultadoGuardado`).
 */
describe('Reclutamiento - Agregar pregunta personalizada a requisición existente', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: agrega una pregunta personalizada a una requisición existente y la valida al reabrir`, async function () {
    const pregunta = {
      pregunta: testContext.get(CASO, 'pregunta') || datos.preguntaPersonalizada.pregunta,
      nombreCampo: testContext.get(CASO, 'nombreCampo') || datos.preguntaPersonalizada.nombreCampo,
    };

    const { detalle } = await fixtures.abrirRequisicionExistente(ctx, CASO);
    const nombre = (await detalle.getNombre()).trim();
    await detalle.editar();

    const form = new RequisicionFormPage(ctx.driver);
    await form.agregarPreguntaPersonalizada(pregunta);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba guardado exitoso. Notify: "${res.notify}"`);

    await ctx.lista.volverAlListado();
    const detalle2 = await ctx.lista.abrirDetalle(nombre);
    // La pregunta puede mostrarse por su "Nombre del campo" o por el texto de la pregunta.
    const porNombre = await detalle2.tienePreguntaPersonalizada(pregunta.nombreCampo);
    const porTexto = await detalle2.tienePreguntaPersonalizada('disponibilidad inmediata');
    assert.ok(porNombre || porTexto, 'La pregunta personalizada no quedó almacenada');
  });
});
