/**
 * Organización de los tests de este módulo para el Panel de Control (mismo
 * criterio que `reclutamiento/data/organizacion-tests.js`): agrupa cada CASO
 * por Sección de la app y luego por Categoría (qué hace).
 *
 * `descripcion`: una oración breve de qué hace el test — se muestra en el
 * Panel arriba de "Ejecutar", debajo del título del caso.
 */
module.exports = {
  'asignar-empleado-nomina': {
    seccion: 'Empleados de Nuevo Ingreso',
    categoria: 'Asignar',
    descripcion: 'Asigna uno o varios empleados de "Empleados de Nuevo Ingreso" a una Nómina.',
  },
};
