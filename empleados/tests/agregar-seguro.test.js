const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const fixtures = require('../support/fixtures');
const SeguroFormPage = require('../pages/SeguroFormPage');

const CASO = 'agregar-seguro';
const CLAVE_EMPLEADO = 'Nombre de Empleado que recibe el Seguro';
// Deriva las claves del Panel del propio mapa `ESTRATEGIAS` del Page Object + la clave del empleado PRIMERO.
testContext.registrarCasoDesdeFormulario(CASO, SeguroFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO]);

/**
 * Asigna un Seguro a un Empleado existente: entra al detalle, abre "Recursos humanos > Seguros", presiona "Agregar" (NAVEGA a la
 * pantalla "Agregar Seguro"), llena el formulario y presiona "Guardar".
 *
 * Empleado: si el Panel dirige "Nombre de Empleado que recibe el Seguro", se usa ese; si no, el PRIMERO del listado.
 *
 * Valores (prioridad: Panel / Execution Context > automático):
 *  - Proveedor de seguros y Plan de seguro: los del Panel o, si no, UN PROVEEDOR Y UN PLAN AL AZAR del banco `seguro` (`datos`, nombres
 *    reales de ARS y de planes de salud; determinista por `DATOS_SEMILLA`). Son catálogos de Configuración (no texto libre), así que
 *    solo se asignan los del banco que EXISTEN allí; los demás se omiten y quedan en el log (`Form.elegirDelCatalogo`).
 *  - Comentario: fuente común `seguro.comentario`, con sufijo único por corrida (identifica la fila al verificar).
 *  - Tarifa, % Empresa, % Empleado y Estado ("Activo") los calcula/fija la app (deshabilitados): no se escriben, se verifican.
 */
describe('Empleados - Agregar Seguro', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: asigna un Seguro a un Empleado existente y lo guarda`, async function () {
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

    const abierta = await detalle.abrirSeccion('Seguros');
    const titulo = await detalle.esperarTituloContenido('Seguros');
    assert.ok(titulo.coincide, `El área de título no muestra "Seguros" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Seguros" no quedó activa para "${nombreEmpleado}".`);

    const form = await detalle.abrirAgregarSeguro();

    const valores = datos.deFormulario(CASO, SeguroFormPage.ESTRATEGIAS, { solo: ['Comentario'] });
    const proveedorDirigido = testContext.get(CASO, 'Proveedor de seguros');
    const planDirigido = testContext.get(CASO, 'Plan de seguro');
    if (proveedorDirigido && planDirigido) {
      valores['Proveedor de seguros'] = proveedorDirigido;
      valores['Plan de seguro'] = planDirigido;
    } else {
      // Los planes dependen del proveedor: se elige primero este (dirigido o al azar) y luego el plan entre los de ese proveedor.
      const elegidos = await form.elegirProveedorYPlan(
        () => proveedorDirigido || datos.resolver('seguro.proveedor', { campo: 'Proveedor de seguros' }),
        () => planDirigido || datos.resolver('seguro.plan', { campo: 'Plan de seguro' })
      );
      valores['Proveedor de seguros'] = elegidos.proveedor;
      valores['Plan de seguro'] = elegidos.plan;
    }

    logger.info(`${CASO}: asignando el Seguro "${valores['Plan de seguro']}" (${valores['Proveedor de seguros']}) a "${nombreEmpleado}" -> ${JSON.stringify(valores)}`);
    const aplicados = await form.completar(valores);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Form "Agregar Seguro" lleno - "${valores['Plan de seguro']}"` });

    const res = await form.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras Guardar el Seguro - "${nombreEmpleado}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba guardado exitoso del Seguro para "${nombreEmpleado}" (pantalla cerrada=${res.cerrado}, notify="${res.notify}"). Valores: ${JSON.stringify(aplicados)}.`
    );

    // Persistencia: tras guardar vuelve a "Seguros" y la fila nueva aparece (el comentario es único por corrida).
    await detalle.abrirSeccion('Seguros');
    await detalle.esperarTituloContenido('Seguros');
    let fila;
    await ctx.driver
      .wait(async () => {
        const filas = await detalle.leerFilasSeguros().catch(() => []);
        fila = filas.find((f) => String(f.Comentario || '').trim().toLowerCase() === valores.Comentario.toLowerCase());
        return !!fila;
      }, 15000)
      .catch(() => {});
    await evidence.attachScreenshot(ctx.driver, this, { label: `Seguro "${valores['Plan de seguro']}" en el listado` });
    assert.ok(fila, `No se encontró el Seguro con comentario "${valores.Comentario}" en "Seguros" tras Guardar.`);
    assertTextoIgual(fila.Proveedor, valores['Proveedor de seguros'], 'El Proveedor de la fila no coincide con el asignado.');
    assertTextoIgual(fila.Plan, valores['Plan de seguro'], 'El Plan de la fila no coincide con el asignado.');
    assertTextoIgual(fila.Estado, 'Activo', 'Un Seguro recién asignado debe quedar "Activo".');
    assert.ok(String(fila.Tarifa || '').trim(), `La Tarifa (calculada por la app al elegir el plan) quedó vacía. Fila: ${JSON.stringify(fila)}.`);
    logger.info(`${CASO}: verificado -> ${JSON.stringify(fila)}`);
  });
});
