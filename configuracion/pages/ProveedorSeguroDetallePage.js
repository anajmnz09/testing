const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Proveedores de seguros" (Configuración >
 * Empleados > Proveedores de seguros). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (HTML real inspeccionado, probe):
 *  - Usa la convención `group-field-2` (variante de `group-field` con un
 *    sufijo numérico) — `Form._campo()` ya la soporta (matchea por
 *    `contains(@class,'group-field')`, no exacto), sin cambios acá.
 *  - "Proveedor": texto libre REQUERIDO — es también la columna que
 *    identifica la fila en el listado.
 *  - "Estado": selectbox, DESHABILITADO al Crear (mismo patrón que el resto
 *    de entidades) — `directSelect`.
 *  - Título de destino distinto del nombre del menú (confirmado con
 *    evidencia real): el link del menú lateral es "Proveedores de seguros"
 *    (plural) pero la pantalla destino se titula "Proveedor de seguros"
 *    (singular) — mismo patrón ya documentado en `ConfiguracionesPage.irA`
 *    (parámetro `tituloEsperado`), usado en `ProveedoresDeSegurosPage.ir()`
 *    y en el fixture del módulo.
 */
const ESTRATEGIAS = {
  Proveedor: 'text',
  Estado: 'directSelect',
};

class ProveedorSeguroDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'proveedor-de-seguro';
  }
}

module.exports = ProveedorSeguroDetallePage;
