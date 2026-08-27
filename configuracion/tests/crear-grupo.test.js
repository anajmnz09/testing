const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const GrupoDetallePage = require('../pages/GrupoDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');

const CASO = 'crear-grupo';
testContext.registrarCasoDesdeFormulario(CASO, GrupoDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'GRUPO TEST';

/**
 * Crea un Grupo nuevo desde Configuración > Usuarios y permisos > Grupos,
 * completando "Nombre" — el ÚNICO campo del formulario de Crear, confirmado
 * con Selenium real (`screenInspector`): el listado además muestra una
 * columna "Descripción", pero esa columna no tiene ningún control
 * correspondiente en Crear, así que no hay nada más que completar acá.
 *
 * El NOMBRE, si el Panel lo dirige, se usa TAL CUAL; si no, lleva un sufijo
 * único (timestamp) — la app rechaza nombres duplicados, mismo criterio que
 * el resto de `crear-*` de Configuración.
 */
describe('Configuración - Crear Grupo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoGrupos();

  it(`${CASO}: crea un Grupo nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombre = nombreUnicoQA(testContext.get(CASO, 'Nombre'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: "Nombre" elegido -> "${nombre}"`);
    await form.setCampo('Nombre', nombre);

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombre}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFila(nombre, (f) => f['Nombre'] === nombre);
    assert.ok(filaCreada, `"${nombre}" no aparece en el listado de Grupos tras crearlo.`);
  });
});
