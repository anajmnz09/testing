/**
 * Metadata SOLO para el Panel de Control: campos del form de "Editar
 * capacitación" (el MISMO form que "Agregar", abierto por el lápiz de la
 * columna "Acción"). Mismos requeridos: "Nombre" y "Fecha de inicio".
 *
 * NO es Input Model ni afecta la ejecución (mismo criterio que
 * `campos-crear-empleado.js` / `campos-agregar-capacitacion.js`).
 */
module.exports = {
  Nombre: { seccion: 'Capacitación', requerido: true },
  Descripción: { seccion: 'Capacitación', requerido: false },
  Centro: { seccion: 'Capacitación', requerido: false },
  Facilitador: { seccion: 'Capacitación', requerido: false },
  Costo: { seccion: 'Capacitación', requerido: false },
  'Inversión Empresa': { seccion: 'Capacitación', requerido: false },
  'Fecha de inicio': { seccion: 'Capacitación', requerido: true },
  'Fecha finalización': { seccion: 'Capacitación', requerido: false },
  'Cantidad Horas': { seccion: 'Capacitación', requerido: false },
  Frecuencia: { seccion: 'Capacitación', requerido: false },
};
