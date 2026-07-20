/**
 * Datos de prueba del módulo Requisiciones.
 *
 * Filosofía (según lo pedido): usar datos reales del sistema siempre que se
 * pueda (los catálogos — Puesto, Sucursal, Departamento, etc. — se eligen en
 * vivo desde el formulario, tomando la primera opción válida). Aquí solo viven
 * los datos genéricos coherentes (textos) y la configuración de los casos.
 */

// Nombre de requisición único y reconocible: marcador QA + nombre del caso +
// timestamp. Recibe el nombre descriptivo del caso (ej. 'crear-req-comentarios'),
// de modo que el registro creado en la app sea rastreable hasta su test.
function nombreQA(caso) {
  return `QA-${caso}-${Date.now()}`;
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
  comentario: 'Comentario de prueba automatizada QA.',
};
