const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const CuentaContableDetallePage = require('./CuentaContableDetallePage');

/**
 * Listado "Cuentas Contables" (Configuración > Nómina > Cuentas Contables).
 * Se llega vía `ConfiguracionesPage.irA('Cuentas Contables', 'Nómina')`
 * (core). Toda la mecánica genérica vive en `ConfiguracionEntidadListadoPage`
 * (core).
 */
class CuentasContablesPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return CuentaContableDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Cuentas Contables', 'Nómina');
    return new CuentasContablesPage(driver).listo();
  }
}

module.exports = CuentasContablesPage;
