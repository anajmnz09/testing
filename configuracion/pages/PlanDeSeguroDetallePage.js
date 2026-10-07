const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Planes de seguros" (Configuración > Empleados
 * > Planes de seguros). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (HTML real inspeccionado, probe
 * dx-field-item — convención dxForm nativa, igual que Sucursales/Beneficios):
 *  - "Nombre Proveedor" (`search-icon`): selectbox REQUERIDO con buscador —
 *    `searchAndSelect`. Es el campo de FORMULARIO; la columna del LISTADO
 *    se llama "Proveedor".
 *  - "Estado": selectbox REQUERIDO, DESHABILITADO al Crear (mismo patrón
 *    que Sucursales/Puestos/Grados Académicos) — `directSelect`.
 *  - "Nombre Plan de seguro": texto libre REQUERIDO — es el campo
 *    IDENTIFICADOR de FORMULARIO; la columna del LISTADO se llama "Nombre"
 *    (mismo patrón ya visto en Departamentos/Beneficios: campo con un
 *    nombre, columna "Nombre").
 *  - "Tarifa": numberbox REQUERIDO. Aparece DESHABILITADO apenas se abre
 *    "Crear" (antes de elegir "Nombre Proveedor") pero se HABILITA al
 *    elegirlo — confirmado con evidencia real que, aun habilitado, el
 *    "0.00" que trae por defecto NO cuenta como "vacío" para
 *    `estaVacio()` (DevExtreme no le pone `dx-texteditor-empty`), así que
 *    `completarConContexto` lo saltea de largo — la app rechaza guardar con
 *    "0" ("Operación Inválida: No se completaron los datos requeridos").
 *    Usa la estrategia `text` (el numberbox de DevExtreme comparte el mismo
 *    `.dx-texteditor-input` que un textbox, `Form.escribir()` funciona
 *    igual) — el test SIEMPRE lo completa explícitamente (Panel-dirigido o
 *    un default QA), nunca vía el salteo automático de "ya tiene datos".
 *  - "% Empresa"/"% Empleado": numberbox REQUERIDOS — mismo motivo/mismo
 *    tratamiento que "Tarifa" (estrategia `text`, completado SIEMPRE
 *    explícito).
 *  - "Concepto de nómina" (`search-icon`): selectbox OPCIONAL con buscador —
 *    `searchAndSelect`.
 */
const ESTRATEGIAS = {
  'Nombre Proveedor': 'searchAndSelect',
  Estado: 'directSelect',
  'Nombre Plan de seguro': 'text',
  Tarifa: 'text',
  '% Empresa': 'text',
  '% Empleado': 'text',
  'Concepto de nómina': 'searchAndSelect',
};

class PlanDeSeguroDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Control que identifica al registro (referencia de la entidad en un flujo; ver `ConfiguracionEntidadDetallePage`). */
  static get CAMPO_IDENTIFICADOR() {
    return 'Nombre Plan de seguro';
  }

  static get NOMBRE_ENTIDAD() {
    return 'plan-de-seguro';
  }
}

module.exports = PlanDeSeguroDetallePage;
