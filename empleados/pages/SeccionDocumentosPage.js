const DocumentosAdjuntosPage = require('./DocumentosAdjuntosPage');

/**
 * Sección de DOCUMENTOS del detalle de Empleado (acordeón "Documentos": Análisis médicos, Contratos, Otros Documentos, Cartas).
 *
 * Confirmado con Selenium real (2026-10-15): a diferencia de Capacitación/Herramientas, estas secciones NO navegan a una pantalla
 * propia — el contenido vive DENTRO del panel lateral del Empleado (`.mainEmpleadosGenericBar`), con el título de la sección como
 * `<h2 class="...record-name">`, los botones "Adjuntar" / "Eliminar" / "Filtro" (Cartas suma "Enviar correo") y un grid de las MISMAS
 * columnas que los adjuntos de Capacitación (`["", "Imagen", "Nombre archivo", "Tipo de archivo", "Fecha de Creación", "Tamaño", ""]`).
 * Las cuatro secciones se separaron solo para un mejor manejo: usan los mismos componentes y acciones, así que el comportamiento
 * (popup "Importar Documentos", checkbox + "Eliminar" + "Aceptar", ícono de descarga en la última columna) es el de
 * `DocumentosAdjuntosPage`. Cada sección concreta extiende esta clase, fija su nombre y declara su `ENTIDAD_FLUJO`.
 */
class SeccionDocumentosPage extends DocumentosAdjuntosPage {
  // El contrato de FLUJOS (`ENTIDAD_FLUJO`, GUIDELINES §12) lo declara cada subclase como objeto LITERAL (se lee de forma estática): un
  // documento se identifica por el nombre de su archivo SIN extensión; `adjuntar` lo crea, `descargar` lo consume y `eliminar` lo elimina.

  /** @param {string} seccion nombre de la sección en el sidemenu (p. ej. "Contratos"). */
  constructor(driver, seccion) {
    super(driver, '.mainEmpleadosGenericBar');
    this.seccion = seccion;
  }

  /** Título mostrado por la sección (el `<h2>` del contenido). */
  async tituloSeccion() {
    return this.titulo();
  }
}

module.exports = SeccionDocumentosPage;
