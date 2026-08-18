const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const GradosAcademicosPage = require('../pages/GradosAcademicosPage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-grado-academico';
// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables (labels reales), derivados de la única fuente de
// verdad (GradosAcademicosPage.ESTRATEGIAS — "Estado" queda protegido solo
// al Crear, ver mapeo de esa clase).
testContext.registrarCasoDesdeFormulario(CASO, GradosAcademicosPage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'GRADO QA';

/**
 * Crea un Grado Académico nuevo desde Configuración > Administración >
 * Grados Académicos, mediante el popup "Crear" (botón de la barra),
 * completando "Nombre" (único requerido) y, si el Panel dirige
 * "Referencia MT", ese también.
 *
 * El NOMBRE, si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 *
 * La confirmación de persistencia NO usa `grid.buscar()`/`esperarFila` (el
 * buscador de esta pantalla está roto, ver mapeo de `GradosAcademicosPage`)
 * — se relee `filasPorColumnas()` sin filtrar hasta encontrar el nombre.
 */
describe('Configuración - Crear Grado Académico', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoGradosAcademicos();

  it(`${CASO}: crea un Grado Académico nuevo completando su popup`, async function () {
    const modal = await ctx.lista.crear();

    const nombre = nombreUnicoQA(testContext.get(CASO, 'Nombre'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: nombre elegido -> "${nombre}"`);
    await modal.setCampo('Nombre', nombre);

    // "Referencia MT" — solo si el Panel lo dirigió explícitamente.
    await modal.completarConContexto(CASO, { incluirOpcionales: false });

    await modal.guardar();
    const res = await modal.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombre}". Notify: "${res.notify}"`);

    // La confirmación en el listado no alcanza con leer la página actual: el
    // grid pagina (20 por página) y el registro recién creado puede caer en
    // cualquier otra página según el orden — se cambia a "Todos" (sin
    // paginar) antes de releer, así se lo encuentre donde se encuentre.
    const { By } = require('selenium-webdriver');
    const btnTodos = await ctx.driver.findElement(By.xpath("//*[normalize-space(.)='Todos']"));
    await ctx.driver.executeScript('arguments[0].click()', btnTodos);
    await ctx.lista.grid.esperarSinLoader();

    const encontrada = await ctx.driver.wait(async () => {
      const filas = await ctx.lista.grid.filasPorColumnas();
      return filas.some((f) => f['Nombre'] === nombre);
    }, 15000).then(() => true).catch(() => false);
    assert.ok(encontrada, `"${nombre}" no aparece en el listado de Grados Académicos tras crearlo.`);
  });
});
