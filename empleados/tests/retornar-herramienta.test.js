const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const fixtures = require('../support/fixtures');
const HerramientaFormPage = require('../pages/HerramientaFormPage');
const HerramientaRetornoPage = require('../pages/HerramientaRetornoPage');

const CASO = 'retornar-herramienta';
const CLAVE_EMPLEADO = 'Nombre del Empleado con la Herramienta a retornar';
const CLAVE_HERRAMIENTA = 'Descripción de la Herramienta a retornar (opcional)';
// Deriva la clave de la fecha del propio mapa `ESTRATEGIAS` del popup + las claves de empleado y herramienta PRIMERO.
testContext.registrarCasoDesdeFormulario(CASO, HerramientaRetornoPage.ESTRATEGIAS, [CLAVE_EMPLEADO, CLAVE_HERRAMIENTA]);

const hoy = () => {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Retorna una Herramienta asignada a un Empleado: en la columna "Opciones" (3 puntos) de su fila, la opción "Retornar" abre un popup
 * ("Retornar Herramienta") con un mini form: "Fecha finalización" (requerida). Al guardar, la fila muestra esa fecha en la columna
 * "Fecha de Devolución".
 *
 * AUTOMÁTICO por defecto: primer empleado del listado y la PRIMERA herramienta de ese empleado que aún no fue devuelta (sin "Fecha de
 * Devolución"). Si el empleado no tiene ninguna pendiente, el test ASIGNA una primero (mismo flujo y datos que `agregar-herramienta`)
 * para no depender de que otro test haya corrido. El Panel puede dirigir el empleado, la herramienta (por descripción; debe estar
 * pendiente, si ya fue devuelta el test falla) y la fecha (por defecto, hoy).
 */
describe('Empleados - Retornar Herramienta', function () {
  this.timeout(300000);
  // No idempotente (marca la herramienta como devuelta): un reintento no encontraría la misma fila pendiente.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: retorna una Herramienta asignada y confirma la fecha de devolución`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const herramientaDirigida = testContext.get(CASO, CLAVE_HERRAMIENTA);
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

    let filas = await detalle.leerFilasHerramientas();
    const pendiente = (f) => !String(f['Fecha de Devolución'] || '').trim();
    let nombreHerramienta;

    if (herramientaDirigida) {
      const fila = filas.find((f) => String(f['Descripción'] || '').trim().toLowerCase() === herramientaDirigida.trim().toLowerCase());
      if (!fila) {
        assert.fail(`${CASO}: "${nombreEmpleado}" no tiene una Herramienta con descripción "${herramientaDirigida}". Herramientas: ${JSON.stringify(filas.map((f) => f['Descripción']))}.`);
      }
      assert.ok(pendiente(fila), `${CASO}: la Herramienta "${herramientaDirigida}" ya fue devuelta (Fecha de Devolución "${fila['Fecha de Devolución']}").`);
      nombreHerramienta = fila['Descripción'];
    } else if (filas.some(pendiente)) {
      nombreHerramienta = filas.find(pendiente)['Descripción'];
    } else {
      // Sin ninguna pendiente: se asigna una propia para poder retornarla.
      logger.info(`${CASO}: "${nombreEmpleado}" no tiene herramientas pendientes de devolución — asignando una para poder retornarla`);
      const alta = await detalle.abrirAgregarHerramienta();
      const valores = datos.deFormulario('agregar-herramienta', HerramientaFormPage.ESTRATEGIAS);
      await alta.completar(valores, { autofill: false });
      const resAlta = await alta.guardar();
      assert.ok(resAlta.exito && !resAlta.invalido, `${CASO}: no se pudo asignar una Herramienta previa a "${nombreEmpleado}" (notify: "${resAlta.notify}").`);
      nombreHerramienta = valores.Descripción;
      await detalle.abrirSeccion('Herramientas');
      await detalle.esperarTituloContenido('Herramientas');
      filas = await detalle.leerFilasHerramientas();
    }
    logger.info(`${CASO}: retornando la Herramienta "${nombreHerramienta}" de "${nombreEmpleado}"`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Herramientas ANTES de retornar - "${nombreHerramienta}"` });

    const popup = await detalle.abrirRetornarHerramienta(herramientaDirigida || nombreHerramienta); // la clave llega inline: `requires herramienta`
    const fecha = testContext.get(CASO, 'Fecha finalización') || hoy();
    await popup.completar({ 'Fecha finalización': fecha });
    await evidence.attachScreenshot(ctx.driver, this, { label: `Popup "Retornar Herramienta" lleno - "${nombreHerramienta}"` });

    const res = await popup.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras Guardar el retorno - "${nombreHerramienta}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba retorno exitoso de la Herramienta "${nombreHerramienta}" de "${nombreEmpleado}" (popup cerrado=${res.cerrado}, notify="${res.notify}", fecha="${fecha}").`
    );

    // Persistencia: la fila muestra la fecha en "Fecha de Devolución" (se relee el grid hasta que refleje el cambio).
    let fila;
    await ctx.driver
      .wait(async () => {
        const actuales = await detalle.leerFilasHerramientas().catch(() => []);
        fila = actuales.find((f) => String(f['Descripción'] || '').trim().toLowerCase() === nombreHerramienta.toLowerCase());
        return !!fila && !pendiente(fila);
      }, 15000)
      .catch(() => {});
    await evidence.attachScreenshot(ctx.driver, this, { label: `Herramientas DESPUÉS de retornar - "${nombreHerramienta}"` });
    assert.ok(fila && !pendiente(fila), `La Herramienta "${nombreHerramienta}" no muestra "Fecha de Devolución" tras retornarla. Fila: ${JSON.stringify(fila)}.`);
    assertTextoIgual(fila['Fecha de Devolución'].trim(), fecha, `La "Fecha de Devolución" no coincide (esperada "${fecha}", quedó "${fila['Fecha de Devolución']}").`);
    logger.info(`${CASO}: verificado -> "${nombreHerramienta}" devuelta el ${fecha}`);
  });
});
