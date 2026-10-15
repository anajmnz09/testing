const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Sucursales" (Configuración > Administración >
 * Sucursales). Toda la mecánica genérica (Crear/Consultar/Editar en una sola
 * pantalla, header `.forms-header`, popup de confirmación tras Guardar,
 * recarga de pantalla tras Guardar) vive en `ConfiguracionEntidadDetallePage`
 * (core) — acá solo el mapeo PROPIO de Sucursales.
 *
 * Mapeo verificado con Selenium Headed (HTML real inspeccionado, sin
 * adivinar):
 *  - Usa `dxForm` nativo (clase `dx-field-item`, igual convención que "Crear
 *    Solicitud" de Empleo).
 *  - "Compañía" y "Estado" son selectbox REQUERIDOS pero DESHABILITADOS al
 *    Crear (compañía única del tenant; Estado nace "Activo" fijo) — se
 *    declaran igual en `ESTRATEGIAS` (ya vienen con un valor, así que
 *    `estaVacio()` los protege solos: el loop "completar solo vacíos" nunca
 *    los toca al crear). "Estado" SÍ se habilita al Editar (confirmado); acá
 *    no se fuerza ningún caso de uso puntual, cada test decide si lo cambia.
 *  - "Teléfono" es un editor ENMASCARADO (`dx-texteditor-masked`), pero a
 *    diferencia de "Identificación" en Solicitud de Empleo, acá el `.clear()`
 *    por defecto de `Form.escribir()` NO tira error — se probó `clear:false`
 *    primero (por la similitud con ese otro caso) y el valor NUNCA quedaba
 *    escrito (el campo terminaba vacío, sin ninguna excepción — confirmado
 *    con una corrida real); con la estrategia `text` por defecto (clear:true)
 *    sí queda escrito. No asumir que todo editor enmascarado necesita
 *    `clear:false`: depende del control puntual, se verifica cada uno.
 *  - "RNL" es texto libre (el label completo incluye un tooltip informativo
 *    concatenado, "RNL:Registro Nacional Laboral" — se declara como "RNL" a
 *    secas: `Form._campo()` matchea por `contains()`, alcanza con el
 *    substring).
 *  - "Latitud"/"Longitud" son `dx-numberbox` (se completan como texto plano,
 *    igual selector `.dx-texteditor-input` que cualquier textbox).
 *  - "Dirección" es un `dx-textarea` (mismo selector `.dx-texteditor-input`,
 *    sin necesidad de un manejo especial).
 */
const ESTRATEGIAS = {
  'Nombre Sucursal': 'text',
  'Nombre/Referencia': 'text',
  Compañía: 'directSelect',
  Correo: 'text',
  Teléfono: 'text',
  RNL: 'text',
  Latitud: 'text',
  Longitud: 'text',
  Estado: 'directSelect',
  Dirección: { estrategia: 'text', dato: 'sucursal.direccion' },
};

class SucursalDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Control que identifica al registro (referencia de la entidad en un flujo; ver `ConfiguracionEntidadDetallePage`). */
  static get CAMPO_IDENTIFICADOR() {
    return 'Nombre Sucursal';
  }

  static get NOMBRE_ENTIDAD() {
    return 'sucursal';
  }
}

module.exports = SucursalDetallePage;
