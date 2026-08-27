const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const GrupoDetallePage = require('./GrupoDetallePage');

/**
 * Listado "Grupos" (Configuración > Usuarios y permisos > Grupos). Se llega
 * vía `ConfiguracionesPage.irA('Grupos', 'Usuarios y permisos')` (core) —
 * NUNCA con selectores propios del menú lateral acá. Toda la mecánica
 * genérica (grid, "Crear", abrir detalle por doble-click) vive en
 * `ConfiguracionEntidadListadoPage` (core). Columnas confirmadas con
 * Selenium real: "Nombre", "Descripción".
 */
class GruposPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return GrupoDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Grupos', 'Usuarios y permisos');
    return new GruposPage(driver).listo();
  }
}

module.exports = GruposPage;
