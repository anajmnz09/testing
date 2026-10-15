const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const TipoNominaDetallePage = require('../pages/TipoNominaDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-tipo-nomina';
testContext.registrarCasoDesdeFormulario(CASO, TipoNominaDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'TIPO NOMINA QA';
// "Código nómina" tiene `maxlength="3"` (confirmado con evidencia real) —
// demasiado corto para `nombreUnicoQA` (cualquier base+sufijo se trunca a 3
// caracteres, dando SIEMPRE el mismo valor y chocando con "Ya existe un tipo
// de nómina con este código" en la segunda corrida). Se genera un código de
// 3 caracteres alfanuméricos en base36 al azar — no garantiza unicidad
// absoluta (espacio de 46656 valores), pero la probabilidad de choque entre
// corridas es despreciable EN LA PRÁCTICA.
//
// Confirmado con evidencia real que `Date.now() % 46656` (versión anterior)
// SÍ choca en la práctica: dos corridas separadas por un múltiplo de
// 46656ms (~46.6s) generan el MISMO código — no es un caso hipotético, pasó
// corriendo esta suite repetidas veces en la misma sesión. `Math.random()`
// no tiene esa correlación con el timing entre corridas.
function codigoUnicoQA3() {
  return datos.codigo(3); // mismo espacio (36^3) y criterio, ahora derivado de la semilla de la corrida (DATOS_SEMILLA)
}
// Defaults QA para los numberbox REQUERIDOS que la app rechaza en "0"
// (mismo hallazgo que "Tarifa" de Planes de seguro: "0" no cuenta como vacío
// para `estaVacio()`, así que `completarConContexto` lo saltea de largo — el
// test SIEMPRE lo completa explícito). "Intervalo de pago" se mantiene en 1
// a propósito (confirmado por el usuario: probar con 1 o 2, nunca más) —
// cada unidad exige agregar un intervalo a "Distribución de Pago" cuyos
// "Porciento" deben sumar 100 (ver `completarDistribucionPago`), así que 1
// es el caso QA más simple posible.
const INTERVALO_PAGO_QA = '1';
const PORCIENTOS_DISTRIBUCION_QA = [100];

/**
 * Crea un Tipo Nómina nuevo desde Configuración > Nómina > Tipo Nómina,
 * completando "Nombre"/"Código nómina" (identificadores), "Intervalo de
 * pago" (numberbox requerido, con default QA), "Distribución de Pago"
 * (obligatoria — ver `TipoNominaDetallePage`, el widget de alta recién
 * aparece con "Intervalo de pago" > 0) y el resto de selects requeridos vía
 * `completarConContexto` (primera opción disponible si el Panel no dirige
 * nada).
 *
 * "Nombre", si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 */
describe('Configuración - Crear Tipo Nómina', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoTipoNomina();

  it(`${CASO}: crea un Tipo Nómina nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombre = nombreUnicoQA(testContext.get(CASO, 'Nombre'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: "Nombre" elegido -> "${nombre}"`);
    await form.setCampo('Nombre', nombre);

    const codigo = testContext.get(CASO, 'Código nómina') || codigoUnicoQA3();
    await form.setCampo('Código nómina', codigo);

    const intervaloPago = testContext.get(CASO, 'Intervalo de pago') || INTERVALO_PAGO_QA;
    await form.setCampo('Intervalo de pago', intervaloPago);

    // "Distribución de Pago" es obligatoria para Guardar (ver
    // `TipoNominaDetallePage`) — un intervalo por cada valor, sumando 100.
    // Solo se completa con el default QA (no dirigible desde el Panel: no es
    // un control simple de Form/Selection Strategy).
    await form.completarDistribucionPago(PORCIENTOS_DISTRIBUCION_QA);

    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombre}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFila(nombre, (f) => f['Nombre'] === nombre);
    assert.ok(filaCreada, `"${nombre}" no aparece en el listado de Tipo Nómina tras crearlo.`);
  });
});
