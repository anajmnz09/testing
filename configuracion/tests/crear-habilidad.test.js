const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const HabilidadesPage = require('../pages/HabilidadesPage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-habilidad';
testContext.registrarCasoDesdeFormulario(CASO, HabilidadesPage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'HABILIDAD QA';

/**
 * Crea una Habilidad nueva mediante el popup "Crear" en Configuración >
 * Empleados > Habilidades, completando "Habilidad" (único campo de texto
 * requerido). "Estado" nace deshabilitado ("Activo" fijo), mismo patrón que
 * Grados Académicos.
 *
 * El NOMBRE, si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 *
 * La confirmación de persistencia NO usa `grid.buscar()`/`esperarFila` — el
 * buscador de esta pantalla está roto en el ambiente actual (confirmado con
 * evidencia real: dispara "Error cargando registro(s)" en rojo, mismo
 * hallazgo ya documentado para Horarios/Grados Académicos) — se cambia a
 * "Todos" (sin paginar) y se relee `filasPorColumnas()` sin filtrar hasta
 * encontrar el nombre, mismo criterio que `crear-grado-academico`.
 */
describe('Configuración - Crear Habilidad', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoHabilidades();

  it(`${CASO}: crea una Habilidad nueva mediante el popup "Crear"`, async function () {
    const modal = await ctx.lista.crear();

    const nombreHabilidad = nombreUnicoQA(testContext.get(CASO, 'Habilidad'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: nombre elegido -> "${nombreHabilidad}"`);
    await modal.setCampo('Habilidad', nombreHabilidad);

    await modal.completarConContexto(CASO, { incluirOpcionales: true });

    await modal.guardar();
    const res = await modal.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombreHabilidad}". Notify: "${res.notify}"`);

    const { By } = require('selenium-webdriver');
    const btnTodos = await ctx.driver.findElement(By.xpath("//*[normalize-space(.)='Todos']"));
    await ctx.driver.executeScript('arguments[0].click()', btnTodos);
    await ctx.lista.grid.esperarSinLoader();

    const encontrada = await ctx.driver
      .wait(async () => {
        const filas = await ctx.lista.grid.filasPorColumnas();
        return filas.some((f) => f['Habilidad'] === nombreHabilidad);
      }, 15000)
      .then(() => true)
      .catch(() => false);
    assert.ok(encontrada, `"${nombreHabilidad}" no aparece en el listado de Habilidades tras crearla.`);
  });
});
