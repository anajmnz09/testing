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
  'consultar-cuenta-contable': {
    seccion: 'Nómina',
    categoria: 'Cuentas Contables',
    descripcion: 'Abre el detalle de una Cuenta Contable ya existente desde Configuración > Nómina > Cuentas Contables.',
  },
  'crear-cuenta-contable': {
    seccion: 'Nómina',
    categoria: 'Cuentas Contables',
    descripcion: 'Crea una Cuenta Contable nueva completando su formulario en Configuración > Nómina > Cuentas Contables.',
  },
  'editar-cuenta-contable': {
    seccion: 'Nómina',
    categoria: 'Cuentas Contables',
    descripcion:
      'Edita una Cuenta Contable ya existente y confirma el cambio consultándola antes y después (bug de app conocido: Guardar falla siempre con "Ya existe un fila con este campo", ver CuentaContableDetallePage).',
  },
  'consultar-tipo-nomina': {
    seccion: 'Nómina',
    categoria: 'Tipo Nómina',
    descripcion: 'Abre el detalle de un Tipo Nómina ya existente desde Configuración > Nómina > Tipo Nómina.',
  },
  'crear-tipo-nomina': {
    seccion: 'Nómina',
    categoria: 'Tipo Nómina',
    descripcion:
      'Crea un Tipo Nómina nuevo completando su formulario en Configuración > Nómina > Tipo Nómina, incluida la sección obligatoria "Distribución de Pago".',
  },
  'editar-tipo-nomina': {
    seccion: 'Nómina',
    categoria: 'Tipo Nómina',
    descripcion:
      'Edita un Tipo Nómina ya existente y confirma el cambio consultándolo antes y después (bug de app conocido: "Distribución de Pago" queda cargando indefinidamente al Editar, ver TipoNominaDetallePage).',
  },
  'consultar-categoria-actividad': {
    seccion: 'Nómina',
    categoria: 'Categoría Actividades',
    descripcion: 'Abre el detalle de una Categoría de actividad ya existente desde Configuración > Nómina > Categoría de actividades.',
  },
  'crear-categoria-actividad': {
    seccion: 'Nómina',
    categoria: 'Categoría Actividades',
    descripcion: 'Crea una Categoría de actividad nueva completando su formulario en Configuración > Nómina > Categoría de actividades.',
  },
  'editar-categoria-actividad': {
    seccion: 'Nómina',
    categoria: 'Categoría Actividades',
    descripcion: 'Edita una Categoría de actividad ya existente y confirma el cambio consultándola antes y después.',
  },
  'consultar-concepto-nomina': {
    seccion: 'Nómina',
    categoria: 'Concepto de Nómina',
    descripcion: 'Abre el detalle de un Concepto de nómina ya existente desde Configuración > Nómina > Concepto de nómina.',
  },
  'crear-concepto-nomina': {
    seccion: 'Nómina',
    categoria: 'Concepto de Nómina',
    descripcion:
      'Crea un Concepto de nómina nuevo completando su formulario en Configuración > Nómina > Concepto de nómina (sin los tabs "Indicadores"/"Datos Contables e Integración"/"Configuración Horas"/"Otros").',
  },
  'editar-concepto-nomina': {
    seccion: 'Nómina',
    categoria: 'Concepto de Nómina',
    descripcion: 'Edita un Concepto de nómina ya existente y confirma el cambio consultándolo antes y después.',
  },
  'consultar-comportamiento-concepto-nomina': {
    seccion: 'Nómina',
    categoria: 'Comportamiento Concepto Nómina',
    descripcion: 'Abre el detalle de un Comportamiento concepto Nómina ya existente desde Configuración > Nómina > Comportamiento concepto Nómina.',
  },
  'crear-comportamiento-concepto-nomina': {
    seccion: 'Nómina',
    categoria: 'Comportamiento Concepto Nómina',
    descripcion:
      'Crea un Comportamiento concepto Nómina nuevo usando los fixtures fijos "Concepto QA"/"Tipo Nómina QA" (los crea si todavía no existen; ver support/catalogosQA.js).',
  },
  'editar-comportamiento-concepto-nomina': {
    seccion: 'Nómina',
    categoria: 'Comportamiento Concepto Nómina',
    descripcion:
      'Edita un Comportamiento concepto Nómina ya existente y confirma el cambio (solo si el Panel dirige algún campo; sin dirección no hay default automático seguro para esta entidad).',
  },
  'consultar-usuario': {
    seccion: 'Usuarios y permisos',
    categoria: 'Usuarios',
    descripcion: 'Abre el detalle de un Usuario ya existente desde Configuración > Usuarios y permisos > Usuarios.',
  },
  'crear-usuario': {
    seccion: 'Usuarios y permisos',
    categoria: 'Usuarios',
    descripcion:
      'Crea un Usuario nuevo completando su formulario en Configuración > Usuarios y permisos > Usuarios (queda en estado Pendiente, requiere validación por correo). Activa "Es administrador"/"Tiene acceso a RRHH" solo si el Panel lo dirige explícito; también existen tests dedicados a esos switches.',
  },
  'editar-usuario': {
    seccion: 'Usuarios y permisos',
    categoria: 'Usuarios',
    descripcion:
      'Edita un Usuario ya existente y confirma el cambio (incluye "Compañías permitidas", multi-select, y los switches "Es administrador"/"Tiene acceso a RRHH" solo si el Panel los dirige; ignora la sección "Grupos").',
  },
  'agregar-foto-usuario': {
    seccion: 'Usuarios y permisos',
    categoria: 'Usuarios',
    descripcion: 'Sube una foto a un Usuario ya existente (vía modo Editar) y confirma que quedó aplicada.',
  },
  'marcar-usuario-administrador': {
    seccion: 'Usuarios y permisos',
    categoria: 'Usuarios',
    descripcion: 'Activa el switch "Es administrador" de un Usuario ya existente y confirma el cambio.',
  },
  'dar-acceso-rrhh-usuario': {
    seccion: 'Usuarios y permisos',
    categoria: 'Usuarios',
    descripcion: 'Activa el switch "Tiene acceso a RRHH" de un Usuario ya existente y confirma el cambio.',
  },
  'crear-grupo': {
    seccion: 'Usuarios y permisos',
    categoria: 'Grupos',
    descripcion: 'Crea un Grupo nuevo completando su único campo, "Nombre", en Configuración > Usuarios y permisos > Grupos.',
  },
  'consultar-grupo': {
    seccion: 'Usuarios y permisos',
    categoria: 'Grupos',
    descripcion: 'Abre el detalle de un Grupo ya existente desde Configuración > Usuarios y permisos > Grupos.',
  },
  'editar-grupo': {
    seccion: 'Usuarios y permisos',
    categoria: 'Grupos',
    descripcion:
      'Edita "Nombre" y "Descripción" de un Grupo ya existente y confirma el cambio releyendo el listado (sin tocar Miembros ni permisos).',
  },
  'agregar-miembro-grupo': {
    seccion: 'Usuarios y permisos',
    categoria: 'Grupos',
    descripcion:
      'Agrega un miembro (Usuario + Compañías permitidas + Sucursal) a un Grupo ya existente y confirma que aparece en "Miembros del grupo".',
  },
  'agregar-permiso-grupo': {
    seccion: 'Usuarios y permisos',
    categoria: 'Grupos',
    descripcion: 'Agrega un permiso (Módulo + Roles) a un Grupo ya existente y confirma que aparece en "Permisos del grupo".',
  },
};
