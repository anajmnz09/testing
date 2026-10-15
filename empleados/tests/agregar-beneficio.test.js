const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const fixtures = require('../support/fixtures');
const BeneficioFormPage = require('../pages/BeneficioFormPage');

const CASO = 'agregar-beneficio';
const CLAVE_EMPLEADO = 'Nombre de Empleado que recibe el Beneficio';
// Deriva las claves del Panel del propio mapa `ESTRATEGIAS` del Page Object + la clave del empleado PRIMERO.
testContext.registrarCasoDesdeFormulario(CASO, BeneficioFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO]);

const dos = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * Asigna un Beneficio a un Empleado existente: entra al detalle, abre "Recursos humanos > Beneficios", presiona "Agregar" (NAVEGA a la
 * pantalla "Crear Beneficio"), llena el formulario y presiona "Guardar".
 *
 * Empleado: si el Panel dirige "Nombre de Empleado que recibe el Beneficio", se usa ese; si no, el PRIMERO del listado.
 *
 * Valores (prioridad: Panel / Execution Context > automático):
 *  - Beneficio: el del Panel o, si no, UN TIPO AL AZAR del banco `beneficio` (`datos`, ~10 tipos: transporte, comida, combustible…;
 *    determinista por `DATOS_SEMILLA`). Es un catálogo de Configuración > Beneficios (no texto libre), así que solo se asignan los
 *    tipos del banco que EXISTEN allí; los demás se omiten y quedan en el log (`BeneficioFormPage.elegirBeneficioDelCatalogo`).
 *  - Comentario: fuente común `beneficio.comentario`, con sufijo único por corrida (identifica la fila al verificar).
 *  - Monto (2500), Fecha Inicial (hoy) y Fecha Final (hoy + 1 año): no son texto libre, quedan fuera del mecanismo; el Panel manda.
 *  - Estado lo fija la app ("Activo", deshabilitado): no se escribe, se verifica.
 */
describe('Empleados - Agregar Beneficio', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: asigna un Beneficio a un Empleado existente y lo guarda`, async function () {
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

    const abierta = await detalle.abrirSeccion('Beneficios');
    const titulo = await detalle.esperarTituloContenido('Beneficios');
    assert.ok(titulo.coincide, `El área de título no muestra "Beneficios" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Beneficios" no quedó activa para "${nombreEmpleado}".`);

    const form = await detalle.abrirAgregarBeneficio();

    const hoy = new Date();
    const enUnAnio = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate());
    const valores = datos.deFormulario(CASO, BeneficioFormPage.ESTRATEGIAS, { solo: ['Comentario'] });
    valores.Beneficio =
      testContext.get(CASO, 'Beneficio') || (await form.elegirBeneficioDelCatalogo(() => datos.resolver('beneficio.tipo', { campo: 'Beneficio' })));
    valores.Monto = testContext.get(CASO, 'Monto') || '2500';
    valores['Fecha Inicial'] = testContext.get(CASO, 'Fecha Inicial') || fmt(hoy);
    valores['Fecha Final'] = testContext.get(CASO, 'Fecha Final') || fmt(enUnAnio);

    logger.info(`${CASO}: asignando el Beneficio "${valores.Beneficio}" a "${nombreEmpleado}" -> ${JSON.stringify(valores)}`);
    const aplicados = await form.completar(valores);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Form "Crear Beneficio" lleno - "${valores.Beneficio}"` });

    const res = await form.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras Guardar el Beneficio - "${nombreEmpleado}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba guardado exitoso del Beneficio para "${nombreEmpleado}" (pantalla cerrada=${res.cerrado}, notify="${res.notify}"). Valores: ${JSON.stringify(aplicados)}.`
    );

    // Persistencia: tras guardar vuelve a "Beneficios" y la fila nueva aparece (el comentario es único por corrida).
    await detalle.abrirSeccion('Beneficios');
    await detalle.esperarTituloContenido('Beneficios');
    let fila;
    await ctx.driver
      .wait(async () => {
        const filas = await detalle.leerFilasBeneficios().catch(() => []);
        fila = filas.find((f) => String(f.Comentario || '').trim().toLowerCase() === valores.Comentario.toLowerCase());
        return !!fila;
      }, 15000)
      .catch(() => {});
    await evidence.attachScreenshot(ctx.driver, this, { label: `Beneficio "${valores.Beneficio}" en el listado` });
    assert.ok(fila, `No se encontró el Beneficio con comentario "${valores.Comentario}" en "Beneficios" tras Guardar.`);
    assertTextoIgual(fila.Beneficio, valores.Beneficio, 'El Beneficio de la fila no coincide con el asignado.');
    // El grid formatea el monto ("2,500.00"): se compara como número.
    assert.strictEqual(Number(String(fila.Monto).replace(/,/g, '')), Number(valores.Monto), `El Monto de la fila no coincide (esperado ${valores.Monto}, quedó "${fila.Monto}").`); // contrato-texto-ui:permitir: comparación numérica, no texto de UI
    assertTextoIgual(fila.Estado, 'Activo', 'Un Beneficio recién asignado debe quedar "Activo".');
    logger.info(`${CASO}: verificado -> ${JSON.stringify(fila)}`);
  });
});
