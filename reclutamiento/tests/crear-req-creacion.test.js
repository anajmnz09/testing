const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-req-creacion';

// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables del form de creación, con sus LABELS REALES, derivados de
// la única fuente de verdad (el mapa de estrategias del Page Object). El usuario
// sólo completa los valores que quiera dirigir; nunca inventa ni crea claves.
testContext.registrarCasoDesdeFormulario(CASO, RequisicionFormPage.ESTRATEGIAS);

const { RAZON } = RequisicionFormPage;

/**
 * FLUJO CANÓNICO DE CREACIÓN.
 *
 * Crea una requisición de tipo "Creación" completando TODOS los campos
 * disponibles (requeridos + opcionales), la guarda y valida al reabrirla.
 *
 * Los valores salen del Execution Context: lo que el usuario cargó se usa; lo que
 * dejó vacío se autorrellena (primera opción de catálogo / textos QA). Ver
 * `completarRequeridosConContexto` con `incluirOpcionales`.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: crea con Razón "Creación" completando todos los campos y valida al reabrir`, async function () {
    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    const d = await form.completarRequeridosConContexto(CASO, { incluirOpcionales: true });
    const nombre = d.nombre;
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
