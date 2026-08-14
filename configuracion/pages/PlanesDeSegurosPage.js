const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const PlanDeSeguroDetallePage = require('./PlanDeSeguroDetallePage');

/**
 * Listado "Planes de seguros" (Configuración > Empleados > Planes de
 * seguros). Se llega vía
 * `ConfiguracionesPage.irA('Planes de seguros', 'Empleados')` (core). Toda
 * la mecánica genérica vive en `ConfiguracionEntidadListadoPage` (core).
 *
 * El buscador de este listado es INESTABLE en el ambiente actual —
 * confirmado con evidencia real: `grid.buscar()` con distintos términos
 * (incluso el nombre de un registro existente) dispara "Error cargando
 * registro(s)" en rojo, reproducido 2/2 veces en corridas reales de test,
 * aunque un probe aislado con los mismos términos no siempre lo reprodujo
 * (parece intermitente, no 100% determinístico como Habilidades/Horarios).
 * Por eso los casos "automáticos" (sin nombre dirigido desde el Panel)
 * evitan el buscador (`abrirPrimero()`, ver `consultar-plan-de-seguro`/
 * `editar-plan-de-seguro`) — el código queda LISTO para buscar
 * (`abrirDetalle(nombre)`) apenas se estabilice.
 */
class PlanesDeSegurosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return PlanDeSeguroDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Planes de seguros', 'Empleados');
    return new PlanesDeSegurosPage(driver).listo();
  }
}

module.exports = PlanesDeSegurosPage;
