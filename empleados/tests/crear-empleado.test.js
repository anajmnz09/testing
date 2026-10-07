const assert = require('assert');
const { testContext } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const EmpleadoFormPage = require('../pages/EmpleadoFormPage');
const datosQA = require('../support/datosQA');

const CASO = 'crear-empleado';

// Input Model: se siembran en el Execution Context TODOS los controles
// editables de las 4 secciones cubiertas (labels reales, una fuente de
// verdad por sección en EmpleadoFormPage). "Herramientas", "Beneficios" y la
// foto quedan FUERA de esta iteración a propósito (no las pidió el usuario;
// la foto se cubre en un test aparte, mismo criterio que Usuario/Solicitud).
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_DATOS_BASICOS);
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_DATOS_PERSONALES);
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_RH_DATOS_BASICOS);
testContext.registrarCasoDesdeFormulario(CASO, EmpleadoFormPage.ESTRATEGIAS_RH_PAQUETE_SALARIAL);

/** Combina Execution Context (prioridad) + defaults QA para los campos de texto/fecha de una sección. */
function valoresSeccion(defaultsQA) {
  const valores = {};
  for (const label of Object.keys(defaultsQA)) {
    valores[label] = testContext.get(CASO, label) || defaultsQA[label];
  }
  return valores;
}

/**
 * Crea un Empleado completando "Datos básicos" (sin la foto), "Datos
 * personales" y, dentro de "Recursos humanos", "Datos básicos RH" y
 * "Paquete salarial" — en ese orden, sin guardar hasta completar las 4.
 * Selectbox sin valor dirigido: PRIMERA opción disponible (modo automático).
 * Texto/fecha sin valor dirigido: valor QA (ver `support/datosQA.js`).
 */
describe('Empleados - Crear Empleado', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoEmpleados();

  it(`${CASO}: crea un Empleado completando Datos básicos, Datos personales y Recursos humanos`, async function () {
    const form = await ctx.lista.crear();

    // --- Datos básicos (sección activa por defecto) ---
    const valoresBasicos = valoresSeccion(datosQA.datosBasicosQA());
    await form.cascadaIdentificacion(testContext.get(CASO, 'Tipo ID'), valoresBasicos['Identificación']);
    await form.completarSeccion(EmpleadoFormPage.ESTRATEGIAS_DATOS_BASICOS, valoresBasicos, {
      excepto: ['Identificación'],
    });
    logger.info(`${CASO}: "Datos básicos" completado`);

    // --- Datos personales ---
    await form.irADatosPersonales();
    const valoresPersonales = valoresSeccion(datosQA.datosPersonalesQA());
    await form.cascadaDireccion({
      pais: testContext.get(CASO, 'País'),
      ciudad: testContext.get(CASO, 'Ciudad'),
      sector: testContext.get(CASO, 'Sector'),
      calle: valoresPersonales['Calle'],
    });
    await form.completarSeccion(EmpleadoFormPage.ESTRATEGIAS_DATOS_PERSONALES, valoresPersonales, {
      excepto: ['Ciudad', 'Sector', 'Calle'],
    });
    logger.info(`${CASO}: "Datos personales" completado`);

    // --- Recursos humanos > Datos básicos RH ---
    await form.irARecursosHumanos('Datos básicos RH');
    const valoresRHBasicos = valoresSeccion(datosQA.rhDatosBasicosQA());
    // "Fecha finalización"/"Fecha de salida"/"Banco"/"Tipo de cuenta"/
    // "No. cuenta": declarados en ESTRATEGIAS (control real, ver su
    // docblock) pero sin sentido de negocio para autofillear en un alta
    // nueva (fecha de salida/cuenta bancaria de un empleado recién
    // creado) — excluidos acá a propósito, mismo criterio que
    // "Ciudad"/"Sector"/"Calle" arriba.
    await form.completarSeccion(EmpleadoFormPage.ESTRATEGIAS_RH_DATOS_BASICOS, valoresRHBasicos, {
      excepto: ['Fecha finalización', 'Fecha de salida', 'Banco', 'Tipo de cuenta', 'No. cuenta'],
    });
    logger.info(`${CASO}: "Datos básicos RH" completado`);

    // --- Recursos humanos > Paquete salarial (ya expandido, no hace falta reabrir el acordeón) ---
    await form._clickTexto('Paquete salarial');
    const valoresPaqueteSalarial = valoresSeccion(datosQA.rhPaqueteSalarialQA());
    // "Salario" viene PRE-LLENO con "0" (numberbox) — `estaVacio()` lo ve
    // como "ya tiene datos" y `completarSeccion` nunca lo sobreescribe,
    // dejando "0" en un campo requerido que la app rechaza ("Salario es
    // requerido(a)") — confirmado con Selenium real. Se fuerza el valor
    // acá, aparte, ANTES del pase genérico (que lo excluye).
    await form.setCampo(EmpleadoFormPage.ESTRATEGIAS_RH_PAQUETE_SALARIAL, 'Salario', valoresPaqueteSalarial['Salario']);
    await form.completarSeccion(EmpleadoFormPage.ESTRATEGIAS_RH_PAQUETE_SALARIAL, valoresPaqueteSalarial, {
      excepto: ['Salario'],
    });
    logger.info(`${CASO}: "Paquete salarial" completado`);

    // Parche temporal: click neutro + Guardar, con un 2.º intento solo ante el "Internal Error" conocido.
    const res = await form.guardarCreacion();
    assert.ok(res.exito, `Se esperaba creación exitosa de Empleado. Notify: "${res.notify}"`);
  });
});
