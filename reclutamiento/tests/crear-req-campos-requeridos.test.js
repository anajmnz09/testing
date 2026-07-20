const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'crear-req-campos-requeridos';
testContext.registrarCaso(CASO, ['nombreRequisicion', 'puesto', 'sucursal', 'departamento', 'reclutador']);

const { RAZON } = RequisicionFormPage;

/**
 * Crea una requisición de tipo "Creación" completando todos los campos
 * requeridos, la guarda y valida la información al reabrirla.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: completa los requeridos, guarda y valida al reabrir`, async function () {
    const nombre = testContext.get(CASO, 'nombreRequisicion') || datos.nombreQA(CASO);

    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    const d = await form.completarRequeridos(nombre);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    // Reabrir la requisición creada y validar que cargó correctamente.
    await ctx.lista.volverAlListado();
    const detalle = await ctx.lista.abrirDetalle(nombre);
    assert.strictEqual((await detalle.getNombre()).trim(), nombre, 'El nombre no coincide');
    assert.ok((await detalle.getRequisitos()).includes(d.requisitos), 'Requisitos no cargó');
    assert.ok((await detalle.getResponsabilidades()).includes(d.responsabilidades), 'Responsabilidades no cargó');
    assert.ok((await detalle.getDescripcion()).includes(d.descripcion), 'Descripción no cargó');
  });
});
