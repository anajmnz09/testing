const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const ProveedorSeguroDetallePage = require('../pages/ProveedorSeguroDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-proveedor-seguro';
testContext.registrarCasoDesdeFormulario(CASO, ProveedorSeguroDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'PROVEEDOR SEGURO QA';

/**
 * Crea un Proveedor de seguros nuevo desde Configuración > Empleados >
 * Proveedores de seguros, completando "Proveedor" (único campo de texto
 * requerido).
 *
 * El NOMBRE, si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 */
describe('Configuración - Crear Proveedor de seguros', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoProveedoresDeSeguros();

  it(`${CASO}: crea un Proveedor de seguros nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombreProveedor = nombreUnicoQA(testContext.get(CASO, 'Proveedor'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: nombre elegido -> "${nombreProveedor}"`);
    await form.setCampo('Proveedor', nombreProveedor);

    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombreProveedor}". Notify: "${res.notify}"`);

    // La confirmación de persistencia NO usa `grid.buscar()`/`esperarFila` —
    // el buscador de esta pantalla está ROTO en el ambiente actual
    // (confirmado con evidencia real: "Error cargando registro(s)" en rojo,
    // reproducido 3/3 veces con distintos términos, incluso uno inexistente)
    // — se cambia a "Todos" (sin paginar) y se relee `filasPorColumnas()` sin
    // filtrar hasta encontrar el nombre, mismo criterio que
    // `crear-grado-academico`/`crear-habilidad`.
    const { By } = require('selenium-webdriver');
    const btnTodos = await ctx.driver.findElement(By.xpath("//*[normalize-space(.)='Todos']"));
    await ctx.driver.executeScript('arguments[0].click()', btnTodos);
    await ctx.lista.grid.esperarSinLoader();

    const encontrada = await ctx.driver
      .wait(async () => {
        const filas = await ctx.lista.grid.filasPorColumnas();
        return filas.some((f) => f['Proveedor'] === nombreProveedor);
      }, 15000)
      .then(() => true)
      .catch(() => false);
    assert.ok(encontrada, `"${nombreProveedor}" no aparece en el listado de Proveedores de seguros tras crearlo.`);
  });
});
