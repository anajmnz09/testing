const assert = require('assert');
const { testContext, evidence } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const CapacitacionFormPage = require('../pages/CapacitacionFormPage');
const { nombreUnicoQA } = require('../support/nombresQA');
const bancos = require('../support/bancos');

const CASO = 'agregar-capacitacion';
const CLAVE_EMPLEADO = 'Nombre de Empleado que recibe la Capacitación';
// Deriva las claves del Panel del propio mapa `ESTRATEGIAS` del Page Object
// (mismo criterio que los `editar-*` de Empleados) + la clave de búsqueda del
// empleado PRIMERO. El asterisco de requerido en el Panel sale aparte, de
// `data/campos-agregar-capacitacion.js` (Nombre, Fecha de inicio).
testContext.registrarCasoDesdeFormulario(CASO, CapacitacionFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO]);

/**
 * Agrega una entrada de "Capacitación" a un Empleado existente: entra al
 * detalle, abre la sección "Capacitación" (listview con barra de
 * título/Agregar/Eliminar, igual que Requisiciones), presiona "Agregar",
 * llena TODOS los campos del formulario inline y presiona "Guardar".
 *
 * Empleado: si el Panel dirige "Nombre de Empleado que recibe la
 * Capacitación", se usa ese; si no, el PRIMERO del listado (nunca un nombre
 * memorizado — los registros cambian según la compañía activa).
 *
 * Valores: cada campo toma el valor dirigido desde el Panel o, si no viene, un
 * default QA. "Nombre" lleva sufijo único por corrida (`nombreUnicoQA`) para
 * que la verificación de persistencia no sea un falso positivo por texto que
 * ya estaba de una corrida anterior. "Frecuencia" (catálogo) sin valor
 * dirigido -> primera opción (modo automático del framework).
 *
 * Requeridos reales del form (asterisco): SOLO "Nombre" y "Fecha de inicio".
 */
describe('Empleados - Agregar Capacitación', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: agrega una Capacitación a un Empleado existente y la guarda`, async function () {
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
            `la suite asume que siempre hay al menos un registro. Puede deberse a una compañía ` +
            `nueva sin datos semilla (seed) o a un problema del API/entorno — no se trata como ` +
            `"sin datos, se omite": es una precondición del escenario que no se cumplió.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreUsado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreUsado}"`);
    }

    // Abrir la sección + verificar el título de la página (anti-falso-positivo:
    // que el sidemenu quede activo no prueba que el contenido cargó).
    const abierta = await detalle.abrirSeccion('Capacitación');
    const titulo = await detalle.esperarTituloContenido('Capacitación');
    assert.ok(
      titulo.coincide,
      `El área de título no muestra "Capacitación" antes de agregar (empleado: "${nombreUsado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`
    );
    assert.ok(abierta.activada, `La sección "Capacitación" no quedó activa para "${nombreUsado}".`);

    const form = await detalle.abrirAgregarCapacitacion();

    // dd/MM/yyyy, misma convención que datosQA (editores DevExtreme de la app).
    const fmt = (d) => d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hoy = new Date();
    const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);

    const nombreCap = nombreUnicoQA(testContext.get(CASO, 'Nombre'), bancos.capacitacion.texto('nombre'));
    const valores = {
      Nombre: nombreCap,
      Descripción: bancos.capacitacion.valor(testContext.get(CASO, 'Descripción'), 'descripcion'),
      Centro: bancos.capacitacion.valor(testContext.get(CASO, 'Centro'), 'centro'),
      Facilitador: bancos.capacitacion.valor(testContext.get(CASO, 'Facilitador'), 'facilitador'),
      Costo: testContext.get(CASO, 'Costo') || '1000',
      'Inversión Empresa': testContext.get(CASO, 'Inversión Empresa') || '500',
      'Fecha de inicio': testContext.get(CASO, 'Fecha de inicio') || fmt(hoy),
      'Fecha finalización': testContext.get(CASO, 'Fecha finalización') || fmt(en30),
      'Cantidad Horas': testContext.get(CASO, 'Cantidad Horas') || '8',
      // "Frecuencia": si el Panel la dirige se usa; si no, se omite para que la
      // estrategia elija la primera opción del catálogo.
      Frecuencia: testContext.get(CASO, 'Frecuencia') || undefined,
    };

    logger.info(`${CASO}: llenando Capacitación "${nombreCap}" para "${nombreUsado}" -> ${JSON.stringify(valores)}`);
    const aplicados = await form.completar(valores);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Form "Agregar Capacitación" lleno - "${nombreUsado}"` });

    const res = await form.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Tras Guardar Capacitación - "${nombreUsado}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba guardado exitoso de la Capacitación para "${nombreUsado}" ` +
        `(form cerrado=${res.cerrado}, notify="${res.notify}"). Valores: ${JSON.stringify(aplicados)}.`
    );

    // Verificación de persistencia: la fila nueva aparece en la listview de
    // "Capacitación". "Nombre" es único por corrida, así que encontrarlo prueba
    // que ESTA corrida guardó (no un residuo de una anterior).
    const listado = await form.esperarListadoContiene(nombreCap);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Capacitación "${nombreCap}" en el listado` });
    assert.ok(
      listado.toLowerCase().includes(nombreCap.toLowerCase()),
      `No se encontró "${nombreCap}" en la sección "Capacitación" tras Guardar (texto de la sección: "${listado.slice(0, 400)}").`
    );
    logger.info(`${CASO}: verificado -> "${nombreCap}" aparece en la listview de "Capacitación"`);
  });
});
