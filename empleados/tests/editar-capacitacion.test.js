const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const CapacitacionFormPage = require('../pages/CapacitacionFormPage');

const CASO = 'editar-capacitacion';
const CLAVE_EMPLEADO = 'Nombre de Empleado con la Capacitación';
const CLAVE_CAPACITACION = 'Nombre de la Capacitación a editar (opcional)';
testContext.registrarCasoDesdeFormulario(CASO, CapacitacionFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO, CLAVE_CAPACITACION]);

/**
 * Edita una Capacitación de un Empleado. Este listado NO se consulta (no hay
 * doble-click ni ícono de "consultar"): en la columna "Acción" hay un LÁPIZ
 * que abre el MISMO form que "Agregar" (titulado "Editar capacitación",
 * precargado) — mismo patrón que Grados Académicos en Configuración.
 *
 * Empleado: dirigido desde el Panel ("Nombre de Empleado con la Capacitación")
 * o, si no, el PRIMERO del listado. Capacitación: opcionalmente dirigida por
 * nombre; si no, la PRIMERA fila del grid. Si el empleado NO tiene ninguna
 * capacitación -> el test FALLA (precondición no cumplida, no "se omite").
 *
 * Cambios: los que el Panel dirija (cualquier campo del form); si no dirige
 * ninguno, un default QA sobre "Descripción" y "Facilitador" (textboxes
 * simples, sin efectos de identidad — NO se toca "Nombre" en automático para
 * poder re-ubicar la fila al verificar).
 */
describe('Empleados - Editar Capacitación', function () {
  this.timeout(300000);
  // No idempotente si el Panel dirige "Nombre" (busca por un nombre y lo
  // cambia) — un reintento global buscaría el nombre viejo. Mismo criterio que
  // `editar-grado-academico`.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: edita una Capacitación existente y confirma el cambio`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const capacitacionDirigida = testContext.get(CASO, CLAVE_CAPACITACION);
    let detalle;
    let nombreEmpleado = empleadoDirigido;

    if (empleadoDirigido) {
      detalle = await ctx.lista.abrirDetalle(empleadoDirigido);
    } else {
      const hayFilas = (await ctx.lista.grid.contarFilas()) > 0;
      if (!hayFilas) {
        assert.fail(
          `${CASO}: el listado de Empleados está vacío. Empleados es un catálogo persistente — ` +
            `la suite asume que siempre hay al menos un registro.`
        );
      }
      detalle = await ctx.lista.abrirPrimero();
      nombreEmpleado = await detalle.getNombre();
      logger.info(`${CASO}: empleado elegido automáticamente -> "${nombreEmpleado}"`);
    }

    const abierta = await detalle.abrirSeccion('Capacitación');
    const titulo = await detalle.esperarTituloContenido('Capacitación');
    assert.ok(titulo.coincide, `El área de título no muestra "Capacitación" (empleado: "${nombreEmpleado}").`);
    assert.ok(abierta.activada, `La sección "Capacitación" no quedó activa para "${nombreEmpleado}".`);

    const filas = await detalle.leerFilasCapacitacion();
    if (!filas.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ninguna Capacitación registrada — no hay nada que editar. ` +
          `(Precondición del escenario: se esperaba al menos una fila en la sección "Capacitación".)`
      );
    }

    // Fila objetivo: por nombre dirigido, o la primera.
    let objetivo = 0;
    let nombreCapOriginal = filas[0].Nombre;
    if (capacitacionDirigida) {
      const idx = filas.findIndex((f) => String(f.Nombre || '').trim().toLowerCase() === capacitacionDirigida.trim().toLowerCase());
      if (idx < 0) {
        assert.fail(
          `${CASO}: "${nombreEmpleado}" no tiene una Capacitación llamada "${capacitacionDirigida}". ` +
            `Capacitaciones: ${JSON.stringify(filas.map((f) => f.Nombre))}.`
        );
      }
      objetivo = capacitacionDirigida;
      nombreCapOriginal = filas[idx].Nombre;
    }
    logger.info(`${CASO}: editando la Capacitación "${nombreCapOriginal}" de "${nombreEmpleado}"`);

    const form = await detalle.abrirEditarCapacitacion(objetivo);
    const tf = await form.tituloForm();
    assert.ok(/editar/i.test(tf), `Se esperaba el form "Editar capacitación" (título leído: "${tf}").`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Editar Capacitación ANTES - "${nombreCapOriginal}"` });

    // Cambios: dirigidos desde el Panel, o default QA en 2 textboxes simples.
    const cambios = {};
    for (const label of Object.keys(CapacitacionFormPage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined && dirigido !== '') cambios[label] = dirigido;
    }
    if (!Object.keys(cambios).length) {
      const marca = `Editado QA ${Date.now().toString().slice(-6)}`;
      cambios.Descripción = marca;
      cambios.Facilitador = marca;
    }
    logger.info(`${CASO}: cambios -> ${JSON.stringify(cambios)}`);
    await form.completar(cambios, { autofill: false });

    // Confirma que los cambios QUEDARON escritos en el form antes de Guardar
    // (evita un "guardado exitoso" que en realidad no cambió nada).
    const enForm = {};
    for (const label of Object.keys(cambios)) enForm[label] = await form.form.getValor(label).catch(() => '(?)');
    logger.info(`${CASO}: valores en el form tras completar -> ${JSON.stringify(enForm)}`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Editar Capacitación con cambios cargados - "${nombreCapOriginal}"` });
    for (const [label, valor] of Object.entries(cambios)) {
      assertTextoIgual(
        String(enForm[label]),
        String(valor),
        `El campo "${label}" no quedó cargado con "${valor}" antes de Guardar (quedó "${enForm[label]}").`
      );
    }

    const res = await form.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Editar Capacitación DESPUÉS de Guardar - "${nombreCapOriginal}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba edición exitosa de la Capacitación "${nombreCapOriginal}" para "${nombreEmpleado}" ` +
        `(form cerrado=${res.cerrado}, notify="${res.notify}"). Cambios: ${JSON.stringify(cambios)}.`
    );

    // --- Verificación: reabrir el form de edición y releer los campos ---
    // (mismo criterio que `editar-paquete-salarial`: releer desde el mismo
    // form ya validado, no desde el grid — el grid de esta sección refresca de
    // forma inconsistente tras un edit inline).
    const nombreFinal = cambios.Nombre || nombreCapOriginal;
    await detalle.abrirSeccion('Capacitación');
    await detalle.esperarTituloContenido('Capacitación');
    const form2 = await detalle.abrirEditarCapacitacion(nombreFinal);
    const finales = {};
    for (const label of Object.keys(cambios)) {
      finales[label] = await form2.form.esperarValor(label, String(cambios[label])).catch(async () => form2.form.getValor(label));
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Capacitación reabierta tras editar - "${nombreFinal}"` });

    for (const [label, valor] of Object.entries(cambios)) {
      assertTextoIgual(
        String(finales[label]),
        String(valor),
        `El campo "${label}" de la Capacitación no persistió en "${valor}" (quedó "${finales[label]}").`
      );
    }
    logger.info(`${CASO}: verificado (form reabierto) -> ${JSON.stringify(finales)}`);
  });
});
