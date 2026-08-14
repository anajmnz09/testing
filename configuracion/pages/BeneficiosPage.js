const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const BeneficioDetallePage = require('./BeneficioDetallePage');

/**
 * Listado "Beneficios" (Configuración > Administración > Beneficios). Se
 * llega vía `ConfiguracionesPage.irA('Beneficios', 'Administración')` (core).
 * Toda la mecánica genérica vive en `ConfiguracionEntidadListadoPage` (core).
 * El buscador de este listado FUNCIONA (a diferencia de Horarios/Grados
 * Académicos/Habilidades) — se usa `abrirDetalle(nombre)` normalmente, sin
 * necesidad de `abrirPrimero()`.
 */
class BeneficiosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return BeneficioDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Beneficios', 'Administración');
    return new BeneficiosPage(driver).listo();
  }
}

module.exports = BeneficiosPage;
