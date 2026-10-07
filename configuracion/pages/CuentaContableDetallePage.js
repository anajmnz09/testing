const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Cuentas Contables" (Configuración > Nómina >
 * Cuentas Contables). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (metadata real, `screenInspector`):
 *  - "No. cuenta": texto libre REQUERIDO — es el campo de FORMULARIO; la
 *    columna del LISTADO se llama "No. Cuenta Contable" (mismo patrón ya
 *    visto en Proveedor de seguros: campo con un nombre, columna con otro).
 *  - "Estado": selectbox, a diferencia del resto de entidades de
 *    Configuración NO es requerido y llega YA con un valor seleccionado
 *    (`valor: "1"` desde el Crear) — `directSelect`.
 *  - "Descripción": texto libre REQUERIDO.
 *  - Sin switches, sin tabs, sin secciones a ignorar.
 *  - IMPORTANTE (confirmado con evidencia real, creando un registro y
 *    leyendo el grid sin filtrar): el buscador rápido del listado
 *    (`grid.buscar()`) SOLO indexa "Descripción" — buscar por el valor de
 *    "No. Cuenta Contable" devuelve "no hay datos para mostrar" aunque la
 *    fila exista. Cualquier confirmación de persistencia debe buscar por
 *    "Descripción" y recién ahí verificar "No. Cuenta Contable" en la fila
 *    encontrada — nunca buscar directo por el número de cuenta.
 *  - BUG DE APP (confirmado con evidencia real, 2026-08-19): EDITAR una
 *    Cuenta Contable existente falla SIEMPRE con notify de error "Ya existe
 *    un fila con este campo" — reproducido en 2 registros distintos (el
 *    genérico "1" y uno creado por este mismo framework), cambiando solo
 *    "Descripción" a un valor garantizado único cada vez. La causa más
 *    probable es que la validación de unicidad de "No. cuenta" no excluye el
 *    propio registro que se está editando (se compara contra sí mismo). NO
 *    es un problema del test ni de `siguienteNombreQA` — `editar-cuenta-
 *    contable.test.js` queda escrito correctamente y DEBE seguir fallando
 *    hasta que se corrija del lado de la app; no forzar un "pase" artificial
 *    acá (mismo criterio que el buscador roto de Horarios/Grados
 *    Académicos/Proveedores de seguros: el código correcto queda listo,
 *    documentado, y empieza a pasar solo cuando el bug real se resuelva).
 */
const ESTRATEGIAS = {
  'No. cuenta': 'text',
  Estado: 'directSelect',
  Descripción: 'text',
};

class CuentaContableDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Control que identifica al registro (referencia de la entidad en un flujo; ver `ConfiguracionEntidadDetallePage`). */
  static get CAMPO_IDENTIFICADOR() {
    return 'No. cuenta';
  }

  static get NOMBRE_ENTIDAD() {
    return 'cuenta-contable';
  }
}

module.exports = CuentaContableDetallePage;
