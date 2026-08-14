const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const BeneficioDetallePage = require('../pages/BeneficioDetallePage');
const fixtures = require('../support/fixtures');

const CASO = 'crear-beneficio';
// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables (labels reales), derivados de la única fuente de
// verdad (BeneficioDetallePage.ESTRATEGIAS). El usuario solo completa los
// valores que quiera dirigir.
testContext.registrarCasoDesdeFormulario(CASO, BeneficioDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'BENEFICIO QA';

/** Sufijo corto y siempre distinto (evita choque con el nombre de una corrida anterior). */
function sufijoUnico() {
  return Date.now().toString().slice(-6);
}

/**
 * Crea un Beneficio nuevo desde Configuración > Administración > Beneficios,
 * completando "Beneficio" (único campo de texto requerido) y "Estado"
 * (selectbox requerido, HABILITADO desde el Crear a diferencia del resto de
 * entidades de Configuración). "Concepto de nómina" es opcional
 * (`searchAndSelect`, elige la primera opción disponible si no se dirige
 * ningún valor).
 *
 * El NOMBRE siempre lleva un sufijo único (timestamp): reutilizar el mismo
 * nombre en corridas sucesivas rompería la creación (validación de
 * duplicados de la app, mismo criterio que `crear-sucursal`/`crear-departamento`).
 */
describe('Configuración - Crear Beneficio', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoBeneficios();

  it(`${CASO}: crea un Beneficio nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const sufijo = sufijoUnico();
    const nombreBase = testContext.get(CASO, 'Beneficio') || NOMBRE_BASE_QA;
    const nombreBeneficio = `${nombreBase} ${sufijo}`;
    logger.info(`${CASO}: nombre elegido -> "${nombreBeneficio}"`);
    await form.setCampo('Beneficio', nombreBeneficio);

    // Resto de campos (Concepto de nómina, Estado) — si el Panel dirige
    // alguno se usa ese; si no, se elige la primera opción disponible.
    await form.completarConContexto(CASO, { incluirOpcionales: true });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombreBeneficio}". Notify: "${res.notify}"`);

    // Tras Guardar, mismo comportamiento que Sucursales/Departamentos: la app
    // vuelve al LISTADO — se confirma ahí, con poll tolerante a la propagación.
    const filaCreada = await ctx.lista.grid.esperarFila(nombreBeneficio, (f) => f['Nombre'] === nombreBeneficio);
    assert.ok(filaCreada, `"${nombreBeneficio}" no aparece en el listado de Beneficios tras crearlo.`);
  });
});
