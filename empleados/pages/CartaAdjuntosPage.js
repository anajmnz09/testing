const SeccionDocumentosPage = require('./SeccionDocumentosPage');

/** Sección "Cartas" (Documentos) del detalle de Empleado: adjuntar / descargar / eliminar documentos. Ver `SeccionDocumentosPage`. */
class CartaAdjuntosPage extends SeccionDocumentosPage {
  static get ENTIDAD_FLUJO() {
    return {
      tipo: 'documento-carta',
      referencia: 'nombre',
      metodos: ['descargar'],
      creadores: [{ metodo: 'adjuntar', persiste: true, referenciaArg: '0:stem' }],
      eliminadores: ['eliminar'],
    };
  }

  constructor(driver) {
    super(driver, 'Cartas');
  }
}

module.exports = CartaAdjuntosPage;
