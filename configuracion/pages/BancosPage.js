const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const BancoDetallePage = require('./BancoDetallePage');

/**
 * Listado "Bancos" (Configuración > Empleados > Bancos). Se llega vía
 * `ConfiguracionesPage.irA('Bancos', 'Empleados')` (core). Toda la mecánica
 * genérica vive en `ConfiguracionEntidadListadoPage` (core). El buscador de
 * este listado FUNCIONA — se usa `abrirDetalle(nombre)` normalmente.
 */
class BancosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return BancoDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Bancos', 'Empleados');
    return new BancosPage(driver).listo();
  }
}

module.exports = BancosPage;
