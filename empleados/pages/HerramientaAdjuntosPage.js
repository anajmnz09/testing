const DocumentosAdjuntosPage = require('./DocumentosAdjuntosPage');

/**
 * Pantalla de ADJUNTOS de UNA Herramienta (Empleado > detalle > sección "Herramientas" > columna "Opciones" (3 puntos verticales)
 * > opción "Adjuntar").
 *
 * Confirmado con Selenium real (2026-10-13): la opción NAVEGA a una pantalla propia (`.documento-herramientas-page`, cambia la
 * URL) titulada con la DESCRIPCIÓN de la herramienta (la app la muestra con la primera letra en mayúscula: "kkk" -> "Kkk"), con
 * "Adjuntar" / "Eliminar" / "Filtro" y un grid de documentos de las MISMAS columnas que el de Capacitación (`["", "Imagen",
 * "Nombre archivo", "Tipo de archivo", "Fecha de Creación", "Tamaño", ""]`). El comportamiento de adjuntar / descargar / eliminar es el
 * de `DocumentosAdjuntosPage` (el de Capacitación): ver ahí y en `CapacitacionAdjuntosPage` lo confirmado sobre el popup, la extensión
 * permitida y el grid que no se refresca solo tras eliminar.
 */
class HerramientaAdjuntosPage extends DocumentosAdjuntosPage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). Un documento adjunto a una herramienta se identifica por el nombre de su
   * archivo SIN extensión (la app lo renombra con un sufijo); `adjuntar` lo crea, `descargar` lo consume y `eliminar` lo elimina.
   */
  static get ENTIDAD_FLUJO() {
    return {
      tipo: 'documento-herramienta',
      referencia: 'nombre',
      metodos: ['descargar'],
      creadores: [{ metodo: 'adjuntar', persiste: true, referenciaArg: '0:stem' }],
      eliminadores: ['eliminar'],
    };
  }

  constructor(driver) {
    super(driver, '.documento-herramientas-page');
  }

  /** Descripción de la herramienta mostrada como título de la pantalla. */
  async tituloHerramienta() {
    return this.titulo();
  }
}

module.exports = HerramientaAdjuntosPage;
