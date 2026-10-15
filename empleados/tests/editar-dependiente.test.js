const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const datos = require('@triple/core/utils/datos');
const fixtures = require('../support/fixtures');
const DependienteFormPage = require('../pages/DependienteFormPage');

const CASO = 'editar-dependiente';
const CLAVE_EMPLEADO = 'Nombre de Empleado con el Dependiente';
const CLAVE_DEPENDIENTE = 'Identificación o nombre del Dependiente a editar (opcional)';
testContext.registrarCasoDesdeFormulario(CASO, DependienteFormPage.ESTRATEGIAS, [CLAVE_EMPLEADO, CLAVE_DEPENDIENTE]);

/**
 * Edita un Dependiente de un Empleado por el ícono "Editar" de la columna "Acción" del listado de la sección "Dependientes"
 * (abre el MISMO form inline que "Agregar", precargado).
 *
 * AUTOMÁTICO por defecto: sin dirección del Panel elige el PRIMER empleado del listado y el PRIMER dependiente de ese empleado.
 * Se puede dirigir el empleado, el dependiente (por identificación o nombre exacto) o ambos. Si el empleado no tiene dependientes
 * el test FALLA (precondición no cumplida, no "se omite").
 *
 * Cambios: los campos que el Panel dirija; si no dirige ninguno, valores nuevos de Nombres, Apellidos y Discapacidad tomados de la
 * fuente común (`core/utils/datos`, reproducible con DATOS_SEMILLA). NO se toca "Identificación" en automático: es la clave para
 * volver a ubicar la fila y verificar.
 */
describe('Empleados - Editar Dependiente', function () {
  this.timeout(300000);
  // No idempotente (cambia el registro que luego se busca): un reintento global no sería equivalente.
  this.retries(0);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: edita un Dependiente existente y confirma el cambio`, async function () {
    const empleadoDirigido = testContext.get(CASO, CLAVE_EMPLEADO);
    const dependienteDirigido = testContext.get(CASO, CLAVE_DEPENDIENTE);
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

    const abierta = await detalle.abrirSeccion('Dependientes');
    const titulo = await detalle.esperarTituloContenido('Dependientes');
    assert.ok(titulo.coincide, `El área de título no muestra "Dependientes" (empleado: "${nombreEmpleado}"). Vistos: ${JSON.stringify(titulo.vistos)}.`);
    assert.ok(abierta.activada, `La sección "Dependientes" no quedó activa para "${nombreEmpleado}".`);

    const filas = await detalle.leerFilasDependientes();
    if (!filas.length) {
      assert.fail(
        `${CASO}: el empleado "${nombreEmpleado}" no tiene ningún Dependiente registrado — no hay nada que editar. ` +
          `(Precondición del escenario: se esperaba al menos una fila en la sección "Dependientes".)`
      );
    }
    const objetivo = dependienteDirigido || 0;
    const indice = detalle._indiceDependiente(filas, objetivo);
    if (indice < 0) {
      assert.fail(
        `${CASO}: "${nombreEmpleado}" no tiene un Dependiente "${dependienteDirigido}". ` +
          `Dependientes: ${JSON.stringify(filas.map((f) => `${f['Identificación']} (${f.Nombre})`))}.`
      );
    }
    const original = filas[indice];
    const idOriginal = original['Identificación'];
    logger.info(`${CASO}: editando el Dependiente "${original.Nombre}" (Identificación ${idOriginal}) de "${nombreEmpleado}"`);

    const form = await detalle.abrirEditarDependiente(objetivo);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Editar Dependiente ANTES - "${original.Nombre}"` });

    // Cambios: lo que el Panel dirija; si no dirige nada, textos nuevos de la fuente común.
    const cambios = {};
    for (const label of Object.keys(DependienteFormPage.ESTRATEGIAS)) {
      const dirigido = testContext.get(CASO, label);
      if (dirigido !== undefined && dirigido !== '' && dirigido !== false) cambios[label] = dirigido;
    }
    if (!Object.keys(cambios).length) {
      Object.assign(cambios, datos.deFormulario(CASO, DependienteFormPage.ESTRATEGIAS, { solo: ['Nombres', 'Apellidos', 'Discapacidad'] }));
    }
    logger.info(`${CASO}: cambios -> ${JSON.stringify(cambios)}`);
    await form.completar(cambios, { autofill: false });

    const enForm = {};
    for (const label of Object.keys(cambios)) enForm[label] = await form.form.getValor(label).catch(() => '(?)');
    await evidence.attachScreenshot(ctx.driver, this, { label: `Editar Dependiente con cambios cargados - "${original.Nombre}"` });
    for (const [label, valor] of Object.entries(cambios)) {
      assertTextoIgual(String(enForm[label]), String(valor), `El campo "${label}" no quedó cargado con "${valor}" antes de Guardar (quedó "${enForm[label]}").`);
    }

    const res = await form.guardar();
    await evidence.attachScreenshot(ctx.driver, this, { label: `Editar Dependiente DESPUÉS de Guardar - "${original.Nombre}"` });
    assert.ok(
      res.exito && !res.invalido,
      `Se esperaba edición exitosa del Dependiente ${idOriginal} de "${nombreEmpleado}" (form cerrado=${res.cerrado}, notify="${res.notify}"). Cambios: ${JSON.stringify(cambios)}.`
    );

    // Verificación: reabrir el form de edición por la identificación (la nueva si se cambió) y releer cada campo cambiado.
    const idFinal = cambios.Identificación ? String(cambios.Identificación).replace(/\D/g, '') : idOriginal;
    await detalle.abrirSeccion('Dependientes');
    await detalle.esperarTituloContenido('Dependientes');
    const form2 = await detalle.abrirEditarDependiente(idFinal);
    const finales = {};
    for (const label of Object.keys(cambios)) {
      if (label === 'Identificación') continue; // editor enmascarado: ya se ubicó la fila con ella
      finales[label] = await form2.form.esperarValor(label, String(cambios[label])).catch(async () => form2.form.getValor(label));
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Dependiente reabierto tras editar - "${idFinal}"` });
    for (const [label, valor] of Object.entries(finales)) {
      assertTextoIgual(String(valor), String(cambios[label]), `El campo "${label}" del Dependiente no persistió en "${cambios[label]}" (quedó "${valor}").`);
    }
    logger.info(`${CASO}: verificado (form reabierto) -> ${JSON.stringify(finales)}`);
  });
});
