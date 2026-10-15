const SeccionDocumentosPage = require('./SeccionDocumentosPage');

/** Sección "Contratos" (Documentos) del detalle de Empleado: adjuntar / descargar / eliminar documentos. Ver `SeccionDocumentosPage`. */
class ContratoAdjuntosPage extends SeccionDocumentosPage {
  static get ENTIDAD_FLUJO() {
    return {
      tipo: 'documento-contrato',
      referencia: 'nombre',
      metodos: ['descargar'],
      creadores: [{ metodo: 'adjuntar', persiste: true, referenciaArg: '0:stem' }],
      eliminadores: ['eliminar'],
    };
  }

  constructor(driver) {
    super(driver, 'Contratos');
  }
}

module.exports = ContratoAdjuntosPage;
