/**
 * Organización de los tests de este módulo para el Panel de Control — mismo
 * criterio que `reclutamiento/data/organizacion-tests.js`/
 * `configuracion/data/organizacion-tests.js`: agrupa cada CASO (nombre =
 * archivo `tests/<nombre>.test.js`, sin la extensión) por Sección de la app
 * y luego por Categoría. Como la sección 'Empleados' lleva el nombre del módulo, sus categorías cuelgan directo del módulo: Crear (solo crear-empleado), Dependientes, Resumen-CV, Consultar, Editar, junto a la carpeta plana Capacitación. No hay una categoría genérica 'Agregar': cada test va con su funcionalidad.
 *
 * `plano: true` en vez de `categoria`: la sección se muestra como UNA carpeta
 * con sus casos al mismo nivel, sin subcarpetas por categoría — para una
 * sección acotada (ej. "Capacitación", carpeta propia dentro de Empleados)
 * donde separar Crear/Consultar/Editar estorba. Ver
 * `panel/anfitrion/descubridor.js#nodoModulo`.
 *
 * Un caso SIN entrada acá es un test de FLUJO, no de una función de negocio
 * puntual: no aparece agrupado en el árbol del Panel (sigue existiendo y
 * siendo ejecutable por consola).
 */
module.exports = {
  'crear-empleado': {
    seccion: 'Empleados',
    categoria: 'Crear',
    descripcion:
      'Crea un Empleado completando Datos básicos, Datos personales y Recursos humanos (Datos básicos RH + Paquete salarial). No incluye foto ni Herramientas/Beneficios.',
  },
  'consultar-empleado': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre el detalle (panel lateral) de un Empleado ya existente.',
  },
  'consultar-datos-basicos': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Datos básicos" del detalle de un Empleado ya existente.',
  },
  'consultar-resumen-cv': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Resumen/CV" del detalle de un Empleado ya existente.',
  },
  'consultar-datos-personales': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Datos personales" del detalle de un Empleado ya existente.',
  },
  'consultar-capacitacion': {
    seccion: 'Capacitación',
    plano: true,
    descripcion: 'Abre la sección "Capacitación" del detalle de un Empleado ya existente y verifica el título de la página.',
  },
  'consultar-dependientes': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Dependientes" del detalle de un Empleado ya existente.',
  },
  'crear-dependiente': {
    seccion: 'Empleados',
    categoria: 'Dependientes',
    descripcion:
      'Agrega un Dependiente a un Empleado ya existente, en la sección "Dependientes" del detalle. Requeridos: Parentesco, Tipo ID, Identificación, Nombres, Apellidos, Género y Fecha de nacimiento.',
  },
  'consultar-amonestaciones': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Amonestaciones" del detalle de un Empleado ya existente.',
  },
  'consultar-herramientas': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Herramientas" del detalle de un Empleado ya existente.',
  },
  'consultar-ausencias': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Ausencias" del detalle de un Empleado ya existente.',
  },
  'consultar-acciones': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Acciones" del detalle de un Empleado ya existente.',
  },
  'consultar-datos-basicos-rh': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Datos básicos RH" (dentro de "Recursos humanos") del detalle de un Empleado ya existente.',
  },
  'consultar-paquete-salarial': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Paquete salarial" (dentro de "Recursos humanos") del detalle de un Empleado ya existente.',
  },
  'consultar-beneficios': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Beneficios" (dentro de "Recursos humanos") del detalle de un Empleado ya existente.',
  },
  'consultar-prestamos': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Préstamos" (dentro de "Recursos humanos") del detalle de un Empleado ya existente.',
  },
  'consultar-seguros': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Seguros" (dentro de "Recursos humanos") del detalle de un Empleado ya existente.',
  },
  'consultar-centro-de-costo': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Centro de Costo" (dentro de "Recursos humanos") del detalle de un Empleado ya existente.',
  },
  'consultar-analisis-medicos': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Análisis médicos" (dentro de "Documentos") del detalle de un Empleado ya existente.',
  },
  'consultar-contratos': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Contratos" (dentro de "Documentos") del detalle de un Empleado ya existente.',
  },
  'consultar-otros-documentos': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Otros Documentos" (dentro de "Documentos") del detalle de un Empleado ya existente.',
  },
  'consultar-cartas': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Cartas" (dentro de "Documentos") del detalle de un Empleado ya existente.',
  },
  'consultar-cartas-pendientes': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Cartas Pendientes" (dentro de "Documentos") del detalle de un Empleado ya existente.',
  },
  'consultar-dimensiones-financieras': {
    seccion: 'Empleados',
    categoria: 'Consultar',
    descripcion: 'Abre la sección "Dimensiones financieras" (dentro de "Interfaces" > "Dynamics 365") del detalle de un Empleado ya existente.',
  },
  'editar-datos-basicos': {
    seccion: 'Empleados',
    categoria: 'Editar',
    descripcion: 'Edita la sección "Datos básicos" de un Empleado ya existente (Editar Empleado, por sección).',
  },
  'editar-datos-personales': {
    seccion: 'Empleados',
    categoria: 'Editar',
    descripcion: 'Edita la sección "Datos personales" de un Empleado ya existente (Editar Empleado, por sección).',
  },
  'editar-datos-basicos-rh': {
    seccion: 'Empleados',
    categoria: 'Editar',
    descripcion: 'Edita la sección "Datos básicos RH" (dentro de "Recursos humanos") de un Empleado ya existente (Editar Empleado, por sección).',
  },
  'editar-paquete-salarial': {
    seccion: 'Empleados',
    categoria: 'Editar',
    descripcion: 'Edita la sección "Paquete salarial" (dentro de "Recursos humanos") de un Empleado ya existente (Editar Empleado, por sección).',
  },
  'agregar-educacion': {
    seccion: 'Empleados',
    categoria: 'Resumen-CV',
    descripcion: 'Agrega una entrada de Educación en "Resumen/CV" (Educación y experiencia) de un Empleado ya existente.',
  },
  'agregar-experiencia': {
    seccion: 'Empleados',
    categoria: 'Resumen-CV',
    descripcion: 'Agrega una entrada de Experiencia en "Resumen/CV" (Educación y experiencia) de un Empleado ya existente.',
  },
  'agregar-habilidad': {
    seccion: 'Empleados',
    categoria: 'Resumen-CV',
    descripcion: 'Agrega una Habilidad en "Resumen/CV" de un Empleado ya existente.',
  },
  'agregar-capacitacion': {
    seccion: 'Capacitación',
    plano: true,
    descripcion:
      'Agrega una entrada de "Capacitación" (sección del sidemenu del detalle) a un Empleado ya existente: abre la sección, presiona "Agregar", llena el formulario y Guarda. Requeridos: Nombre y Fecha de inicio.',
  },
  'editar-capacitacion': {
    seccion: 'Capacitación',
    plano: true,
    descripcion:
      'Edita una Capacitación de un Empleado por el lápiz de la columna "Acción" (abre el mismo form que Agregar, precargado). Auto: primera fila; Panel: empleado + nombre de capacitación opcional. Cambia datos y Guarda.',
  },
  'adjuntar-capacitacion': {
    seccion: 'Capacitación',
    plano: true,
    descripcion:
      'Adjunta un documento a una Capacitación por el ícono de clip de la columna "Acción" (pantalla propia titulada con el nombre de la capacitación). Usa un PDF genérico; Panel: empleado + nombre de capacitación opcional.',
  },
  'eliminar-capacitacion': {
    seccion: 'Capacitación',
    plano: true,
    descripcion:
      'Elimina una Capacitación de un Empleado por checkbox + botón "Eliminar" + confirmar. Auto: primera fila; Panel: empleado + nombre de capacitación opcional.',
  },
  'eliminar-documento-capacitacion': {
    seccion: 'Capacitación',
    plano: true,
    descripcion:
      'Elimina un documento adjunto de una Capacitación por checkbox + botón "Eliminar" + confirmar. Auto: primera capacitación y primer documento (sube uno si no hay); Panel: empleado + capacitación + documento, todos opcionales.',
  },
  'descargar-documento-capacitacion': {
    seccion: 'Capacitación',
    plano: true,
    descripcion:
      'Descarga un documento adjunto de una Capacitación por el ícono de la última columna del grid (sin título). Auto: primera capacitación y primer documento (sube uno si no hay); Panel: empleado + capacitación + documento, todos opcionales. Bloqueo de permiso conocido: "No estás autorizado" — se espera que este caso falle hasta que se otorgue el permiso.',
  },
};
