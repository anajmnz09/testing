const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Razones de Salidas" (Configuración > Empleados
 * > Razones de Salidas). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (HTML real inspeccionado, probe):
 *  - Usa la TERCERA convención (`<div class="pt-15"><label>...`, sin clase
 *    `group-field`/`dx-field-item`) — `Form._campoGenerico()` ya la soporta
 *    (fallback automático, sin cambios acá), mismo hallazgo ya documentado
 *    para esta pantalla.
 *  - "Razón": texto libre REQUERIDO — es también la columna que identifica
 *    la fila en el listado.
 *  - "Estado": selectbox, DESHABILITADO al Crear (mismo patrón que el resto
 *    de entidades) — `directSelect`.
 *  - El listado tiene ADEMÁS una columna "Carta adjunta" (adjuntar archivo)
 *    y el formulario una sección "Derechos Adquiridos" (tabla repetible) —
 *    A PEDIDO EXPLÍCITO se obvian por completo: no se mapean, no se
 *    declaran en ESTRATEGIAS, no se tocan.
 */
const ESTRATEGIAS = {
  Razón: 'text',
  Estado: 'directSelect',
};

class RazonSalidaDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Control que identifica al registro (referencia de la entidad en un flujo; ver `ConfiguracionEntidadDetallePage`). */
  static get CAMPO_IDENTIFICADOR() {
    return 'Razón';
  }

  static get NOMBRE_ENTIDAD() {
    return 'razon-salida';
  }
}

module.exports = RazonSalidaDetallePage;
