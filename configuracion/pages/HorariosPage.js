const { ConfiguracionEntidadListadoPage } = require('@triple/core');
const HorarioDetallePage = require('./HorarioDetallePage');

/**
 * Listado "Horarios" (Configuración > Administración > Horarios). Se llega
 * vía `ConfiguracionesPage.irA('Horarios', 'Administración')` (core). Toda
 * la mecánica genérica vive en `ConfiguracionEntidadListadoPage` (core).
 *
 * Columnas verificadas: "Descripción" (= identifica la fila, no hay un
 * "Nombre" separado en esta entidad), "Horario" (rango "HH:MM - HH:MM",
 * calculado de Hora Inicial/Hora final), "Estado".
 */
class HorariosPage extends ConfiguracionEntidadListadoPage {
  static get DetallePageClass() {
    return HorarioDetallePage;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Horarios', 'Administración');
    return new HorariosPage(driver).listo();
  }
}

module.exports = HorariosPage;
