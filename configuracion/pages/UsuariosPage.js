const { By } = require('selenium-webdriver');
const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const UsuarioDetallePage = require('./UsuarioDetallePage');

/**
 * Listado "Usuarios" (Configuración > Usuarios y permisos > Usuarios). Se
 * llega vía `ConfiguracionesPage.irA('Usuarios', 'Usuarios y permisos')`
 * (core). Toda la mecánica genérica (grid, "Crear", abrir por doble-click)
 * vive en `ConfiguracionEntidadListadoPage` (core) — el buscador global del
 * grid funciona normal acá (confirmado con evidencia real), a diferencia del
 * de "Comportamiento concepto Nómina".
 */
class UsuariosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return UsuarioDetallePage;
  }

  /**
   * Override del locator de "detalle cargado" (ver
   * `ConfiguracionEntidadListadoPage._localizadorDetalleCargado`, core):
   * confirmado con Selenium real que la vista de CONSULTA de Usuario no
   * tiene `forms-header` (0 elementos) — usa su propio layout
   * `UsuariosConsultPage_*` con el ícono "⋮" (`#usuario-form-dropdown-acciones`,
   * único en esa pantalla). El form de CREAR sí tiene `forms-header` (crear-
   * usuario ya lo confirma en corridas reales), así que se aceptan AMBOS.
   */
  get _localizadorDetalleCargado() {
    return By.css('[class*="forms-header"], #usuario-form-dropdown-acciones');
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Usuarios', 'Usuarios y permisos');
    return new UsuariosPage(driver).listo();
  }
}

module.exports = UsuariosPage;
