const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'crear-req-sustitucion-requeridos';
testContext.registrarCaso(CASO, ['nombreRequisicion', 'empleado', 'horario', 'tipoContrato']);

const { RAZON } = RequisicionFormPage;

/**
 * Crea una requisición de tipo "Sustitución" completando únicamente los campos
 * obligatorios (incluida la persona a sustituir).
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: crea con solo los campos obligatorios`, async function () {
    const nombre = testContext.get(CASO, 'nombreRequisicion') || datos.nombreQA(CASO);
    const empleado = testContext.get(CASO, 'empleado');

    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.SUSTITUCION);

    // La persona se elige PRIMERO: auto-rellena Sucursal/Departamento/Puesto y
    // limpia Horario/Modalidad, por eso completarRequeridos va después (llena lo vacío).
    if (empleado) {
      await form.seleccionarPersonaASustituir(empleado);
    } else {
      await form.seleccionarPrimeraPersonaASustituir();
    }
    await form.completarRequeridos(nombre);

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);
  });
});
