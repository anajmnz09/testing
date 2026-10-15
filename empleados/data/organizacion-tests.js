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
      'Agrega un Dependiente a un Empleado ya existente, en la sección "Dependientes" del detalle, llenando TODOS los campos editables (incluido el bloque de seguro y "Dependiente directo"; "Edad" es de solo lectura). Textos autogenerados con la fuente común de datos.',
  },
  'consultar-dependiente': {
    seccion: 'Empleados',
    categoria: 'Dependientes',
    descripcion:
      'Consulta un Dependiente en la sección "Dependientes" del detalle de un Empleado: lee su fila (Parentesco, Tipo ID, Identificación, Nombre, Género, …). Auto: primer empleado y primer dependiente; Panel: empleado y/o dependiente (identificación o nombre).',
  },
  'editar-dependiente': {
    seccion: 'Empleados',
    categoria: 'Dependientes',
    descripcion:
      'Edita un Dependiente por el ícono "Editar" de la columna "Acción". Auto: primer empleado y primer dependiente; Panel: empleado y/o dependiente (identificación o nombre). Cambia datos y Guarda.',
  },
  'eliminar-dependiente': {
    seccion: 'Empleados',
    categoria: 'Dependientes',
    descripcion:
      'Elimina un Dependiente por checkbox + botón "Eliminar" + confirmar. Auto: primer empleado y primer dependiente; Panel: empleado y/o dependiente (identificación o nombre).',
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
  'consultar-herramienta': {
    seccion: 'Herramientas',
    plano: true,
    descripcion:
      'Consulta una Herramienta en la sección "Herramientas" del detalle de un Empleado: lee su fila (Fecha de asignación, Descripción, Referencia, Fecha de Devolución). Auto: primer empleado y primera herramienta; Panel: empleado y/o herramienta.',
  },
  'eliminar-herramienta': {
    seccion: 'Herramientas',
    plano: true,
    descripcion:
      'Elimina una Herramienta por checkbox + botón "Eliminar" + confirmar. Auto: asigna una propia y elimina esa; Panel: empleado y/o herramienta (descripción).',
  },
  'agregar-herramienta': {
    seccion: 'Herramientas',
    plano: true,
    descripcion:
      'Asigna una Herramienta a un Empleado ya existente: "Agregar" abre la pantalla "Crear asignación" (Fecha de asignación, Referencia, Descripción) y Guarda. Textos autogenerados con la fuente común de datos; Panel: empleado y campos.',
  },
  'retornar-herramienta': {
    seccion: 'Herramientas',
    plano: true,
    descripcion:
      'Retorna una Herramienta por Opciones (3 puntos) > Retornar: popup con "Fecha finalización" y Guardar; verifica la "Fecha de Devolución" en el grid. Auto: primera herramienta pendiente (asigna una si no hay); Panel: empleado, herramienta y fecha.',
  },
  'adjuntar-herramienta': {
    seccion: 'Herramientas',
    plano: true,
    descripcion:
      'Adjunta un documento a una Herramienta por Opciones (3 puntos) > Adjuntar (pantalla propia titulada con la descripción). Usa un PDF genérico. Auto: primer empleado y primera herramienta; Panel: empleado y/o herramienta.',
  },
  'descargar-documento-herramienta': {
    seccion: 'Herramientas',
    plano: true,
    descripcion:
      'Descarga un documento adjunto de una Herramienta (ícono de descarga de la pantalla de adjuntos). Auto: primer empleado, primera herramienta y primer documento (sube uno si no hay); Panel: empleado, herramienta y/o documento.',
  },
  'eliminar-documento-herramienta': {
    seccion: 'Herramientas',
    plano: true,
    descripcion:
      'Elimina un documento adjunto de una Herramienta por checkbox + "Eliminar" + confirmar. Auto: sube un documento propio y elimina ese; Panel: empleado, herramienta y/o documento.',
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
  'agregar-seguro': {
    seccion: 'Seguros',
    plano: true,
    descripcion:
      'Asigna un Seguro a un Empleado ya existente (Recursos humanos > Seguros): "Agregar" abre "Agregar Seguro" (Proveedor, Plan, Comentario; Tarifa y porcentajes los calcula la app) y Guarda. Proveedor y plan al azar de un banco de nombres reales entre los que existen en el catálogo; Panel: empleado y campos.',
  },
  'inactivar-seguro': {
    seccion: 'Seguros',
    plano: true,
    descripcion:
      'Inactiva un Seguro por checkbox + botón "Inactivar" y verifica el Estado "Inactivo". Auto: asigna uno propio e inactiva ese; Panel: empleado y/o seguro (por el nombre de su plan).',
  },
  'agregar-beneficio': {
    seccion: 'Beneficios',
    plano: true,
    descripcion:
      'Asigna un Beneficio a un Empleado ya existente (Recursos humanos > Beneficios): "Agregar" abre "Crear Beneficio" (Beneficio, Monto, Comentario, Fecha Inicial/Final) y Guarda. El tipo de beneficio sale al azar de un banco de ~10 (transporte, comida…) entre los que existen en el catálogo; Panel: empleado y campos.',
  },
  'inactivar-beneficio': {
    seccion: 'Beneficios',
    plano: true,
    descripcion:
      'Inactiva un Beneficio por checkbox + botón "Inactivar" y verifica el Estado "Inactivo". Auto: asigna uno propio e inactiva ese; Panel: empleado y/o beneficio (por su comentario).',
  },
  'adjuntar-analisis-medico': {
    seccion: 'Documentos',
    categoria: 'Análisis médicos',
    descripcion:
      'Adjunta un documento en "Análisis médicos" (Documentos) del detalle de un Empleado: "Adjuntar" > popup "Importar Documentos" > Guardar; verifica que el grid lo lista. Usa un PDF genérico. Auto: primer empleado; Panel: empleado y/o archivo.',
  },
  'descargar-analisis-medico': {
    seccion: 'Documentos',
    categoria: 'Análisis médicos',
    descripcion:
      'Descarga un documento de "Análisis médicos" (Documentos) con el ícono de descarga del grid. Auto: primer empleado y primer documento (sube uno si no hay); Panel: empleado y/o documento.',
  },
  'eliminar-analisis-medico': {
    seccion: 'Documentos',
    categoria: 'Análisis médicos',
    descripcion:
      'Elimina un documento de "Análisis médicos" (Documentos) por checkbox + "Eliminar" + confirmar. Auto: sube un documento propio y elimina ese; Panel: empleado y/o documento.',
  },
  'adjuntar-contrato': {
    seccion: 'Documentos',
    categoria: 'Contratos',
    descripcion:
      'Adjunta un documento en "Contratos" (Documentos) del detalle de un Empleado: "Adjuntar" > popup "Importar Documentos" > Guardar; verifica que el grid lo lista. Usa un PDF genérico. Auto: primer empleado; Panel: empleado y/o archivo.',
  },
  'descargar-contrato': {
    seccion: 'Documentos',
    categoria: 'Contratos',
    descripcion:
      'Descarga un documento de "Contratos" (Documentos) con el ícono de descarga del grid. Auto: primer empleado y primer documento (sube uno si no hay); Panel: empleado y/o documento.',
  },
  'eliminar-contrato': {
    seccion: 'Documentos',
    categoria: 'Contratos',
    descripcion:
      'Elimina un documento de "Contratos" (Documentos) por checkbox + "Eliminar" + confirmar. Auto: sube un documento propio y elimina ese; Panel: empleado y/o documento.',
  },
  'adjuntar-otro-documento': {
    seccion: 'Documentos',
    categoria: 'Otros Documentos',
    descripcion:
      'Adjunta un documento en "Otros Documentos" (Documentos) del detalle de un Empleado: "Adjuntar" > popup "Importar Documentos" > Guardar; verifica que el grid lo lista. Usa un PDF genérico. Auto: primer empleado; Panel: empleado y/o archivo.',
  },
  'descargar-otro-documento': {
    seccion: 'Documentos',
    categoria: 'Otros Documentos',
    descripcion:
      'Descarga un documento de "Otros Documentos" (Documentos) con el ícono de descarga del grid. Auto: primer empleado y primer documento (sube uno si no hay); Panel: empleado y/o documento.',
  },
  'eliminar-otro-documento': {
    seccion: 'Documentos',
    categoria: 'Otros Documentos',
    descripcion:
      'Elimina un documento de "Otros Documentos" (Documentos) por checkbox + "Eliminar" + confirmar. Auto: sube un documento propio y elimina ese; Panel: empleado y/o documento.',
  },
  'adjuntar-carta': {
    seccion: 'Documentos',
    categoria: 'Cartas',
    descripcion:
      'Adjunta un documento en "Cartas" (Documentos) del detalle de un Empleado: "Adjuntar" > popup "Importar Documentos" > Guardar; verifica que el grid lo lista. Usa un PDF genérico. Auto: primer empleado; Panel: empleado y/o archivo.',
  },
  'descargar-carta': {
    seccion: 'Documentos',
    categoria: 'Cartas',
    descripcion:
      'Descarga un documento de "Cartas" (Documentos) con el ícono de descarga del grid. Auto: primer empleado y primer documento (sube uno si no hay); Panel: empleado y/o documento.',
  },
  'eliminar-carta': {
    seccion: 'Documentos',
    categoria: 'Cartas',
    descripcion:
      'Elimina un documento de "Cartas" (Documentos) por checkbox + "Eliminar" + confirmar. Auto: sube un documento propio y elimina ese; Panel: empleado y/o documento.',
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
