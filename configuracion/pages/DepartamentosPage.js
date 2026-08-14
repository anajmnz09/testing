const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const DepartamentoDetallePage = require('./DepartamentoDetallePage');

/**
 * Listado "Departamentos" (Configuración > Administración > Departamentos).
 * Se llega vía `ConfiguracionesPage.irA('Departamentos', 'Administración')`
 * (core). Toda la mecánica genérica vive en `ConfiguracionEntidadListadoPage`
 * (core).
 */
class DepartamentosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return DepartamentoDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Departamentos', 'Administración');
    return new DepartamentosPage(driver).listo();
  }
}

module.exports = DepartamentosPage;
