/**
 * Datos de prueba del módulo Requisiciones.
 *
 * Filosofía (según lo pedido): usar datos reales del sistema siempre que se
 * pueda (los catálogos — Puesto, Sucursal, Departamento, etc. — se eligen en
 * vivo desde el formulario, tomando la primera opción válida). Aquí solo viven
 * los datos genéricos coherentes (textos) y la configuración de los casos.
 */

// Nombre de requisición único y reconocible (marcador QA + caso + timestamp).
function nombreQA(tc) {
  return `QA-AUTO-${tc}-${Date.now()}`;
}

module.exports = {
  nombreQA,
  // Cantidad de empleados a probar en TC-003 (detección del bug de "Persona a sustituir").
  TC003_MAX_EMPLEADOS: 10,
  // Texto para la pregunta personalizada (TC-005).
  preguntaPersonalizada: {
    pregunta: '¿Cuenta con disponibilidad inmediata? (QA automatizado)',
    nombreCampo: 'qa_disponibilidad',
  },
  // Comentario para TC-006.
  comentario: 'Comentario de prueba automatizada QA.',
};
