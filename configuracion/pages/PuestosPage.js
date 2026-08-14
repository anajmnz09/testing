const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const PuestoDetallePage = require('./PuestoDetallePage');

/**
 * Listado "Puestos" (Configuración > Administración > Puestos). Se llega vía
 * `ConfiguracionesPage.irA('Puestos', 'Administración')` (core). Toda la
 * mecánica genérica vive en `ConfiguracionEntidadListadoPage` (core).
 *
 * Columnas verificadas: Compañía, Estado, Límite de personas, "Objetivo del
 * Puesto" (= "Descripción" del form), Personas Asignadas, "Título de Puesto"
 * (= "Nombre" del form — la columna que identifica la fila para
 * `abrirDetalle`/`buscar`).
 */
class PuestosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return PuestoDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Puestos', 'Administración');
    return new PuestosPage(driver).listo();
  }
}

module.exports = PuestosPage;
