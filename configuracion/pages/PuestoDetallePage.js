const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Puestos" (Configuración > Administración >
 * Puestos). Toda la mecánica genérica vive en `ConfiguracionEntidadDetallePage`
 * (core) — acá solo el mapeo PROPIO de Puestos.
 *
 * Mapeo verificado con Selenium Headed (HTML real inspeccionado):
 *  - Usa `dxForm` nativo (clase `dx-field-item`, igual convención que
 *    Sucursales/Solicitud de Empleo).
 *  - Campos REQUERIDOS y editables: "Nombre" (texto), "Descripción"
 *    (textarea), "Requisitos" (textarea), "Responsabilidades" (textarea).
 *  - "Compañía" y "Estado" son REQUERIDOS pero DESHABILITADOS (mismo criterio
 *    que Sucursales) — A PEDIDO EXPLÍCITO no se declaran en `ESTRATEGIAS`
 *    (no deben ofrecerse como parámetro del Panel: nunca se pueden completar
 *    de todos modos).
 *  - "Personas Asignadas" es un número de solo lectura (`dx-state-readonly`,
 *    se recalcula solo, columna propia del listado) — tampoco se declara,
 *    mismo criterio.
 *  - Opcionales editables: "Clasificación 1/2/3" (selectbox con buscador,
 *    `searchAndSelect`), "Límite de personas", "Monto tope de comisión",
 *    "Rango salarial mínimo/máximo", "Nivel del puesto" (`dx-numberbox`,
 *    estrategia `text`), "Referencia (MT)" (texto libre).
 *  - El formulario tiene ADEMÁS un tabview inferior ("Beneficios"/
 *    "Documentos") — A PEDIDO EXPLÍCITO se obvia por completo: no se mapea,
 *    no se declara en ESTRATEGIAS, no se toca (mismo criterio que
 *    "Distribución Centro Costo" en Departamentos).
 */
const ESTRATEGIAS = {
  Nombre: 'text',
  Descripción: { estrategia: 'text', dato: 'puesto.descripcion' },
  'Clasificación 1': 'searchAndSelect',
  'Límite de personas': 'text',
  'Monto tope de comisión': 'text',
  Requisitos: { estrategia: 'text', dato: 'puesto.requisitos' },
  'Clasificación 2': 'searchAndSelect',
  'Referencia (MT)': 'text',
  'Rango salarial mínimo': 'text',
  'Rango salarial máximo': 'text',
  Responsabilidades: { estrategia: 'text', dato: 'puesto.responsabilidades' },
  'Clasificación 3': 'searchAndSelect',
  'Nivel del puesto': 'text',
};

class PuestoDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'puesto';
  }
}

module.exports = PuestoDetallePage;
