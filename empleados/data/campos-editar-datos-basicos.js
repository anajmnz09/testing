/**
 * Metadata SOLO para el Panel (agrupación por sección + asterisco de
 * requerido) — ver `panel/anfitrion/contexto.js#camposCaso` y
 * `campos-crear-empleado.js` (misma fuente de verdad de campos/requeridos,
 * es el MISMO formulario que "Crear Empleado"). Filtrado a la sección
 * "Datos básicos" únicamente — este caso solo edita esa sección.
 */
const TODOS = require('./campos-crear-empleado');

module.exports = Object.fromEntries(Object.entries(TODOS).filter(([, v]) => v.seccion === 'Datos básicos'));
