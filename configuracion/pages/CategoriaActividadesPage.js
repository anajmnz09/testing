const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const CategoriaActividadDetallePage = require('./CategoriaActividadDetallePage');

/**
 * Listado "Categoría Actividades" (Configuración > Nómina > Categoría de
 * actividades — destino real titulado "Categoría Actividades"). Se llega
 * vía `ConfiguracionesPage.irA('Categoría de actividades', 'Nómina',
 * 'Categoría Actividades')` (core). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadListadoPage` (core).
 */
class CategoriaActividadesPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return CategoriaActividadDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Categoría de actividades', 'Nómina', 'Categoría Actividades');
    return new CategoriaActividadesPage(driver).listo();
  }
}

module.exports = CategoriaActividadesPage;
