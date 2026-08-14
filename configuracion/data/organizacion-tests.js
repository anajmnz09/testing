/**
 * Organización de los tests de este módulo para el Panel de Control (mismo
 * criterio que `reclutamiento/data/organizacion-tests.js`): agrupa cada CASO
 * por Sección y luego por Categoría.
 *
 * Acá la Sección es "Administración" y la Categoría es el NOMBRE de la
 * entidad (Sucursales, Departamentos, …) — mirroring la navegación real de
 * la app (Configuración > Administración > <Entidad>, ver
 * `ConfiguracionesPage.irA`), a pedido explícito: los tests de cada entidad
 * quedan sueltos dentro de su propia categoría, sin subcarpetas por acción
 * (Consultar/Crear/Editar).
 */
module.exports = {
  'consultar-sucursal': {
    seccion: 'Administración',
    categoria: 'Sucursales',
    descripcion: 'Abre el detalle de una Sucursal ya existente desde Configuración > Administración > Sucursales.',
  },
  'crear-sucursal': {
    seccion: 'Administración',
    categoria: 'Sucursales',
    descripcion: 'Crea una Sucursal nueva completando su formulario en Configuración > Administración > Sucursales.',
  },
  'editar-sucursal': {
    seccion: 'Administración',
    categoria: 'Sucursales',
    descripcion: 'Edita 2-3 campos de una Sucursal ya existente y confirma el cambio consultándola antes y después.',
  },
  'consultar-departamento': {
    seccion: 'Administración',
    categoria: 'Departamentos',
    descripcion: 'Abre el detalle de un Departamento ya existente desde Configuración > Administración > Departamentos.',
  },
  'crear-departamento': {
    seccion: 'Administración',
    categoria: 'Departamentos',
    descripcion:
      'Crea un Departamento nuevo completando su formulario en Configuración > Administración > Departamentos (sin la sección "Distribución Centro Costo").',
  },
  'editar-departamento': {
    seccion: 'Administración',
    categoria: 'Departamentos',
    descripcion: 'Edita un Departamento ya existente y confirma el cambio consultándolo antes y después.',
  },
  'consultar-puesto': {
    seccion: 'Administración',
    categoria: 'Puestos',
    descripcion: 'Abre el detalle de un Puesto ya existente desde Configuración > Administración > Puestos.',
  },
  'crear-puesto': {
    seccion: 'Administración',
    categoria: 'Puestos',
    descripcion:
      'Crea un Puesto nuevo completando su formulario en Configuración > Administración > Puestos (sin el tabview "Beneficios"/"Documentos").',
  },
  'editar-puesto': {
    seccion: 'Administración',
    categoria: 'Puestos',
    descripcion: 'Edita un Puesto ya existente y confirma el cambio consultándolo antes y después.',
  },
  'consultar-horario': {
    seccion: 'Administración',
    categoria: 'Horarios',
    descripcion:
      'Abre el detalle de un Horario existente (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'crear-horario': {
    seccion: 'Administración',
    categoria: 'Horarios',
    descripcion:
      'Crea un Horario nuevo completando su formulario en Configuración > Administración > Horarios ("Jornada diaria" se calcula sola, no se completa).',
  },
  'editar-horario': {
    seccion: 'Administración',
    categoria: 'Horarios',
    descripcion:
      'Edita un Horario existente y confirma el cambio consultándolo antes y después (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'consultar-grado-academico': {
    seccion: 'Administración',
    categoria: 'Grados Académicos',
    descripcion:
      'Abre el popup de consulta de un Grado Académico existente (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'crear-grado-academico': {
    seccion: 'Administración',
    categoria: 'Grados Académicos',
    descripcion: 'Crea un Grado Académico nuevo mediante el popup "Crear" en Configuración > Administración > Grados Académicos.',
  },
  'editar-grado-academico': {
    seccion: 'Administración',
    categoria: 'Grados Académicos',
    descripcion:
      'Edita el popup de un Grado Académico existente y confirma el cambio consultándolo antes y después (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'consultar-beneficio': {
    seccion: 'Administración',
    categoria: 'Beneficios',
    descripcion: 'Abre el detalle de un Beneficio ya existente desde Configuración > Administración > Beneficios.',
  },
  'crear-beneficio': {
    seccion: 'Administración',
    categoria: 'Beneficios',
    descripcion: 'Crea un Beneficio nuevo completando su formulario en Configuración > Administración > Beneficios.',
  },
  'editar-beneficio': {
    seccion: 'Administración',
    categoria: 'Beneficios',
    descripcion: 'Edita un Beneficio ya existente y confirma el cambio consultándolo antes y después.',
  },
  'consultar-habilidad': {
    seccion: 'Empleados',
    categoria: 'Habilidades',
    descripcion:
      'Abre el popup de consulta de una Habilidad existente (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente la primera del listado).',
  },
  'crear-habilidad': {
    seccion: 'Empleados',
    categoria: 'Habilidades',
    descripcion: 'Crea una Habilidad nueva mediante el popup "Crear" en Configuración > Empleados > Habilidades.',
  },
  'editar-habilidad': {
    seccion: 'Empleados',
    categoria: 'Habilidades',
    descripcion:
      'Edita el popup de una Habilidad existente y confirma el cambio consultándolo antes y después (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente la primera del listado).',
  },
  'consultar-plan-de-seguro': {
    seccion: 'Empleados',
    categoria: 'Planes de seguros',
    descripcion:
      'Abre el detalle de un Plan de seguro existente (dirigible por nombre desde el Panel; el buscador es inestable en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'crear-plan-de-seguro': {
    seccion: 'Empleados',
    categoria: 'Planes de seguros',
    descripcion: 'Crea un Plan de seguro nuevo completando su formulario en Configuración > Empleados > Planes de seguros.',
  },
  'editar-plan-de-seguro': {
    seccion: 'Empleados',
    categoria: 'Planes de seguros',
    descripcion:
      'Edita un Plan de seguro existente y confirma el cambio consultándolo antes y después (dirigible por nombre desde el Panel; el buscador es inestable en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'consultar-razon-salida': {
    seccion: 'Empleados',
    categoria: 'Razones de Salidas',
    descripcion: 'Abre el detalle de una Razón de Salida ya existente desde Configuración > Empleados > Razones de Salidas.',
  },
  'crear-razon-salida': {
    seccion: 'Empleados',
    categoria: 'Razones de Salidas',
    descripcion:
      'Crea una Razón de Salida nueva completando su formulario en Configuración > Empleados > Razones de Salidas (sin la sección "Derechos Adquiridos").',
  },
  'editar-razon-salida': {
    seccion: 'Empleados',
    categoria: 'Razones de Salidas',
    descripcion: 'Edita una Razón de Salida ya existente y confirma el cambio consultándola antes y después.',
  },
  'consultar-proveedor-seguro': {
    seccion: 'Empleados',
    categoria: 'Proveedores de seguros',
    descripcion:
      'Abre el detalle de un Proveedor de seguros existente (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'crear-proveedor-seguro': {
    seccion: 'Empleados',
    categoria: 'Proveedores de seguros',
    descripcion: 'Crea un Proveedor de seguros nuevo completando su formulario en Configuración > Empleados > Proveedores de seguros.',
  },
  'editar-proveedor-seguro': {
    seccion: 'Empleados',
    categoria: 'Proveedores de seguros',
    descripcion:
      'Edita un Proveedor de seguros existente y confirma el cambio consultándolo antes y después (dirigible por nombre desde el Panel; el buscador está roto en el ambiente actual, así que sin nombre dirigido usa automáticamente el primero del listado).',
  },
  'consultar-banco': {
    seccion: 'Empleados',
    categoria: 'Bancos',
    descripcion: 'Abre el detalle de un Banco ya existente desde Configuración > Empleados > Bancos.',
  },
  'crear-banco': {
    seccion: 'Empleados',
    categoria: 'Bancos',
    descripcion: 'Crea un Banco nuevo completando su formulario en Configuración > Empleados > Bancos.',
  },
  'editar-banco': {
    seccion: 'Empleados',
    categoria: 'Bancos',
    descripcion: 'Edita un Banco ya existente y confirma el cambio consultándolo antes y después.',
  },
};
