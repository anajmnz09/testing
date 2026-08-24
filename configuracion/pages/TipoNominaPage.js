const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const TipoNominaDetallePage = require('./TipoNominaDetallePage');

/**
 * Listado "Tipo Nómina" (Configuración > Nómina > Tipo Nómina). Se llega vía
 * `ConfiguracionesPage.irA('Tipo Nómina', 'Nómina')` (core). Toda la
 * mecánica genérica vive en `ConfiguracionEntidadListadoPage` (core).
 */
class TipoNominaPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return TipoNominaDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Tipo Nómina', 'Nómina');
    return new TipoNominaPage(driver).listo();
  }
}

module.exports = TipoNominaPage;
