const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const DepartamentoDetallePage = require('../pages/DepartamentoDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-departamento';
// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables (labels reales), derivados de la única fuente de
// verdad (DepartamentoDetallePage.ESTRATEGIAS). El usuario solo completa los
// valores que quiera dirigir.
testContext.registrarCasoDesdeFormulario(CASO, DepartamentoDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'DEPARTAMENTO QA';

/** Sufijo corto y siempre distinto (evita choque con el nombre de una corrida anterior). */
function sufijoUnico() {
  return Date.now().toString().slice(-6);
}

/**
 * Crea un Departamento nuevo desde Configuración > Administración >
 * Departamentos, completando "Departamento" (único campo requerido) y, si el
 * Panel dirige alguno, "Clasificación 1/2/3"/"Departamento Padre"/"Gerente
 * Departamento" (selectbox opcionales con buscador — `searchAndSelect`,
 * elige la primera opción disponible si no se dirige ningún valor).
 *
 * La sección "Distribución Centro Costo" NUNCA se toca (a pedido explícito,
 * ni siquiera está declarada en ESTRATEGIAS — ver mapeo de
 * `DepartamentoDetallePage`).
 *
 * El NOMBRE siempre lleva un sufijo único (timestamp): reutilizar el mismo
 * nombre en corridas sucesivas rompería la creación (validación de
 * duplicados de la app, mismo criterio que `crear-sucursal`).
 */
describe('Configuración - Crear Departamento', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoDepartamentos();

  it(`${CASO}: crea un Departamento nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const sufijo = sufijoUnico();
    const nombreBase = testContext.get(CASO, 'Departamento') || NOMBRE_BASE_QA;
    const nombreDepartamento = `${nombreBase} ${sufijo}`;
    logger.info(`${CASO}: nombre elegido -> "${nombreDepartamento}"`);
    await form.setCampo('Departamento', nombreDepartamento);

    // Resto de campos opcionales (Clasificación 1/2/3, Departamento Padre,
    // Gerente Departamento) — si el Panel dirige alguno se usa ese; si no,
    // se elige la primera opción disponible del catálogo.
    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombreDepartamento}". Notify: "${res.notify}"`);

    // Tras Guardar, confirmado con evidencia real (mismo comportamiento que
    // Sucursales): la app vuelve al LISTADO — se confirma ahí, con poll
    // tolerante a la propagación.
    const filaCreada = await ctx.lista.grid.esperarFila(nombreDepartamento, (f) => f['Nombre'] === nombreDepartamento);
    assert.ok(filaCreada, `"${nombreDepartamento}" no aparece en el listado de Departamentos tras crearlo.`);
  });
});
