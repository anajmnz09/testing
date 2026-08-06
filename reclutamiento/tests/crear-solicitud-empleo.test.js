const assert = require('assert');
const { testContext } = require('@triple/core');
const SolicitudEmpleoFormPage = require('../pages/SolicitudEmpleoFormPage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-solicitud-empleo';
// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables (labels reales), derivados de la única fuente de verdad
// (SolicitudEmpleoFormPage.ESTRATEGIAS). El usuario solo completa los valores
// que quiera dirigir.
testContext.registrarCasoDesdeFormulario(CASO, SolicitudEmpleoFormPage.ESTRATEGIAS);

// Identificación de un empleado INTERNO real (verificado: la app la reconoce y
// autocompleta Primer Nombre/Primer Apellido/Celular/Correo). Solo dígitos —
// la máscara agrega los guiones.
const IDENTIFICACION_EMPLEADO_INTERNO_QA = '00118936814';
const COMENTARIO_QA = 'Comentario de prueba automatizada QA.';
const ETIQUETA_QA = 'qa-automatizado';

/**
 * Crea una Solicitud de Empleo completando ÚNICAMENTE las secciones "Datos de
 * Empleado" y "Acerca del puesto de trabajo" (foto, valoración por estrellas y
 * demás quedan fuera de esta iteración, a propósito).
 *
 * Orden obligatorio del formulario (verificado, no asumido):
 *   Tipo ID (primero, define la máscara de Identificación) → Identificación
 *   (dispara el autollenado de empleado interno, si aplica) → resto de campos
 *   SOLO si siguen vacíos (nunca se sobreescribe lo autocompletado).
 */
describe('Reclutamiento - Crear Solicitud de Empleo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: crea completando Datos de Empleado y Acerca del puesto de trabajo`, async function () {
    const form = await ctx.lista.crear();

    const tipoId = testContext.get(CASO, 'Tipo ID') || 'Cedula';
    await form.seleccionarTipoId(tipoId);

    const identificacion = testContext.get(CASO, 'Identificación') || IDENTIFICACION_EMPLEADO_INTERNO_QA;
    await form.identificarYEsperarAutollenado(identificacion);

    // Comentario/Etiquetas son texto libre sin un "valor por defecto" razonable
    // dentro del framework: se dirigen acá, igual que hace
    // crear-req-comentarios.test.js con su Comentario. Se completan ANTES de
    // completarConContexto() para que la regla "solo vacíos" los respete.
    const comentario = testContext.get(CASO, 'Comentario') || COMENTARIO_QA;
    await form.setCampo('Comentario', comentario);
    const etiqueta = testContext.get(CASO, 'Etiquetas') || ETIQUETA_QA;
    await form.setCampo('Etiquetas', etiqueta);

    // Resto de "Datos de Empleado" y "Acerca del puesto de trabajo" (Grado
    // académico, Requisición) — solo lo que siga vacío. Requisición dispara la
    // cascada de Departamento/Puesto/Supervisor (disabled, nunca se tocan:
    // no están declarados en ESTRATEGIAS).
    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);
  });
});
