const DocumentosAdjuntosPage = require('./DocumentosAdjuntosPage');

/**
 * Pantalla de ADJUNTOS de UNA Capacitación (Empleado > detalle > sección
 * "Capacitación" > ícono de clip "Adjuntar documento" en la columna "Acción").
 *
 * Confirmado con Selenium real (probe 2026-09-07):
 *  - El clip NAVEGA a una pantalla propia (`.capacitaciones-docs-page`, cambia
 *    la URL), NO abre un panel lateral.
 *  - El título de la pantalla (`<h2 class*="record-name">` de la `SrhhGenericBar`,
 *    con `title=` y texto) es el NOMBRE DE LA CAPACITACIÓN — se usa para
 *    confirmar "el archivo se adjuntó a ESTA capacitación".
 *  - Al lado del título hay 2 botones: "Adjuntar" y "Eliminar".
 *  - "Adjuntar" abre un popup `.adjuntar-documento-popup` ("Importar
 *    Documentos") con un `dx-fileuploader` (input oculto `input.dx-fileuploader-input`,
 *    `name="files[]"`), "Buscar en sistema", "Guardar" y "Descartar".
 *  - `accept` del input: `.pdf,.docx,.doc,.png,.jpg,.jpeg` — NO acepta `.txt`
 *    (a diferencia de "Documentos" de Requisición). Los tests usan un PDF
 *    genérico (`testFiles.resolver({ tipo: 'pdf' })`).
 *  - Guardar OK -> notify "Documento creado exitosamente", el popup se cierra y
 *    el grid de la pantalla lista el archivo (columna "Nombre archivo" con un
 *    sufijo UUID: `<base>_<uuid>`, columna "Tipo de archivo" = `.pdf`).
 *
 * Confirmado con Selenium real (2026-09-09, `eliminar()`/`descargar()`):
 *  - Headers reales del grid: `["", "Imagen", "Nombre archivo", "Tipo de
 *    archivo", "Fecha de Creación", "Tamaño", ""]` — la PRIMERA columna
 *    (checkbox de selección) y la ÚLTIMA (ícono de descarga,
 *    `.dx-icon-download`) NO tienen título.
 *  - "Eliminar" (checkbox + botón + confirmar "Aceptar") SÍ borra en el
 *    backend, pero el grid en pantalla no se auto-refresca — ver el
 *    docblock de `eliminar()`.
 *  - Descargar (ícono de la última columna) responde "No estás autorizado
 *    para realizar esta acción" en este ambiente/usuario — ver el docblock
 *    de `descargar()`.
 */
class CapacitacionAdjuntosPage extends DocumentosAdjuntosPage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). Un documento adjunto a una capacitación se identifica por el nombre de su
   * archivo SIN extensión (la app lo renombra con un sufijo, así que el nombre completo no sirve de referencia); `adjuntar` lo crea, `descargar` lo consume y `eliminar` lo elimina.
   * Lo lee el escáner estático y la capa común de publicación; en ejecución individual no se usa.
   */
  static get ENTIDAD_FLUJO() {
    return {
      tipo: 'documento-capacitacion',
      referencia: 'nombre',
      metodos: ['descargar'],
      creadores: [{ metodo: 'adjuntar', persiste: true, referenciaArg: '0:stem' }],
      eliminadores: ['eliminar'],
    };
  }

  constructor(driver) {
    super(driver, '.capacitaciones-docs-page');
  }

  /** Nombre de la capacitación mostrado como título de la pantalla. */
  async tituloCapacitacion() {
    return this.titulo();
  }
}

module.exports = CapacitacionAdjuntosPage;
