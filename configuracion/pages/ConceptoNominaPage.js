const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const ConceptoNominaDetallePage = require('./ConceptoNominaDetallePage');

/**
 * Listado "Concepto de nómina" (Configuración > Nómina > Concepto de
 * nómina). Se llega vía `ConfiguracionesPage.irA('Concepto de nómina',
 * 'Nómina')` (core). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadListadoPage` (core).
 */
class ConceptoNominaPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return ConceptoNominaDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Concepto de nómina', 'Nómina');
    return new ConceptoNominaPage(driver).listo();
  }
}

module.exports = ConceptoNominaPage;
