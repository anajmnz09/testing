/**
 * Datos de prueba del módulo Requisiciones.
 *
 * Filosofía (según lo pedido): usar datos reales del sistema siempre que se
 * pueda (los catálogos — Puesto, Sucursal, Departamento, etc. — se eligen en
 * vivo desde el formulario, tomando la primera opción válida). Aquí solo viven
 * los datos genéricos coherentes (textos) y la configuración de los casos.
 */

const datosPrueba = require('@triple/core/utils/datosPrueba');

// Nombre de requisición único y relacionado con el Puesto del test
// ("Analista de RRHH - Proyecto Aurora K3X9A", máx. 45 caracteres). Sin Puesto conocido usa un
// nombre genérico. `caso` se conserva por compatibilidad de firma.
function nombreQA(caso, puesto) {
  return datosPrueba.nombreRequisicion(puesto);
}

module.exports = {
  nombreQA,
  // Cantidad de empleados a probar en crear-req-persona-sustituir
  // (detección del bug de "Persona(s) a sustituir").
  maxEmpleadosPersonaSustituir: 10,
  // Texto para crear-req-pregunta-personalizada.
  preguntaPersonalizada: {
    pregunta: '¿Cuenta con disponibilidad inmediata? (QA automatizado)',
    nombreCampo: 'qa_disponibilidad',
  },
  // Comentario para crear-req-comentarios.
  // Comentario dinámico (no único) para crear-req-comentarios/agregar-comentario.
  comentario: (puesto) => datosPrueba.texto('comentario', { puesto }),
};
