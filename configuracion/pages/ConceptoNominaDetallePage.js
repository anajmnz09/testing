const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Concepto de nómina" (Configuración > Nómina >
 * Concepto de nómina). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (metadata real, `screenInspector`):
 *  - "Nombre": texto libre REQUERIDO — identificador de la fila.
 *  - "Tipo concepto"/"Clase"/"Origen"/"Tipo Ingreso"/"Tipo Valor": selectbox
 *    SIN buscador (confirmado: sin clase `search-icon` en la metadata, a
 *    diferencia de otros catálogos de la app) — `directSelect`, no
 *    `searchAndSelect`.
 *  - "Código Alterno": texto libre OPCIONAL.
 *  - "% Pago Horas": numberbox OPCIONAL. Muestra "0" por defecto y, IGUAL
 *    que "Tarifa"/"Precio Hora"/"Rate" en otras entidades (confirmado con
 *    evidencia real, no una suposición corregida a tiempo la primera vez):
 *    ese "0" NUNCA cuenta como vacío para `estaVacio()`, así que
 *    `completarConContexto` lo saltea SIEMPRE aunque el Panel dirija un
 *    valor — el test de Crear lo completa explícito, solo cuando el Panel
 *    lo dirige (al ser opcional, sin dirección "0" es válido).
 *  - "Estado": selectbox REQUERIDO, DESHABILITADO al Crear con un valor
 *    preseleccionado (mismo patrón que la mayoría de entidades de
 *    Configuración) — `directSelect`.
 *  - "% Incluye": tagbox OPCIONAL, DESHABILITADO al Crear (se habilita según
 *    otro campo, no confirmado cuál) — A PROPÓSITO no se declara en
 *    ESTRATEGIAS (no se puede completar de todos modos mientras esté
 *    deshabilitado).
 *  - A PEDIDO EXPLÍCITO del usuario: el form tiene 4 tabs ("Indicadores"
 *    —12 switches tipo "Aplica para AFP/ARS/ISR/INFOTEP/Riesgos Laboral/
 *    Autodeterminación", "Descontar Antes de ISR", "Aplica para Regalía/
 *    Bonificación/Prestaciones/Provisión", "Acumulado"—, "Datos Contables e
 *    Integración", "Configuración Horas", "Otros") y NINGUNO de los 4 se
 *    mapea ni se declara en ESTRATEGIAS — se ignoran todos, igual criterio
 *    que "Distribución Centro Costo" en Departamentos.
 */
const ESTRATEGIAS = {
  Nombre: 'text',
  'Tipo concepto': 'directSelect',
  Clase: 'directSelect',
  'Código Alterno': 'text',
  Origen: 'directSelect',
  'Tipo Ingreso': 'directSelect',
  '% Pago Horas': 'text',
  Estado: 'directSelect',
  'Tipo Valor': 'directSelect',
};

class ConceptoNominaDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'concepto-nomina';
  }
}

module.exports = ConceptoNominaDetallePage;
