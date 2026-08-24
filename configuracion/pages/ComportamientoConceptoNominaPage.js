const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const ComportamientoConceptoNominaDetallePage = require('./ComportamientoConceptoNominaDetallePage');

/**
 * Listado "Comportamiento concepto Nómina" (Configuración > Nómina >
 * Comportamiento concepto Nómina). Se llega vía
 * `ConfiguracionesPage.irA('Comportamiento concepto Nómina', 'Nómina')`
 * (core) — nombre exacto del menú, SIN "de" ("Comportamiento concepto
 * Nómina", no "Comportamiento concepto DE Nómina"). Toda la mecánica
 * genérica vive en `ConfiguracionEntidadListadoPage` (core).
 */
class ComportamientoConceptoNominaPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return ComportamientoConceptoNominaDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Comportamiento concepto Nómina', 'Nómina');
    return new ComportamientoConceptoNominaPage(driver).listo();
  }
}

module.exports = ComportamientoConceptoNominaPage;
