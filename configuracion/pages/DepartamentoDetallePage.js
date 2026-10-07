const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Departamentos" (Configuración > Administración
 * > Departamentos). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO de
 * Departamentos.
 *
 * Mapeo verificado con Selenium Headed (HTML real inspeccionado):
 *  - Usa la convención `group-field` (igual que Requisiciones), NO
 *    `dx-field-item` (a diferencia de Sucursales, que sí usa `dxForm`
 *    nativo) — `Form._campo()` ya soporta ambas, sin cambios.
 *  - Único campo REQUERIDO: "Departamento" (texto libre). El resto —
 *    "Clasificación 1/2/3", "Departamento Padre", "Gerente Departamento" —
 *    son selectbox OPCIONALES con buscador (`search-icon`), estrategia
 *    `searchAndSelect`.
 *  - El formulario tiene ADEMÁS una sección "Distribución Centro Costo"
 *    (tabla + botón "add", mismo patrón "agregar vía popup" que "Otros
 *    beneficios" de Solicitud de Empleo) — A PEDIDO EXPLÍCITO se obvia por
 *    completo: no se mapea, no se declara en ESTRATEGIAS, no se toca.
 */
const ESTRATEGIAS = {
  Departamento: 'text',
  'Clasificación 1': 'searchAndSelect',
  'Departamento Padre': 'searchAndSelect',
  'Clasificación 2': 'searchAndSelect',
  'Gerente Departamento': 'searchAndSelect',
  'Clasificación 3': 'searchAndSelect',
};

class DepartamentoDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Control que identifica al registro (referencia de la entidad en un flujo; ver `ConfiguracionEntidadDetallePage`). */
  static get CAMPO_IDENTIFICADOR() {
    return 'Departamento';
  }

  static get NOMBRE_ENTIDAD() {
    return 'departamento';
  }
}

module.exports = DepartamentoDetallePage;
