const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const navigationFlow = require('@triple/core/flows/navigationFlow');
const fixtures = require('../support/fixtures');
const EmpleadosPage = require('../pages/EmpleadosPage');
const SeguroFormPage = require('../pages/SeguroFormPage');

const CASO = 'inactivar-seguro';
const CLAVE_EMPLEADO = 'Nombre del Empleado con el Seguro a inactivar';
const CLAVE_SEGURO = 'Nombre del Plan de seguro a inactivar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_SEGURO]);

/**
 * Inactiva un Seguro de un Empleado: en "Recursos humanos > Seguros" marca el checkbox de la fila y presiona "Inactivar" (confirmando el
 * popup si la app lo pide); la fila debe quedar con Estado "Inactivo".
 *
 * AUTOMÁTICO por defecto: primer empleado del listado; si el Panel no dirige el seguro, el test ASIGNA uno propio (mismo flujo y datos
 * que `agregar-seguro`, proveedor y plan al azar del banco `seguro`) e inactiva ESE: así nunca inactiva por sorpresa un seguro real del
 * empleado. Con el seguro dirigido por el NOMBRE de su plan (columna "Plan", p. ej. "Plan Alpha"), inactiva la primera fila ACTIVA con
 * ese plan; si no hay ninguna activa, el test FALLA.
 */
describe('Empleados - Inactivar Seguro', function () {
  this.timeout(300000);
  // No idempotente (cambia el estado del registro): un reintento no encontraría el mismo seguro activo.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: inactiva un Seguro y confirma que queda Inactivo`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const seguroDirigido = testContext.get(CASO, CLAVE_SEGURO);
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

    const abierta = await detalle.abrirSeccion('Seguros');
    const titulo = await detalle.esperarTituloContenido('Seguros');
    assert.ok(titulo.coincide, `El área de título no muestra "Seguros" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Seguros" no quedó activa para "${nombreEmpleado}".`);

    let filas = await detalle.leerFilasSeguros();
    let comentario; // comentario de la fila objetivo: la identifica con precisión al verificar (puede haber varias del mismo plan)
    let nombrePlan = seguroDirigido;
    if (seguroDirigido) {
      const indice = detalle._indiceSeguro(filas, seguroDirigido);
      if (indice < 0) {
        assert.fail(`${CASO}: "${nombreEmpleado}" no tiene un Seguro con plan "${seguroDirigido}". Planes: ${JSON.stringify(filas.map((f) => f.Plan))}.`);
      }
      assert.ok(
        /^activo$/i.test(filas[indice].Estado.trim()),
        `${CASO}: el plan "${seguroDirigido}" no tiene ninguna fila activa (la primera está "${filas[indice].Estado}"): no hay nada que inactivar.`
      );
      comentario = filas[indice].Comentario;
    } else {
      logger.info(`${CASO}: asignando un Seguro propio a "${nombreEmpleado}" para inactivarlo (no se toca ninguno ya existente)`);
      const alta = await detalle.abrirAgregarSeguro();
      const valores = datos.deFormulario('agregar-seguro', SeguroFormPage.ESTRATEGIAS, { solo: ['Comentario'] });
      const elegidos = await alta.elegirProveedorYPlan(
        () => datos.resolver('seguro.proveedor', { campo: 'Proveedor de seguros' }),
        () => datos.resolver('seguro.plan', { campo: 'Plan de seguro' })
      );
      valores['Proveedor de seguros'] = elegidos.proveedor;
      valores['Plan de seguro'] = elegidos.plan;
      await alta.completar(valores);
      const resAlta = await alta.guardar();
      assert.ok(resAlta.exito && !resAlta.invalido, `${CASO}: no se pudo asignar un Seguro previo a "${nombreEmpleado}" (notify: "${resAlta.notify}").`);
      comentario = valores.Comentario;
      nombrePlan = elegidos.plan;
      await detalle.abrirSeccion('Seguros');
      await detalle.esperarTituloContenido('Seguros');
      filas = await detalle.leerFilasSeguros();
    }
    logger.info(`${CASO}: inactivando el Seguro "${nombrePlan}" (comentario "${comentario}") de "${nombreEmpleado}" (de ${filas.length} fila(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Seguro ANTES de inactivar - "${nombrePlan}" (${comentario})` });

    // La clave llega inline al localizador (`seguroDirigido || comentario`). En el Panel se dirige el NOMBRE del plan; en un flujo la
    // clave trae el comentario (la referencia de la entidad): el localizador acepta ambos (ver `EmpleadoDetallePage._indiceSeguro`).
    const res = await detalle.inactivarSeguro(seguroDirigido || comentario);
    logger.info(`${CASO}: resultado de inactivar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Inactivar" - "${nombrePlan}"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) el Seguro "${nombrePlan}" para inactivar.`);
    assert.ok(res.botonEliminarClickeado, 'No se encontró/clickeó el botón "Inactivar" de la sección "Seguros".');
    if (res.popupApareció) assert.ok(res.popupCerrado, `El popup de confirmación no cerró tras confirmar la inactivación de "${nombrePlan}". Notify: "${res.notify}".`);
    assert.ok(!/error/i.test(res.notify), `La app respondió con un error al inactivar "${nombrePlan}": "${res.notify}".`);

    // Persistencia: el estado de la fila cambia a "Inactivo" (se relee el grid; si no se refresca solo, se reabre el Empleado).
    let fila;
    const leerEstado = async (d) => {
      const actuales = await d.leerFilasSeguros().catch(() => []);
      return actuales.find((f) => String(f.Comentario || '').trim().toLowerCase() === comentario.toLowerCase());
    };
    await ctx.driver
      .wait(async () => {
        fila = await leerEstado(detalle);
        return !!fila && /inactivo/i.test(fila.Estado);
      }, 12000)
      .catch(() => {});
    if (!fila || !/inactivo/i.test(fila.Estado)) {
      logger.info(`${CASO}: el grid no refrescó el estado ("${fila && fila.Estado}"): se reabre el Empleado para releerlo`);
      await ctx.driver.get(`${new URL(await ctx.driver.getCurrentUrl()).origin}/`);
      await navigationFlow.abrirModulo(ctx.driver, 'Empleados');
      const lista2 = await new EmpleadosPage(ctx.driver).listo();
      const detalle2 = await lista2.abrirDetalle(nombreEmpleado);
      await detalle2.abrirSeccion('Seguros');
      await detalle2.esperarTituloContenido('Seguros');
      fila = await leerEstado(detalle2);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Seguro DESPUÉS de inactivar - "${nombrePlan}"` });
    assert.ok(fila, `No se encontró el Seguro "${comentario}" tras inactivarlo.`);
    assertTextoIgual(fila.Estado, 'Inactivo', `El Seguro "${nombrePlan}" debía quedar "Inactivo" (quedó "${fila.Estado}").`);
    logger.info(`${CASO}: verificado -> "${comentario}" quedó "${fila.Estado}"`);
  });
});
