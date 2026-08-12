/**
 * Organización de los tests de este módulo para el Panel de Control:
 * agrupa cada CASO (nombre = archivo `tests/<nombre>.test.js`, sin la
 * extensión) por Sección de la app (como está organizada la app real:
 * Requisiciones, Solicitudes, Banco de candidatos) y luego por Categoría (qué
 * hace: Agregar, Crear, Compartir, Consultar, Editar, Otros).
 *
 * Reemplaza la agrupación anterior (derivada del primer segmento del nombre
 * del archivo, ej. "agregar-x" -> carpeta "agregar") por una agrupación
 * EXPLÍCITA y por SECCIÓN de la app — más clara para quien usa el Panel.
 *
 * Un caso SIN entrada acá (ej. login, navegación, entrar al listado) es un
 * test de FLUJO, no de una función de negocio puntual: no aparece agrupado
 * en el árbol del Panel (sigue existiendo y siendo ejecutable por consola).
 *
 * `descripcion`: una oración breve de qué hace el test — se muestra en el
 * Panel arriba de "Ejecutar", debajo del título del caso.
 */
module.exports = {
  // --- Requisiciones ---------------------------------------------------
  'agregar-comentario-requisicion': {
    seccion: 'Requisiciones',
    categoria: 'Agregar',
    descripcion: 'Agrega un comentario a una requisición ya existente.',
  },
  'agregar-pregunta-personalizada': {
    seccion: 'Requisiciones',
    categoria: 'Agregar',
    descripcion:
      'Agrega una pregunta personalizada a una requisición ya existente, incluyendo su tipo y —cuando aplica— sus opciones.',
  },
  'agregar-archivos-requisicion': {
    seccion: 'Requisiciones',
    categoria: 'Agregar',
    descripcion:
      'Sube documentos a una requisición autorizada, uno por cada clasificación, y valida que cada uno quede asociado.',
  },
  'crear-req-creacion': {
    seccion: 'Requisiciones',
    categoria: 'Crear',
    descripcion: 'Crea una requisición nueva por Creación, completando los campos requeridos del formulario.',
  },
  'crear-req-sustitucion': {
    seccion: 'Requisiciones',
    categoria: 'Crear',
    descripcion: 'Crea una requisición nueva por Sustitución, completando los campos requeridos del formulario.',
  },
  'compartir-requisicion-publicada': {
    seccion: 'Requisiciones',
    categoria: 'Compartir',
    descripcion:
      'Comparte el enlace público de una requisición ya publicada y valida que el enlace lleve a la vacante correcta.',
  },
  'compartir-requisicion-no-publicada': {
    seccion: 'Requisiciones',
    categoria: 'Compartir',
    descripcion: 'Confirma que "Compartir" queda bloqueado en una requisición que todavía no está publicada.',
  },
  'pausar-requisicion': {
    seccion: 'Requisiciones',
    categoria: 'Otros',
    descripcion: 'Pausa una requisición que se encuentra autorizada.',
  },
  'publicar-requisicion': {
    seccion: 'Requisiciones',
    categoria: 'Otros',
    descripcion: 'Publica una requisición autorizada para generar su vacante pública.',
  },
  'cerrar-requisicion': {
    seccion: 'Requisiciones',
    categoria: 'Otros',
    descripcion:
      'Cierra una requisición desde el header; si tiene solicitantes pendientes, resuelve "Envío de candidatos" (Elegibles/Descartados al azar) y lo confirma en Banco de candidatos.',
  },

  // --- Solicitudes -------------------------------------------------------
  'agregar-foto-solicitud-empleo': {
    seccion: 'Solicitudes',
    categoria: 'Agregar',
    descripcion: 'Sube una foto de perfil a una Solicitud de Empleo ya existente.',
  },
  'agregar-valoracion-solicitud-empleo': {
    seccion: 'Solicitudes',
    categoria: 'Agregar',
    descripcion: 'Agrega una valoración por estrellas (1 a 5) a una Solicitud de Empleo ya existente.',
  },
  'consultar-solicitudes-desde-requisicion': {
    seccion: 'Solicitudes',
    categoria: 'Consultar',
    descripcion:
      'Desde el detalle de una requisición, abre el listado de Solicitudes de Empleo ya filtrado por esa requisición.',
  },
  'consultar-banco-elegibles-desde-requisicion': {
    seccion: 'Banco de candidatos',
    categoria: 'Consultar',
    descripcion: 'Desde el detalle de una requisición, abre "Banco de candidatos" mediante el botón "B. Elegibles" del header.',
  },
  'agregar-candidato-banco': {
    seccion: 'Banco de candidatos',
    categoria: 'Agregar',
    descripcion:
      'Agrega un candidato nuevo directamente desde "Banco de candidatos" (modal "Agregar Nuevo Candidato"), incluyendo Etiquetas y Apreciación.',
  },
  'enviar-candidato-elegibles': {
    seccion: 'Banco de candidatos',
    categoria: 'Otros',
    descripcion: 'Envía un candidato de la tab "Descartados" a "Elegibles" y confirma que aparece en el destino.',
  },
  'enviar-candidato-descartados': {
    seccion: 'Banco de candidatos',
    categoria: 'Otros',
    descripcion: 'Envía un candidato de la tab "Elegibles" a "Descartados" y confirma que aparece en el destino.',
  },
  'crear-solicitud-empleo': {
    seccion: 'Solicitudes',
    categoria: 'Crear',
    descripcion: 'Crea una Solicitud de Empleo completando Datos de Empleado y Acerca del puesto de trabajo.',
  },
  'editar-paquete-beneficios-solicitud-empleo': {
    seccion: 'Solicitudes',
    categoria: 'Editar',
    descripcion:
      'Llena el Paquete actual de beneficios (Estado laboral, Último salario, Beneficios) de una Solicitud de Empleo, si su etapa y estado lo permiten.',
  },
  'cambiar-solicitud-primera-entrevista': {
    seccion: 'Solicitudes',
    categoria: 'Otros',
    descripcion: 'Cambia la etapa de una Solicitud de Empleo a "Primera entrevista", desde el header, sin entrar a Editar.',
  },
  'cambiar-solicitud-segunda-entrevista': {
    seccion: 'Solicitudes',
    categoria: 'Otros',
    descripcion: 'Cambia la etapa de una Solicitud de Empleo a "Segunda entrevista", desde el header, sin entrar a Editar.',
  },
  'cambiar-solicitud-tercera-entrevista': {
    seccion: 'Solicitudes',
    categoria: 'Otros',
    descripcion: 'Cambia la etapa de una Solicitud de Empleo a "Tercera entrevista", desde el header, sin entrar a Editar.',
  },
  'cambiar-solicitud-oferta-empleo': {
    seccion: 'Solicitudes',
    categoria: 'Otros',
    descripcion: 'Cambia la etapa de una Solicitud de Empleo a "Oferta de Empleo", desde el header, sin entrar a Editar.',
  },
  'cambiar-solicitud-crear-empleado': {
    seccion: 'Solicitudes',
    categoria: 'Otros',
    descripcion:
      'Llena el Salario de la Propuesta económica, cambia la etapa a "Crear Empleado" y verifica que el solicitante aparezca en el módulo Empleados.',
  },
  'agregar-otros-beneficios-solicitud-empleo': {
    seccion: 'Solicitudes',
    categoria: 'Agregar',
    descripcion:
      'Agrega uno o más "Otros beneficios" (beneficio + monto) a una Solicitud de Empleo en etapa "Oferta de Empleo", descartando los que no coincidan con el catálogo.',
  },
  'agregar-comentario-solicitud-empleo': {
    seccion: 'Solicitudes',
    categoria: 'Agregar',
    descripcion: 'Agrega un comentario a una Solicitud de Empleo existente (cualquier etapa/estado). Requiere indicar el código.',
  },
};
