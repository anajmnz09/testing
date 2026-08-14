const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Bancos" (Configuración > Empleados > Bancos).
 * Toda la mecánica genérica vive en `ConfiguracionEntidadDetallePage`
 * (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (HTML real inspeccionado, probe —
 * TERCERA convención `pt-15`, igual que Razones de Salidas, ya soportada
 * por `Form._campoGenerico()`):
 *  - "País" (`search-icon`): selectbox REQUERIDO con buscador —
 *    `searchAndSelect`.
 *  - "Nombre": texto libre REQUERIDO — es también la columna que identifica
 *    la fila en el listado.
 *  - "Referencia"/"Código"/"Dígito verificador": texto libre OPCIONALES.
 *  - "Estado": REQUERIDO, DESHABILITADO al Crear (mismo patrón que el resto
 *    de entidades) — `directSelect`.
 */
const ESTRATEGIAS = {
  País: 'searchAndSelect',
  Nombre: 'text',
  Referencia: 'text',
  Código: 'text',
  'Dígito verificador': 'text',
  Estado: 'directSelect',
};

class BancoDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'banco';
  }
}

module.exports = BancoDetallePage;
