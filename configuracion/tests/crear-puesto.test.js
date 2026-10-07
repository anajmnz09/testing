const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const PuestoDetallePage = require('../pages/PuestoDetallePage');
const fixtures = require('../support/fixtures');
const { nombreUnicoQA } = require('../support/nombresQA');
const bancos = require('../support/bancos');

const CASO = 'crear-puesto';
// Input Model del formulario: se siembran en el Execution Context TODOS los
// controles editables (labels reales), derivados de la única fuente de
// verdad (PuestoDetallePage.ESTRATEGIAS — "Compañía"/"Estado"/"Personas
// Asignadas", deshabilitados en la app, NO están declarados ahí a propósito,
// así que tampoco aparecen acá). El usuario solo completa los valores que
// quiera dirigir.
testContext.registrarCasoDesdeFormulario(CASO, PuestoDetallePage.ESTRATEGIAS);

const NOMBRE_BASE_QA = 'PUESTO QA';

/**
 * Crea un Puesto nuevo desde Configuración > Administración > Puestos,
 * completando los 4 campos requeridos ("Nombre", "Descripción",
 * "Requisitos", "Responsabilidades" — con datos QA) y, si el Panel dirige
 * alguno, los opcionales (Clasificación 1/2/3, límites/rangos, Referencia).
 *
 * El tabview "Beneficios"/"Documentos" NUNCA se toca (a pedido explícito, ni
 * siquiera declarado en ESTRATEGIAS — ver mapeo de `PuestoDetallePage`).
 *
 * El NOMBRE, si el Panel lo dirige, se usa TAL CUAL (sin sufijo); si no,
 * lleva un sufijo único (timestamp) para no chocar con una corrida anterior
 * — ver `nombreUnicoQA` (`support/nombresQA.js`).
 */
describe('Configuración - Crear Puesto', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoPuestos();

  it(`${CASO}: crea un Puesto nuevo completando su formulario`, async function () {
    const form = await ctx.lista.crear();

    const nombrePuesto = nombreUnicoQA(testContext.get(CASO, 'Nombre'), NOMBRE_BASE_QA);
    logger.info(`${CASO}: nombre elegido -> "${nombrePuesto}"`);
    await form.setCampo('Nombre', nombrePuesto);

    const descripcion = bancos.puesto.valor(testContext.get(CASO, 'Descripción'), 'descripcion');
    const requisitos = bancos.puesto.valor(testContext.get(CASO, 'Requisitos'), 'requisitos');
    const responsabilidades = bancos.puesto.valor(testContext.get(CASO, 'Responsabilidades'), 'responsabilidades');
    await form.setCampo('Descripción', descripcion);
    await form.setCampo('Requisitos', requisitos);
    await form.setCampo('Responsabilidades', responsabilidades);

    // Resto de campos opcionales — solo si el Panel los dirigió
    // explícitamente (Clasificación 1/2/3 eligen la primera opción del
    // catálogo si se dirigen sin valor puntual).
    await form.completarConContexto(CASO, { incluirOpcionales: false });

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para "${nombrePuesto}". Notify: "${res.notify}"`);

    // Tras Guardar, confirmado con evidencia real (mismo comportamiento que
    // Sucursales/Departamentos): la app vuelve al LISTADO — se confirma ahí,
    // con poll tolerante a la propagación.
    const filaCreada = await ctx.lista.grid.esperarFila(nombrePuesto, (f) => f['Título de Puesto'] === nombrePuesto);
    assert.ok(filaCreada, `"${nombrePuesto}" no aparece en el listado de Puestos tras crearlo.`);
  });
});
