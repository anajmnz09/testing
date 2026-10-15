const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const navigationFlow = require('@triple/core/flows/navigationFlow');
const fixtures = require('../support/fixtures');
const EmpleadosPage = require('../pages/EmpleadosPage');
const BeneficioFormPage = require('../pages/BeneficioFormPage');

const CASO = 'inactivar-beneficio';
const CLAVE_EMPLEADO = 'Nombre del Empleado con el Beneficio a inactivar';
const CLAVE_BENEFICIO = 'Nombre del Beneficio a inactivar (opcional)';
testContext.registrarCaso(CASO, [CLAVE_EMPLEADO, CLAVE_BENEFICIO]);

const dos = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * Inactiva un Beneficio de un Empleado: en "Recursos humanos > Beneficios" marca el checkbox de la fila y presiona "Inactivar"
 * (confirmando el popup si la app lo pide); la fila debe quedar con Estado "Inactivo".
 *
 * AUTOMÁTICO por defecto: primer empleado del listado; si el Panel no dirige el beneficio, el test ASIGNA uno propio (mismo flujo y
 * datos que `agregar-beneficio`, tipo al azar del banco `beneficio`) e inactiva ESE: así nunca inactiva por sorpresa un beneficio
 * real del empleado. Con el beneficio dirigido por su NOMBRE (columna "Beneficio", p. ej. "TRANSPORTE"), inactiva la primera fila
 * ACTIVA con ese nombre; si no hay ninguna activa, el test FALLA.
 */
describe('Empleados - Inactivar Beneficio', function () {
  this.timeout(300000);
  // No idempotente (cambia el estado del registro): un reintento no encontraría el mismo beneficio activo.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: inactiva un Beneficio y confirma que queda Inactivo`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const beneficioDirigido = testContext.get(CASO, CLAVE_BENEFICIO);
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

    const abierta = await detalle.abrirSeccion('Beneficios');
    const titulo = await detalle.esperarTituloContenido('Beneficios');
    assert.ok(titulo.coincide, `El área de título no muestra "Beneficios" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Beneficios" no quedó activa para "${nombreEmpleado}".`);

    let filas = await detalle.leerFilasBeneficios();
    let comentario; // comentario de la fila objetivo: la identifica con precisión al verificar (puede haber varias del mismo nombre)
    let nombreBeneficio = beneficioDirigido;
    if (beneficioDirigido) {
      const indice = detalle._indiceBeneficio(filas, beneficioDirigido);
      if (indice < 0) {
        assert.fail(`${CASO}: "${nombreEmpleado}" no tiene un Beneficio "${beneficioDirigido}". Beneficios: ${JSON.stringify(filas.map((f) => f.Beneficio))}.`);
      }
      assert.ok(
        /^activo$/i.test(filas[indice].Estado.trim()),
        `${CASO}: el Beneficio "${beneficioDirigido}" no tiene ninguna fila activa (la primera está "${filas[indice].Estado}"): no hay nada que inactivar.`
      );
      comentario = filas[indice].Comentario;
    } else {
      logger.info(`${CASO}: asignando un Beneficio propio a "${nombreEmpleado}" para inactivarlo (no se toca ninguno ya existente)`);
      const alta = await detalle.abrirAgregarBeneficio();
      const valores = datos.deFormulario('agregar-beneficio', BeneficioFormPage.ESTRATEGIAS, { solo: ['Comentario'] });
      valores.Beneficio = await alta.elegirBeneficioDelCatalogo(() => datos.resolver('beneficio.tipo', { campo: 'Beneficio' }));
      valores.Monto = '2500';
      valores['Fecha Inicial'] = fmt(new Date());
      await alta.completar(valores);
      const resAlta = await alta.guardar();
      assert.ok(resAlta.exito && !resAlta.invalido, `${CASO}: no se pudo asignar un Beneficio previo a "${nombreEmpleado}" (notify: "${resAlta.notify}").`);
      comentario = valores.Comentario;
      nombreBeneficio = valores.Beneficio;
      await detalle.abrirSeccion('Beneficios');
      await detalle.esperarTituloContenido('Beneficios');
      filas = await detalle.leerFilasBeneficios();
    }
    logger.info(`${CASO}: inactivando el Beneficio "${nombreBeneficio}" (comentario "${comentario}") de "${nombreEmpleado}" (de ${filas.length} fila(s))`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Beneficio ANTES de inactivar - "${nombreBeneficio}" (${comentario})` });

    // La clave llega inline al localizador (`beneficioDirigido || comentario`). En el Panel se dirige el NOMBRE del beneficio; en un flujo la
    // clave trae el comentario (la referencia de la entidad): el localizador acepta ambos (ver `EmpleadoDetallePage._indiceBeneficio`).: el escáner de flujos demuestra que el test consume un beneficio.
    const res = await detalle.inactivarBeneficio(beneficioDirigido || comentario);
    logger.info(`${CASO}: resultado de inactivar -> ${JSON.stringify(res)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras "Inactivar" - "${comentario}"` });

    assert.ok(res.seleccionado, `No se pudo seleccionar (checkbox) el Beneficio "${comentario}" para inactivar.`);
    assert.ok(res.botonEliminarClickeado, 'No se encontró/clickeó el botón "Inactivar" de la sección "Beneficios".');
    if (res.popupApareció) assert.ok(res.popupCerrado, `El popup de confirmación no cerró tras confirmar la inactivación de "${comentario}". Notify: "${res.notify}".`);
    assert.ok(!/error/i.test(res.notify), `La app respondió con un error al inactivar "${comentario}": "${res.notify}".`);

    // Persistencia: el estado de la fila cambia a "Inactivo" (se relee el grid; si no se refresca solo, se reabre el Empleado).
    let fila;
    const leerEstado = async (d) => {
      const actuales = await d.leerFilasBeneficios().catch(() => []);
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
      await detalle2.abrirSeccion('Beneficios');
      await detalle2.esperarTituloContenido('Beneficios');
      fila = await leerEstado(detalle2);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Beneficio DESPUÉS de inactivar - "${comentario}"` });
    assert.ok(fila, `No se encontró el Beneficio "${comentario}" tras inactivarlo.`);
    assertTextoIgual(fila.Estado, 'Inactivo', `El Beneficio "${comentario}" debía quedar "Inactivo" (quedó "${fila.Estado}").`);
    logger.info(`${CASO}: verificado -> "${comentario}" quedó "${fila.Estado}"`);
  });
});
