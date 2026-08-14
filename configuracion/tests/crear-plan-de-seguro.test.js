const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const PlanDeSeguroDetallePage = require('../pages/PlanDeSeguroDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-plan-de-seguro';
testContext.registrarCasoDesdeFormulario(CASO, PlanDeSeguroDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'PLAN QA';

/** Sufijo corto y siempre distinto (evita choque con el nombre de una corrida anterior). */
function sufijoUnico() {
  return Date.now().toString().slice(-6);
}

// Defaults QA para los numberbox REQUERIDOS que la app rechaza en "0"
// (confirmado con evidencia real: "0.00"/"0" no cuentan como vacíos para
// `estaVacio()`, así que `completarConContexto` los saltea de largo — se
// completan siempre explícitos, ver `PlanDeSeguroDetallePage`).
const DEFAULTS_QA = {
  Tarifa: '1500',
  '% Empresa': '80',
  '% Empleado': '20',
};

/**
 * Crea un Plan de seguro nuevo desde Configuración > Empleados > Planes de
 * seguros, completando "Nombre Plan de seguro" (identificador), "Nombre
 * Proveedor" (requerido, primera opción si el Panel no dirige nada) y los
 * numberbox requeridos "Tarifa"/"% Empresa"/"% Empleado" (Panel-dirigidos o
 * default QA). "Estado" nace deshabilitado y queda protegido solo. Si el
 * Panel dirige "Concepto de nómina" (opcional), también se completa.
 *
 * El NOMBRE siempre lleva un sufijo único (timestamp): reutilizar el mismo
 * nombre en corridas sucesivas rompería la creación (mismo criterio que el
 * resto de entidades de Configuración).
 */
describe('Configuración - Crear Plan de seguro', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoPlanesDeSeguros();

  it(`${CASO}: crea un Plan de seguro nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const sufijo = sufijoUnico();
    const nombreBase = testContext.get(CASO, 'Nombre Plan de seguro') || NOMBRE_BASE_QA;
    const nombrePlan = `${nombreBase} ${sufijo}`;
    logger.info(`${CASO}: nombre elegido -> "${nombrePlan}"`);

    // El identificador se completa PRIMERO (con el sufijo único) para que
    // `completarConContexto` lo salte (ya no está vacío). "Nombre Proveedor"
    // se elige ANTES que los numberbox: confirmado con evidencia real que
    // "Tarifa" nace deshabilitado hasta elegir un proveedor (la app lo
    // habilita en cascada).
    await form.setCampo('Nombre Plan de seguro', nombrePlan);
    await form.completarConContexto(CASO, { incluirOpcionales: true });

    // Numberbox REQUERIDOS: completados SIEMPRE de forma explícita (Panel-
    // dirigido o default QA), nunca vía el salteo automático de "ya tiene
    // datos" (ver `DEFAULTS_QA` y mapeo de `PlanDeSeguroDetallePage`).
    for (const [label, porDefecto] of Object.entries(DEFAULTS_QA)) {
      const valor = testContext.get(CASO, label) || porDefecto;
      await form.setCampo(label, valor);
    }

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombrePlan}". Notify: "${res.notify}"`);

    // La confirmación de persistencia NO usa `grid.buscar()`/`esperarFila` —
    // el buscador de esta pantalla es INESTABLE en el ambiente actual
    // (confirmado con evidencia real: "Error cargando registro(s)" en rojo,
    // reproducido 2/2 veces con distintos términos) — se cambia a "Todos"
    // (sin paginar) y se relee `filasPorColumnas()` sin filtrar hasta
    // encontrar el nombre, mismo criterio que `crear-grado-academico`/`crear-habilidad`.
    const { By } = require('selenium-webdriver');
    const btnTodos = await ctx.driver.findElement(By.xpath("//*[normalize-space(.)='Todos']"));
    await ctx.driver.executeScript('arguments[0].click()', btnTodos);
    await ctx.lista.grid.esperarSinLoader();

    const encontrada = await ctx.driver
      .wait(async () => {
        const filas = await ctx.lista.grid.filasPorColumnas();
        return filas.some((f) => f['Nombre'] === nombrePlan);
      }, 15000)
      .then(() => true)
      .catch(() => false);
    assert.ok(encontrada, `"${nombrePlan}" no aparece en el listado de Planes de seguros tras crearlo.`);
  });
});
