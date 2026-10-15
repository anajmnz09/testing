const SeccionDocumentosPage = require('./SeccionDocumentosPage');

/** Sección "Otros Documentos" (Documentos) del detalle de Empleado: adjuntar / descargar / eliminar documentos. Ver `SeccionDocumentosPage`. */
class OtroDocumentoAdjuntosPage extends SeccionDocumentosPage {
  static get ENTIDAD_FLUJO() {
    return {
      tipo: 'documento-otro',
      referencia: 'nombre',
      metodos: ['descargar'],
      creadores: [{ metodo: 'adjuntar', persiste: true, referenciaArg: '0:stem' }],
      eliminadores: ['eliminar'],
    };
  }

  constructor(driver) {
    super(driver, 'Otros Documentos');
  }
}

module.exports = OtroDocumentoAdjuntosPage;
