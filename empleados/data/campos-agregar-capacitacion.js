/**
 * Metadata SOLO para el Panel de Control: marca cuáles campos de
 * `agregar-capacitacion` son REQUERIDOS (asterisco en la app real) y los
 * agrupa bajo la sección "Capacitación".
 *
 * NO es Input Model ni afecta la ejecución del test (mismo criterio y formato
 * que `campos-crear-empleado.js` — ver `panel/anfitrion/contexto.js#camposCaso`).
 *
 * Requeridos confirmados con Selenium real (probe 2026-09-07, form "Agregar"
 * de la sección): SOLO "Nombre" y "Fecha de inicio" llevan
 * `dx-field-item-required` / asterisco; el resto es `dx-field-item-optional`.
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
