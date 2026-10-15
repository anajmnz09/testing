const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const fixtures = require('../support/fixtures');
const DependienteFormPage = require('../pages/DependienteFormPage');

const CASO = 'crear-dependiente';
const CLAVE_EMPLEADO = 'Nombre de Empleado que recibe el Dependiente';
// Deriva las claves del Panel del propio mapa `ESTRATEGIAS` del Page Object
// (mismo criterio que `agregar-capacitacion`) + la clave de búsqueda del
// empleado PRIMERO.
testContext.registrarCasoDesdeFormulario(CASO, DependienteFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO]);

/**
 * Agrega un Dependiente a un Empleado existente con TODOS los campos editables llenos: entra al detalle, abre la sección
 * "Dependientes", presiona "Agregar", llena el formulario inline completo y presiona "Guardar".
 *
 * Campos: Parentesco, Tipo ID, Identificación, Nombres, Apellidos, Género, Fecha de nacimiento, Discapacidad, Proveedor de seguros,
 * Plan de seguro y Dependiente directo. "Edad", "Tarifa", "% Empresa" y "% Empleado" son de solo lectura (la app los autocalcula desde
 * la fecha de nacimiento y el plan): se ven en pantalla, nunca se escriben.
 *
 * Empleado: si el Panel dirige "Nombre de Empleado que recibe el Dependiente", se usa ese; si no, el PRIMERO del listado.
 *
 * Valores (prioridad: Panel / Execution Context > fuente automática):
 *  - Texto con fuente común (`core/utils/datos`): Nombres y Apellidos (`persona.*`, coherentes entre sí), Discapacidad (banco
 *    `dependiente`, declarado en `DependienteFormPage.ESTRATEGIAS`) e Identificación (`persona.identificacion`, única por
 *    llamada: encontrarla en el listado prueba que ESTA corrida guardó). Reproducibles con `DATOS_SEMILLA`.
 *  - Selects (Parentesco, Tipo ID, Género, Proveedor y Plan de seguro): la primera opción real (autofill del framework).
 *  - Valores intencionales que NO vienen del mecanismo (no son texto): Fecha de nacimiento 01/01/2015 y Dependiente directo marcado
 *    (el Panel siembra `false` por omisión, indistinguible de "sin dirigir").
 */
describe('Empleados - Crear Dependiente', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: agrega un Dependiente a un Empleado existente y lo guarda`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    let detalle;
    let nombreUsado = nombreDirigido;

    if (nombreDirigido) {
      detalle = await ctx.lista.abrirDetalle(nombreDirigido);
    } else {
      const hayFilas = (await ctx.lista.grid.contarFilas()) > 0;
      if (!hayFilas) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — ` +
            `la suite asume que siempre hay al menos un registro.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreUsado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreUsado}"`);
    }

    const abierta = await detalle.abrirSeccion('Dependientes');
    const titulo = await detalle.esperarTituloContenido('Dependientes');
    assert.ok(
      titulo.coincide,
      `El área de título no muestra "Dependientes" antes de agregar (empleado: "${nombreUsado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`
    );
    assert.ok(abierta.activada, `La sección "Dependientes" no quedó activa para "${nombreUsado}".`);

    const form = await detalle.abrirAgregarDependiente();

    // Texto libre: fuente declarada en ESTRATEGIAS (Nombres, Apellidos, Discapacidad); la Identificación es un editor enmascarado
    // (estrategia custom), así que se pide directo por la interfaz pública.
    const generados = datos.deFormulario(CASO, DependienteFormPage.ESTRATEGIAS);
    const identificacion = datos.valor(testContext.get(CASO, 'Identificación'), 'persona.identificacion', { campo: 'Identificación' });
    const { Nombres: nombres, Apellidos: apellidos } = generados;

    const valores = {
      Parentesco: testContext.get(CASO, 'Parentesco') || undefined,
      'Tipo ID': testContext.get(CASO, 'Tipo ID') || undefined,
      Identificación: identificacion,
      ...generados,
      Género: testContext.get(CASO, 'Género') || undefined,
      'Fecha de nacimiento': testContext.get(CASO, 'Fecha de nacimiento') || '01/01/2015',
      'Proveedor de seguros': testContext.get(CASO, 'Proveedor de seguros') || undefined,
      'Plan de seguro': testContext.get(CASO, 'Plan de seguro') || undefined,
      'Dependiente directo': true,
    };

    logger.info(`${CASO}: llenando Dependiente "${nombres} ${apellidos}" para "${nombreUsado}" -> ${JSON.stringify(valores)}`);
    const aplicados = await form.completar(valores);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Form "Agregar Dependiente" lleno - "${nombreUsado}"` });

    const res = await form.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras Guardar Dependiente - "${nombreUsado}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba guardado exitoso del Dependiente para "${nombreUsado}" ` +
        `(form cerrado=${res.cerrado}, notify="${res.notify}"). Valores: ${JSON.stringify(aplicados)}.`
    );

    // Verificación de persistencia: la fila nueva aparece en la listview de
    // "Dependientes". "Identificación" es único por corrida, así que
    // encontrarla prueba que ESTA corrida guardó (no un residuo de una
    // anterior).
    const listado = await form.esperarListadoContiene(identificacion);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Dependiente "${identificacion}" en el listado` });
    assert.ok(
      listado.toLowerCase().includes(identificacion.toLowerCase()),
      `No se encontró "${identificacion}" en la sección "Dependientes" tras Guardar (texto de la sección: "${listado.slice(0, 400)}").`
    );
    logger.info(`${CASO}: verificado -> "${nombres} ${apellidos}" (Identificación "${identificacion}") aparece en la listview de "Dependientes"`);
  });
});
