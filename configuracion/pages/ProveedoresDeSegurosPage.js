const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const ProveedorSeguroDetallePage = require('./ProveedorSeguroDetallePage');

/**
 * Listado "Proveedores de seguros" (Configuración > Empleados > Proveedores
 * de seguros). Se llega vía
 * `ConfiguracionesPage.irA('Proveedores de seguros', 'Empleados', 'Proveedor
 * de seguros')` (core) — el TERCER argumento es obligatorio acá: el título
 * de destino real difiere del nombre del menú (ver mapeo de
 * `ProveedorSeguroDetallePage`). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadListadoPage` (core).
 *
 * El buscador de este listado está ROTO en el ambiente actual — confirmado
 * con evidencia real: `grid.buscar()` con CUALQUIER término (incluso uno
 * inexistente) dispara "Error cargando registro(s)" en rojo, reproducido
 * 3/3 veces (100% determinístico, mismo patrón que Habilidades/Horarios).
 * Por eso los casos "automáticos" (sin nombre dirigido desde el Panel)
 * evitan el buscador (`abrirPrimero()`, ver `consultar-proveedor-seguro`/
 * `editar-proveedor-seguro`) — el código queda LISTO para buscar
 * (`abrirDetalle(nombre)`) apenas lo arreglen.
 */
class ProveedoresDeSegurosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return ProveedorSeguroDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Proveedores de seguros', 'Empleados', 'Proveedor de seguros');
    return new ProveedoresDeSegurosPage(driver).listo();
  }
}

module.exports = ProveedoresDeSegurosPage;
