/** Ver `campos-editar-datos-basicos.js` — mismo criterio, filtrado a "Datos personales". */
const TODOS = require('./campos-crear-empleado');

module.exports = Object.fromEntries(Object.entries(TODOS).filter(([, v]) => v.seccion === 'Datos personales'));
