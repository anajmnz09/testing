const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');

const CASO = 'consultar-capacitacion';
const CLAVE_EMPLEADO = 'Nombre de Empleado a consultar';
// En modo automático (sin empleado dirigido desde el Panel) abre el PRIMER
// empleado del listado, en "Modo lista" (columna "Nombre") — NUNCA un nombre
// fijo/memorizado: los registros cambian según la compañía activa. Si el
// Panel llena "Nombre de Empleado a consultar", la consulta se hace SOBRE ese
// empleado.
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO]);

/**
 * Abre el detalle de un Empleado ya existente y navega a la sección
 * "Capacitación" del sidemenu (ver `EmpleadoDetallePage.SECCIONES`/
 * `abrirSeccion`) — sin entrar a "Editar", modo SOLO CONSULTA.
 *
 * Validación (sin falsos positivos): NO alcanza con que el ítem del sidemenu
 * quede marcado activo (`is_current`) — eso lo pone el simple click aunque el
 * contenido no cargue. Igual que Requisiciones / Solicitudes, en el ÁREA DE
 * TÍTULO de la página (acá el `<h2 class*="record-name">`, no el `<h1>` del
 * menú) debe leerse "Capacitación": esa es la prueba real de que la sección
 * abrió. Se adjunta una captura JUSTO en ese momento (evidencia visual de qué
 * había en pantalla al validar — incidente 2026-09-02: un listado vacío hacía
 * que el test terminara antes sin ninguna captura que lo delatara).
 *
 * OJO: la sección es una listview tipo Requisiciones (título + botón Crear +
 * buscador). Que la grilla diga "Por el momento, no hay datos para mostrar"
 * NO es un fallo — este test solo valida el título, nunca la cantidad de
 * filas. Si el listado de EMPLEADOS está vacío, en cambio, el test falla
 * explícito (Empleados es un catálogo persistente — ver el `assert.fail`).
 */
describe('Empleados - Consultar Capacitación', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: abre la sección "Capacitación" del detalle de un Empleado existente`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    let detalle;

    if (nombreDirigido) {
      detalle = await ctx.lista.abrirDetalle(nombreDirigido);
    } else {
      const hayFilas = (await ctx.lista.grid.contarFilas()) > 0;
      if (!hayFilas) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — ` +
            `la suite asume que siempre hay al menos un registro. Puede deberse a una compañía ` +
            `nueva sin datos semilla (seed) o a un problema del API/entorno — no se trata como ` +
            `"sin datos, se omite": es una precondición del escenario que no se cumplió.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
    }

    const res = await detalle.abrirSeccion('Capacitación');
    const titulo = await detalle.esperarTituloContenido('Capacitación');
    await evidence.attachScreenshot(ctx.driver, this, { label: `Sección "Capacitación" tras navegar` });

    assert.ok(
      titulo.coincide,
      `El área de título de la página no muestra "Capacitación" tras abrir la sección ` +
        `(empleado: "${nombreDirigido || '(automático)'}"). Títulos de contenido visibles: ` +
        `${JSON.stringify(titulo.vistos)}. (Una grilla vacía —"Por el momento, no hay datos para ` +
        `mostrar"— NO es fallo: solo se valida el título.)`
    );
    assert.ok(
      res.activada,
      `El ítem "Capacitación" del sidemenu no quedó marcado como activo (is_current) tras navegar ` +
        `(empleado: "${nombreDirigido || '(automático)'}"), pese a que el título de contenido sí apareció.`
    );
    logger.info(`${CASO}: sección "Capacitación" abierta — título de contenido confirmado`);
  });
});
