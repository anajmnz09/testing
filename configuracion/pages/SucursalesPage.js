const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const SucursalDetallePage = require('./SucursalDetallePage');

/**
 * Listado "Sucursales" (Configuración > Administración > Sucursales). Se
 * llega vía `ConfiguracionesPage.irA('Sucursales', 'Administración')` (core)
 * — NUNCA con selectores propios del menú lateral acá. Toda la mecánica
 * genérica (grid, "Crear", abrir detalle por doble-click) vive en
 * `ConfiguracionEntidadListadoPage` (core).
 */
class SucursalesPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return SucursalDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Sucursales', 'Administración');
    return new SucursalesPage(driver).listo();
  }
}

module.exports = SucursalesPage;
