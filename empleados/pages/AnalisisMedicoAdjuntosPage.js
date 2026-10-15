const SeccionDocumentosPage = require('./SeccionDocumentosPage');

/** Sección "Análisis médicos" (Documentos) del detalle de Empleado: adjuntar / descargar / eliminar documentos. Ver `SeccionDocumentosPage`. */
class AnalisisMedicoAdjuntosPage extends SeccionDocumentosPage {
  static get ENTIDAD_FLUJO() {
    return {
      tipo: 'documento-analisis-medico',
      referencia: 'nombre',
      metodos: ['descargar'],
      creadores: [{ metodo: 'adjuntar', persiste: true, referenciaArg: '0:stem' }],
      eliminadores: ['eliminar'],
    };
  }

  constructor(driver) {
    super(driver, 'Análisis médicos');
  }
}

module.exports = AnalisisMedicoAdjuntosPage;
