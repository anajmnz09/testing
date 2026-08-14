const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const RazonSalidaDetallePage = require('./RazonSalidaDetallePage');

/**
 * Listado "Razones de Salidas" (Configuración > Empleados > Razones de
 * Salidas). Se llega vía
 * `ConfiguracionesPage.irA('Razones de Salidas', 'Empleados')` (core). Toda
 * la mecánica genérica vive en `ConfiguracionEntidadListadoPage` (core). El
 * buscador de este listado FUNCIONA — se usa `abrirDetalle(nombre)`
 * normalmente.
 */
class RazonesDeSalidasPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return RazonSalidaDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Razones de Salidas', 'Empleados');
    return new RazonesDeSalidasPage(driver).listo();
  }
}

module.exports = RazonesDeSalidasPage;
