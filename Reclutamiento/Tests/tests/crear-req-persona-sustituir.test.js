const assert = require('assert');
const { testContext, evidence, logger } = require('@triple/core');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const fixtures = require('../support/fixtures');
const datos = require('../data/requisiciones.data');

const CASO = 'crear-req-persona-sustituir';
testContext.registrarCaso(CASO, ['empleado', 'maxEmpleados']);

const { RAZON } = RequisicionFormPage;

/**
 * DETECTOR: ningún empleado seleccionable en "Persona(s) a sustituir" debe
 * romper la aplicación. Prueba cada empleado en un formulario fresco y falla
 * reportando el/los que provocan error, cuelgue, 404 o error JS.
 *
 * No guarda: no crea ningún registro.
 */
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoRequisiciones();

  it(`${CASO}: ningún empleado debe romper la aplicación`, async function () {
    this.retries(0); // es un detector: si encuentra el bug debe fallar, no reintentar

    const empleadoDirigido = testContext.get(CASO, 'empleado');
    const maxEmpleados =
      Number(testContext.get(CASO, 'maxEmpleados')) || datos.maxEmpleadosPersonaSustituir;

    // 1) Obtener la lista de empleados a probar.
    await ctx.lista.abrirFormularioCrear();
    let form = await new RequisicionFormPage(ctx.driver).estaCargado();
    await form.seleccionarRazon(RAZON.SUSTITUCION);

    const empleados = empleadoDirigido
      ? [empleadoDirigido] // el contexto dirige la prueba a un empleado puntual
      : (await form.empleadosDisponibles()).slice(0, maxEmpleados);

    assert.ok(empleados.length > 0, 'No hay empleados disponibles para sustituir');
    logger.info(`${CASO}: probando ${empleados.length} empleado(s)`);

    // 2) Probar cada empleado en un formulario fresco (aísla cada caso).
    const fallidos = [];
    for (const emp of empleados) {
      await ctx.lista.volverAlListado();
      await ctx.lista.abrirFormularioCrear();
      form = await new RequisicionFormPage(ctx.driver).estaCargado();
      await form.seleccionarRazon(RAZON.SUSTITUCION);
      await fixtures.iniciarColectorErroresJs(ctx.driver);

      let detalle = null;
      try {
        await form.seleccionarPersonaASustituir(emp); // dispara la carga desde el empleado

        // Señales de fallo:
        const notify = await form.getNotify(3000);
        const formOk = await form.formularioPresente();
        const url = await ctx.driver.getCurrentUrl();
        const jsErrs = await fixtures.erroresJs(ctx.driver);
        if (/error/i.test(notify) || !formOk || /404|not[_-]?found/i.test(url) || jsErrs.length > 0) {
          detalle = { empleado: emp, notify, formOk, url, jsErrs };
        }
      } catch (err) {
        // El cuelgue/timeout al seleccionar el empleado (la carga nunca termina)
        // ES una de las señales de fallo: la app deja de responder.
        detalle = { empleado: emp, colgado: true, error: err.message.split('\n')[0] };
      }

      if (detalle) {
        logger.error(`${CASO}: empleado problemático -> ${JSON.stringify(detalle)}`);
        try {
          await evidence.attachScreenshot(ctx.driver, this, { label: `Fallo con empleado: ${emp}` });
          await evidence.saveEvidenceBuffer('json', this, JSON.stringify(detalle, null, 2), {
            label: 'contexto-fallo',
            encoding: 'utf8',
          });
        } catch (e) { /* la app puede estar colgada; igual reportamos */ }
        fallidos.push(detalle);
        break; // no seguir usando un empleado que rompe la app
      }
      logger.info(`${CASO}: empleado OK -> "${emp}"`);
    }

    assert.strictEqual(fallidos.length, 0, `Empleado(s) que rompen la app: ${JSON.stringify(fallidos)}`);
  });
});
