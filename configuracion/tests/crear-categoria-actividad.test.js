const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const CategoriaActividadDetallePage = require('../pages/CategoriaActividadDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-categoria-actividad';
testContext.registrarCasoDesdeFormulario(CASO, CategoriaActividadDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'CATEGORIA QA';
// Defaults QA para los numberbox REQUERIDOS que la app rechaza en "0"
// (mismo hallazgo que "Tarifa" de Planes de seguro: "0" no cuenta como
// vacío para `estaVacio()`, así que `completarConContexto` lo saltea de
// largo — el test SIEMPRE los completa explícito).
const PRECIO_HORA_QA = '100';
const HORA_JORNADA_QA = '8';
const RATE_QA = '50';

/**
 * Crea una Categoría de actividad nueva desde Configuración > Nómina >
 * Categoría de actividades, completando "Categorías" (identificador),
 * "Precio Hora"/"Hora Jornada" (numberbox requeridos, con default QA) y
 * "Estado" vía `completarConContexto` (ya trae un valor por defecto).
 *
 * "Categorías", si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 *
 * "Usar Rate"/"Rate" se completan EXPLÍCITOS, no vía `completarConContexto`
 * (confirmado con evidencia real, bug distinto al de "Usar Rate" — ver
 * `Form.setSwitch`): "Rate" es un numberbox que llega con "0" por defecto,
 * y "0" NUNCA cuenta como vacío para `estaVacio()` — mismo hallazgo que
 * "Tarifa"/"Precio Hora", así que `completarConContexto` lo salteaba de
 * largo SIEMPRE, aunque el Panel dirigiera un valor. Solo se completa
 * "Rate" cuando "Usar Rate" está encendido (dirigido o no, no tiene sentido
 * completarlo si el switch sigue apagado).
 */
describe('Configuración - Crear Categoría de Actividad', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoCategoriaActividades();

  it(`${CASO}: crea una Categoría de actividad nueva completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const categoria = nombreUnicoQA(testContext.get(CASO, 'Categorías'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: "Categorías" elegido -> "${categoria}"`);
    await form.setCampo('Categorías', categoria);

    const precioHora = testContext.get(CASO, 'Precio Hora') || PRECIO_HORA_QA;
    await form.setCampo('Precio Hora', precioHora);

    const horaJornada = testContext.get(CASO, 'Hora Jornada') || HORA_JORNADA_QA;
    await form.setCampo('Hora Jornada', horaJornada);

    const usarRate = testContext.get(CASO, 'Usar Rate');
    if (usarRate) {
      await form.setCampo('Usar Rate', usarRate);
      const rate = testContext.get(CASO, 'Rate') || RATE_QA;
      await form.setCampo('Rate', rate);
    }

    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${categoria}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFila(categoria, (f) => f['Categorías'] === categoria);
    assert.ok(filaCreada, `"${categoria}" no aparece en el listado de Categoría Actividades tras crearla.`);
  });
});
