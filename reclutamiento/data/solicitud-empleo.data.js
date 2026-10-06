/**
 * Valores QA por defecto para los campos de "Crear Solicitud de Empleo" que
 * la app exige (asterisco) pero que `TextInputStrategy` NO completa sola
 * cuando no se provee un valor explícito: a diferencia de un selectbox, un
 * campo de texto libre no tiene "primera opción" razonable, así que sin
 * valor simplemente no toca el control (ver
 * `core/strategies/builtinStrategies.js#TextInputStrategy`).
 *
 * Sin esto, "modo automático" (sin dirigir nada desde el Execution Context
 * y sin autollenado de empleado interno, ej. solicitante externo) deja esos
 * campos vacíos y la app bloquea el Guardar por campos requeridos sin
 * completar — el bug reportado ("no llena los campos requeridos en modo
 * automático"). Mismo criterio ya usado en `empleados/support/datosQA.js`.
 *
 * Los datos vienen de `core/utils/datosPrueba.js` (únicos donde la app lo exige).
 */
const { datosBasicosQA } = require('../../empleados/support/datosQA');
const datosPrueba = require('@triple/core/utils/datosPrueba');

function datosQA() {
  // Persona única por ejecución (la app exige nombre distinto por candidato/
  // empleado), generada por el generador del Core — ya no `QA<timestamp>`.
  const persona = datosPrueba.personaUnica();
  return {
    'Primer Nombre': persona.primerNombre,
    'Segundo Nombre': persona.segundoNombre,
    'Primer Apellido': persona.primerApellido,
    'Segundo Apellido': persona.segundoApellido,
    // Solo dígitos: mismo criterio que los editores enmascarados de teléfono
    // de Empleados (con guiones la máscara puede desalinearse).
    Celular: datosPrueba.celular(),
    Correo: datosPrueba.correo(persona),
  };
}

/**
 * Datos ÚNICOS por ejecución para crear un solicitante/empleado nuevo sin
 * colisionar con corridas anteriores: Identificación (reutiliza el generador de
 * `empleados/support/datosQA.js`, 11 dígitos formato cédula), Primer Nombre,
 * Correo y Celular. Se llama UNA vez por flujo y se conserva el resultado en
 * una variable para reutilizarlo al buscar/consultar lo creado.
 */
function datosUnicosQA() {
  return { ...datosQA(), Identificación: datosBasicosQA().Identificación };
}

module.exports = { datosQA, datosUnicosQA };
