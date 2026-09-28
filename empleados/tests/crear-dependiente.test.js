const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const DependienteFormPage = require('../pages/DependienteFormPage');

const CASO = 'crear-dependiente';
const CLAVE_EMPLEADO = 'Nombre de Empleado que recibe el Dependiente';
// Deriva las claves del Panel del propio mapa `ESTRATEGIAS` del Page Object
// (mismo criterio que `agregar-capacitacion`) + la clave de búsqueda del
// empleado PRIMERO.
testContext.registrarCasoDesdeFormulario(CASO, DependienteFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO]);

function sufijoUnico() {
  return Date.now().toString().slice(-6);
}

/**
 * Agrega un Dependiente a un Empleado existente: entra al detalle, abre la
 * sección "Dependientes" del sidemenu (listview con barra título/Agregar/
 * Eliminar/Filtro, MISMO layout que "Capacitación"), presiona "Agregar",
 * llena el formulario inline con los 7 campos REQUERIDOS (Parentesco, Tipo
 * ID, Identificación, Nombres, Apellidos, Género, Fecha de nacimiento) +
 * "Discapacidad" (opcional, texto libre) y presiona "Guardar".
 *
 * Empleado: si el Panel dirige "Nombre de Empleado que recibe el
 * Dependiente", se usa ese; si no, el PRIMERO del listado (nunca un nombre
 * memorizado — los registros cambian según la compañía activa).
 *
 * Valores: cada campo toma el valor dirigido desde el Panel o, si no viene,
 * un default QA. "Identificación" lleva sufijo único por corrida (formato
 * cédula, 11 dígitos) para que la verificación de persistencia no sea un
 * falso positivo por un registro de una corrida anterior. "Parentesco"/
 * "Tipo ID"/"Género" (catálogos) sin valor dirigido -> primera opción (modo
 * automático del framework, `directSelect`).
 *
 * NO llena el bloque de seguro ("Proveedor de seguros"/"Plan de seguro"/
 * "Tarifa"/"% Empresa"/"% Empleado", deshabilitado hasta elegir un
 * proveedor) ni "Dependiente directo" (checkbox opcional) salvo que el
 * Panel los dirija explícitamente — ver `DependienteFormPage.completar`.
 * "Edad" nunca se toca: es de solo lectura, autocalculada desde "Fecha de
 * nacimiento".
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

    const s = sufijoUnico();
    const nombres = testContext.get(CASO, 'Nombres') || `QA${s}`;
    const apellidos = testContext.get(CASO, 'Apellidos') || `Dependiente${s}`;
    const identificacion = testContext.get(CASO, 'Identificación') || `001${s}${s.slice(-2)}`.slice(0, 11).padEnd(11, '0');

    const valores = {
      Parentesco: testContext.get(CASO, 'Parentesco') || undefined,
      'Tipo ID': testContext.get(CASO, 'Tipo ID') || undefined,
      Identificación: identificacion,
      Nombres: nombres,
      Apellidos: apellidos,
      Género: testContext.get(CASO, 'Género') || undefined,
      'Fecha de nacimiento': testContext.get(CASO, 'Fecha de nacimiento') || '01/01/2015',
      Discapacidad: testContext.get(CASO, 'Discapacidad') || 'Ninguna',
      'Proveedor de seguros': testContext.get(CASO, 'Proveedor de seguros') || undefined,
      'Plan de seguro': testContext.get(CASO, 'Plan de seguro') || undefined,
      Tarifa: testContext.get(CASO, 'Tarifa') || undefined,
      '% Empresa': testContext.get(CASO, '% Empresa') || undefined,
      '% Empleado': testContext.get(CASO, '% Empleado') || undefined,
      'Dependiente directo': testContext.get(CASO, 'Dependiente directo'),
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
