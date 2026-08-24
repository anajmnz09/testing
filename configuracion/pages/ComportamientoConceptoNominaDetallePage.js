const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Comportamiento concepto Nómina" (Configuración
 * > Nómina > Comportamiento concepto Nómina). Toda la mecánica genérica
 * vive en `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo
 * PROPIO.
 *
 * Mapeo verificado con Selenium (metadata real, `screenInspector`) — SON 4
 * controles, no 2: "Concepto"/"Tipo Nómina" son los únicos que este test
 * completa activamente, pero ESTRATEGIAS declara TODOS porque es la única
 * fuente de verdad de qué tiene el formulario (`GUIDELINES.md §Forms`) — si
 * un control real queda sin declarar, `Form.validarControlesDeclarados`
 * pierde la capacidad de detectarlo.
 *  - "Concepto": selectbox CON buscador REQUERIDO — referencia el catálogo
 *    de "Concepto de nómina" (`ConceptoNominaDetallePage`). Para no crear un
 *    Concepto nuevo por corrida ni tomar cualquiera del catálogo (podría
 *    ser data real del ambiente), se selecciona SIEMPRE el fixture QA fijo
 *    `catalogosQA.CONCEPTO_NOMINA_QA` — ver esa utilidad para cómo se
 *    asegura que exista antes de usarlo acá.
 *  - "Tipo Nómina": selectbox CON buscador REQUERIDO — mismo criterio,
 *    referencia `TipoNominaDetallePage` vía `catalogosQA.TIPO_NOMINA_QA`.
 *  - "Todos los intervalos": switch, viene ENCENDIDO (`true`) por defecto —
 *    declarado con `soloSiDirigido: true` (`SwitchStrategy`, core): si el
 *    Panel no dirige un valor, el autofill lo deja INTACTO en vez de
 *    forzarlo a apagado (lo que habilitaría "Intervalo" como requerido y
 *    rompería el Guardar sin necesidad). Si el Panel SÍ dirige un valor, se
 *    aplica normal.
 *  - "Intervalo": selectbox OPCIONAL, DESHABILITADO mientras "Todos los
 *    intervalos" esté encendido. Declarado (`directSelect`) para que quede
 *    visible en el Input Model/Panel y `validarControlesDeclarados` lo
 *    reconozca; en la práctica no se completa porque hoy no hay forma de
 *    dirigir "apagar" un switch desde el Panel (un booleano `false` cuenta
 *    como "no dirigido" — mismo criterio en todo el framework), así que
 *    "Todos los intervalos" nunca queda apagado por esta vía.
 */
const ESTRATEGIAS = {
  Concepto: 'searchAndSelect',
  'Tipo Nómina': 'searchAndSelect',
  'Todos los intervalos': { estrategia: 'switch', soloSiDirigido: true },
  Intervalo: 'directSelect',
};

class ComportamientoConceptoNominaDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'comportamiento-concepto-nomina';
  }
}

module.exports = ComportamientoConceptoNominaDetallePage;
