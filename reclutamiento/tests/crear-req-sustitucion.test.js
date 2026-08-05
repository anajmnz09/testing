const assert = require('assert');
const { testContext } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-req-sustitucion';
// Input Model: siembra TODOS los campos del formulario (labels reales). La persona
// a sustituir es el control real "Persona(s) a sustituir"; se opera con su flujo
// especial (tagbox) y por eso completarRequeridosConContexto la excluye del llenado.
testContext.registrarCasoDesdeFormulario(CASO, RequisicionFormPage.ESTRATEGIAS);

const { RAZON } = RequisicionFormPage;

/**
 * FLUJO CANÓNICO DE SUSTITUCIÓN.
 *
 * Crea una requisición de tipo "Sustitución" completando TODOS los campos
 * disponibles para este flujo (la persona a sustituir + requeridos + opcionales),
 * la guarda y valida que quedó creada.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: crea con Razón "Sustitución" completando todos los campos y valida`, async function () {
    const empleado = testContext.get(CASO, 'Persona(s) a sustituir');

    await ctx.lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.SUSTITUCION);

    // La persona se elige PRIMERO: auto-rellena Sucursal/Departamento/Puesto y
    // limpia Horario/Modalidad, por eso el llenado va después (completa lo vacío).
    if (empleado) {
      await form.seleccionarPersonaASustituir(empleado);
    } else {
      await form.seleccionarPrimeraPersonaASustituir();
    }
    const d = await form.completarRequeridosConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    // Validar que la requisición quedó creada (aparece en el listado).
    await ctx.lista.volverAlListado();
    assert.ok(await ctx.lista.existeRequisicion(d.nombre), `La requisición "${d.nombre}" no aparece en el listado`);
  });
});
