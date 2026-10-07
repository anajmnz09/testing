const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Beneficios" (Configuración > Administración >
 * Beneficios). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO de
 * Beneficios.
 *
 * Mapeo verificado con Selenium Headless (HTML real inspeccionado, probe
 * dx-field-item — convención dxForm nativa, igual que Sucursales):
 *  - "Beneficio" (`dx-field-item-required`): texto libre, REQUERIDO. Es el
 *    campo de FORMULARIO, pero la columna del LISTADO/grid sigue llamándose
 *    "Nombre" (mismo patrón ya visto en Departamentos: campo "Departamento",
 *    columna "Nombre").
 *  - "Concepto de nómina" (`dx-field-item-optional`, tiene `search-icon`):
 *    selectbox OPCIONAL con buscador — `searchAndSelect`.
 *  - "Estado" (`dx-field-item-required`): selectbox REQUERIDO — a diferencia
 *    del resto de entidades de Configuración (donde "Estado" queda
 *    deshabilitado al crear), acá aparece HABILITADO desde el Crear
 *    (confirmado `disabled=no` en el probe) — `directSelect`.
 */
const ESTRATEGIAS = {
  Beneficio: 'text',
  'Concepto de nómina': 'searchAndSelect',
  Estado: 'directSelect',
};

class BeneficioDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Control que identifica al registro (referencia de la entidad en un flujo; ver `ConfiguracionEntidadDetallePage`). */
  static get CAMPO_IDENTIFICADOR() {
    return 'Beneficio';
  }

  static get NOMBRE_ENTIDAD() {
    return 'beneficio';
  }
}

module.exports = BeneficioDetallePage;
