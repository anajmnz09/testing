const assert = require('assert');
const { testContext, textoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const ConceptoNominaDetallePage = require('../pages/ConceptoNominaDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-concepto-nomina';
testContext.registrarCasoDesdeFormulario(CASO, ConceptoNominaDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'CONCEPTO QA';

/**
 * Crea un Concepto de nómina nuevo desde Configuración > Nómina > Concepto
 * de nómina, completando "Nombre" (identificador) y el resto de selectbox
 * requeridos ("Tipo concepto"/"Clase"/"Origen"/"Tipo Ingreso"/"Tipo Valor")
 * vía `completarConContexto` (primera opción disponible si el Panel no
 * dirige nada). A pedido explícito del usuario, los 4 tabs del form
 * ("Indicadores", "Datos Contables e Integración", "Configuración Horas",
 * "Otros") se ignoran por completo — ver `ConceptoNominaDetallePage`.
 *
 * "Nombre", si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 *
 * "Tipo Ingreso" es un caso especial: la app lo deja DESHABILITADO/no
 * clickeable cuando "Origen" es "Descuento", y solo lo habilita con
 * Origen="Ingreso" — regla real de la app, confirmada por el usuario, que
 * aplica sin importar si el valor viene dirigido desde el Panel o del
 * autofill automático. Por eso "Origen" se resuelve PRIMERO y explícito, y
 * "Tipo Ingreso" solo se completa si el Origen efectivo terminó en
 * "Ingreso"; en cualquier otro caso se excluye del autofill genérico
 * (`completarConContexto`) para no intentar tocar un control deshabilitado.
 *
 * "% Pago Horas" TAMBIÉN se completa explícito, no vía `completarConContexto`
 * (confirmado con evidencia real, mismo hallazgo que "Tarifa"/"Precio Hora"/
 * "Rate" ya documentado en otras entidades de Nómina): es un numberbox
 * OPCIONAL que la app muestra en "0" por defecto, y ese "0" NUNCA cuenta como
 * vacío para `estaVacio()` (no lleva la clase `dx-texteditor-empty`) —
 * `completarConContexto` lo saltea SIEMPRE ("ya tiene datos, no se
 * sobreescribe"), aunque el Panel dirija un valor. Como es opcional, solo se
 * fuerza cuando el Panel dirige algo; sin dirección, "0" es válido y no hace
 * falta tocarlo.
 */
describe('Configuración - Crear Concepto de Nómina', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoConceptoNomina();

  it(`${CASO}: crea un Concepto de nómina nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombre = nombreUnicoQA(testContext.get(CASO, 'Nombre'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: "Nombre" elegido -> "${nombre}"`);
    await form.setCampo('Nombre', nombre);

    // "Origen" primero y explícito: "Tipo Ingreso" depende de su valor final.
    const origenDirigido = testContext.get(CASO, 'Origen');
    const origen = await form.setCampo('Origen', origenDirigido);
    logger.info(`${CASO}: "Origen" elegido -> "${origen}"`);

    const excepto = ['Origen'];
    if (textoIgual(String(origen || ''), 'Ingreso')) {
      await form.setCampo('Tipo Ingreso', testContext.get(CASO, 'Tipo Ingreso'));
    } else {
      logger.info(`${CASO}: se omite "Tipo Ingreso" (deshabilitado por la app con Origen="${origen}").`);
      excepto.push('Tipo Ingreso');
    }

    const pagoHorasDirigido = testContext.get(CASO, '% Pago Horas');
    if (pagoHorasDirigido) {
      await form.setCampo('% Pago Horas', pagoHorasDirigido);
      excepto.push('% Pago Horas');
    }

    await form.completarConContexto(CASO, { incluirOpcionales: true, excepto });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombre}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFila(nombre, (f) => f['Nombre'] === nombre);
    assert.ok(filaCreada, `"${nombre}" no aparece en el listado de Concepto de Nómina tras crearlo.`);
  });
});
