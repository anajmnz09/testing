const assert = require('assert');
const { testContext, evidence, assertTextoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const EmpleadoFormPage = require('../pages/EmpleadoFormPage');
const { siguienteNombreQA, armarCambiosDirigidos, aplicarDefaultSiVacio } = require('../support/cambiosEditar');

const CASO = 'editar-datos-basicos';
// Clave de BÚSQUEDA (identifica el Empleado EXISTENTE a editar), separada de
// los campos reales de "Datos básicos" — mismo criterio que el resto de
// "editar-*" del framework (ej. `editar-usuario`).
const CLAVE_BUSQUEDA = 'Nombre de Empleado a editar';
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_DATOS_BASICOS, [CLAVE_BUSQUEDA]);

/**
 * Edita SOLO la sección "Datos básicos" (Datos de Empleado + Acerca del
 * puesto de trabajo) de un Empleado ya existente: abre su detalle, entra a
 * "Editar" (navega a la pantalla completa, mismo componente que "Crear
 * Empleado" mapeado en `EmpleadoFormPage`), aplica los cambios dirigidos
 * desde el Panel (o un default QA si no se dirigió nada) y Guarda.
 *
 * A diferencia de Crear (un solo form navegable entre secciones), Editar es
 * POR SECCIÓN: hay que estar parado en la sección deseada EN MODO CONSULTA
 * (`abrirSeccion`) y desde ahí entrar a "Editar" — confirmado con Selenium
 * real que navegar DENTRO del modo Editar hacia otra sección del sidemenu
 * saca del modo edición (con o sin el popup "¿Desea cambiar la página?" de
 * por medio), así que nunca se usa esa navegación acá. Los campos YA tienen
 * los valores actuales del empleado (no vacíos): se usa `aplicarCambios`
 * (escritura SIEMPRE), nunca `completarSeccion` (que solo llena vacíos,
 * pensado para Crear).
 * Tras Guardar, esta pantalla SÍ muestra notify de éxito ("Empleado editado
 * exitosamente") — a diferencia de Crear, que no muestra ninguno.
 *
 * Verificación REAL: cada campo cambiado se relee de la pantalla después de
 * Guardar y se compara contra el valor efectivamente aplicado (nunca se
 * asume el guardado por la sola ausencia de error).
 */
describe('Empleados - Editar Datos básicos', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: edita la sección "Datos básicos" de un Empleado existente`, async function () {
    const nombreDirigido = testContext.get(CASO, CLAVE_BUSQUEDA);
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

    const abierta = await detalle.abrirSeccion('Datos básicos');
    assert.ok(abierta.activada, `No se pudo activar la sección "Datos básicos" para "${nombreUsado}".`);
    await evidence.attachScreenshot(ctx.driver, this, { label: `Datos básicos ANTES de editar - "${nombreUsado}"` });

    const form = await detalle.editar();

    const cambios = armarCambiosDirigidos(CASO, EmpleadoFormPage.ESTRATEGIAS_DATOS_BASICOS, {
      excluir: [CLAVE_BUSQUEDA],
    });
    await aplicarDefaultSiVacio(cambios, {
      defaults: [
        {
          campo: 'Segundo Nombre',
          valor: async () => siguienteNombreQA(await form.form.getValor('Segundo Nombre')),
        },
      ],
    });

    // Cascada "Tipo ID" -> "Identificación" (la máscara depende del tipo):
    // si se dirige "Tipo ID", forzar también "Identificación" (aunque no se
    // haya dirigido) para que la cascada quede consistente.
    const aplicados = {};
    if (cambios['Tipo ID'] !== undefined) {
      const tipoId = cambios['Tipo ID'];
      const identificacion = cambios['Identificación'];
      delete cambios['Tipo ID'];
      delete cambios['Identificación'];
      await form.cascadaIdentificacion(tipoId, identificacion, { forzar: true });
      aplicados['Tipo ID'] = await form.form.getValor('Tipo ID');
      aplicados['Identificación'] = await form.form.getValor('Identificación');
    }

    logger.info(`${CASO}: editando "${nombreUsado}" -> ${JSON.stringify(cambios)}`);
    Object.assign(aplicados, await form.aplicarCambios(EmpleadoFormPage.ESTRATEGIAS_DATOS_BASICOS, cambios));

    const guardado = await form.guardar();
    const res = await form.resultadoGuardado(guardado);
    assert.ok(res.exito, `Se esperaba edición exitosa de "Datos básicos" para "${nombreUsado}". Notify: "${res.notify}"`);

    // --- Verificación DESPUÉS de editar (evidencia + confirmación real) ---
    // `esperarValor` (poll, no lectura única) evita leer el control justo en
    // el instante en que la pantalla todavía está re-renderizando tras
    // Guardar — mismo criterio que `editar-usuario.test.js`.
    const finales = {};
    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      finales[label] = await form.form.esperarValor(label, valorEsperado);
    }
    await evidence.attachScreenshot(ctx.driver, this, { label: `Datos básicos DESPUÉS de editar - "${nombreUsado}"` });

    for (const [label, valorEsperado] of Object.entries(aplicados)) {
      assertTextoIgual(finales[label], valorEsperado, `"${label}" no quedó en "${valorEsperado}" (quedó "${finales[label]}").`);
    }
    logger.info(`${CASO}: verificado -> ${JSON.stringify(finales)}`);
  });
});
