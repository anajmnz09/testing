const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const HorarioDetallePage = require('../pages/HorarioDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-horario';
// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables (labels reales), derivados de la única fuente de
// verdad (HorarioDetallePage.ESTRATEGIAS — "Jornada diaria", deshabilitada y
// autocalculada en la app, NO está declarada ahí a propósito, así que
// tampoco aparece acá).
testContext.registrarCasoDesdeFormulario(CASO, HorarioDetallePage.ESTRATEGIAS);

const DESCRIPCION_BASE_QA = 'HORARIO QA';
const HORA_INICIAL_QA = '08:00 AM';
const HORA_FINAL_QA = '05:00 PM';

/** Sufijo corto y siempre distinto (evita choque con el nombre de una corrida anterior). */
function sufijoUnico() {
  return Date.now().toString().slice(-6);
}

/**
 * Crea un Horario nuevo desde Configuración > Administración > Horarios,
 * completando los 3 campos requeridos ("Descripción", "Hora Inicial", "Hora
 * final" — con datos QA) y, si el Panel dirige "Referencia"/"Estado", esos
 * también.
 *
 * "Jornada diaria" NUNCA se toca (a pedido explícito, ni siquiera declarada
 * en ESTRATEGIAS — se calcula sola a partir de Hora Inicial/Hora final, ver
 * mapeo de `HorarioDetallePage`).
 *
 * La DESCRIPCIÓN siempre lleva un sufijo único (timestamp): reutilizar el
 * mismo texto en corridas sucesivas rompería la creación (mismo criterio que
 * `crear-sucursal`/`crear-departamento`/`crear-puesto`).
 */
describe('Configuración - Crear Horario', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoHorarios();

  it(`${CASO}: crea un Horario nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const sufijo = sufijoUnico();
    const descripcionBase = testContext.get(CASO, 'Descripción') || DESCRIPCION_BASE_QA;
    const descripcion = `${descripcionBase} ${sufijo}`;
    logger.info(`${CASO}: descripción elegida -> "${descripcion}"`);
    await form.setCampo('Descripción', descripcion);

    const horaInicial = testContext.get(CASO, 'Hora Inicial') || HORA_INICIAL_QA;
    const horaFinal = testContext.get(CASO, 'Hora final') || HORA_FINAL_QA;
    await form.setCampo('Hora Inicial', horaInicial);
    await form.setCampo('Hora final', horaFinal);

    // "Referencia"/"Estado" — solo si el Panel los dirigió explícitamente.
    await form.completarConContexto(CASO, { incluirOpcionales: false });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${descripcion}". Notify: "${res.notify}"`);

    // Tras Guardar, confirmado con evidencia real (mismo comportamiento que
    // Sucursales/Departamentos/Puestos): la app vuelve al LISTADO — se
    // confirma ahí, con poll tolerante a la propagación.
    const filaCreada = await ctx.lista.grid.esperarFila(descripcion, (f) => f['Descripción'] === descripcion);
    assert.ok(filaCreada, `"${descripcion}" no aparece en el listado de Horarios tras crearlo.`);
  });
});
