const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const fixtures = require('../support/fixtures');
const HerramientaFormPage = require('../pages/HerramientaFormPage');

const CASO = 'agregar-herramienta';
const CLAVE_EMPLEADO = 'Nombre de Empleado que recibe la Herramienta';
// Deriva las claves del Panel del propio mapa `ESTRATEGIAS` del Page Object + la clave del empleado PRIMERO.
testContext.registrarCasoDesdeFormulario(CASO, HerramientaFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO]);

/**
 * Asigna una Herramienta a un Empleado existente: entra al detalle, abre la sección "Herramientas", presiona "Agregar" (NAVEGA a la
 * pantalla "Crear asignación"), llena sus 3 campos (Fecha de asignación, Referencia, Descripción) y presiona "Guardar".
 *
 * Empleado: si el Panel dirige "Nombre de Empleado que recibe la Herramienta", se usa ese; si no, el PRIMERO del listado.
 *
 * Valores (prioridad: Panel / Execution Context > fuente automática):
 *  - Referencia y Descripción: fuente común (`core/utils/datos`, banco `herramienta` declarado en `HerramientaFormPage.ESTRATEGIAS`).
 *    La Descripción lleva sufijo único por corrida, así encontrarla en el grid prueba que ESTA corrida guardó. Reproducible con
 *    `DATOS_SEMILLA` (el sufijo de unicidad no, a propósito).
 *  - Fecha de asignación: la del Panel o, si no, la que la app trae precargada (hoy). No es texto libre: queda fuera del mecanismo.
 */
describe('Empleados - Agregar Herramienta', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: asigna una Herramienta a un Empleado existente y la guarda`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    let detalle;
    let nombreEmpleado = empleadoDirigido;
    if (empleadoDirigido) {
      detalle = await ctx.lista.abrirDetalle(empleadoDirigido);
    } else {
      if (!((await ctx.lista.grid.contarFilas()) > 0)) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — la suite asume que siempre hay al menos un registro.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreEmpleado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreEmpleado}"`);
    }

    const abierta = await detalle.abrirSeccion('Herramientas');
    const titulo = await detalle.esperarTituloContenido('Herramientas');
    assert.ok(titulo.coincide, `El área de título no muestra "Herramientas" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Herramientas" no quedó activa para "${nombreEmpleado}".`);

    const form = await detalle.abrirAgregarHerramienta();

    const valores = datos.deFormulario(CASO, HerramientaFormPage.ESTRATEGIAS);
    const fecha = testContext.get(CASO, 'Fecha de asignación');
    if (fecha) valores['Fecha de asignación'] = fecha; // vacía: se deja la precargada por la app (hoy)
    const descripcion = valores.Descripción;

    logger.info(`${CASO}: asignando la Herramienta "${descripcion}" a "${nombreEmpleado}" -> ${JSON.stringify(valores)}`);
    const aplicados = await form.completar(valores, { autofill: false });
    await evidence.attachScreenshot(ctx.driver, this, { label: `Form "Crear asignación" lleno - "${nombreEmpleado}"` });

    const res = await form.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras Guardar la Herramienta - "${nombreEmpleado}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba guardado exitoso de la Herramienta para "${nombreEmpleado}" (pantalla cerrada=${res.cerrado}, notify="${res.notify}"). Valores: ${JSON.stringify(aplicados)}.`
    );

    // Persistencia: tras guardar vuelve a "Herramientas" y la fila nueva aparece en el grid (la descripción es única por corrida).
    await detalle.abrirSeccion('Herramientas');
    await detalle.esperarTituloContenido('Herramientas');
    let filas = await detalle.leerFilasHerramientas();
    await ctx.driver
      .wait(async () => {
        filas = await detalle.leerFilasHerramientas().catch(() => filas);
        return filas.some((f) => String(f['Descripción'] || '').trim().toLowerCase() === descripcion.toLowerCase());
      }, 15000)
      .catch(() => {});
    await evidence.attachScreenshot(ctx.driver, this, { label: `Herramienta "${descripcion}" en el listado` });
    const fila = filas.find((f) => String(f['Descripción'] || '').trim().toLowerCase() === descripcion.toLowerCase());
    assert.ok(fila, `No se encontró la Herramienta "${descripcion}" en la sección "Herramientas" tras Guardar. Filas: ${JSON.stringify(filas.map((f) => f['Descripción']))}.`);
    if (valores.Referencia) {
      assertTextoIgual(fila.Referencia, valores.Referencia, `La Referencia de la fila no coincide (esperada "${valores.Referencia}", quedó "${fila.Referencia}").`);
    }
    logger.info(`${CASO}: verificado -> "${descripcion}" aparece en "Herramientas" de "${nombreEmpleado}" (${JSON.stringify(fila)})`);
  });
});
