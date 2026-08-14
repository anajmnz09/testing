const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Horarios" (Configuración > Administración >
 * Horarios). Toda la mecánica genérica vive en `ConfiguracionEntidadDetallePage`
 * (core) — acá solo el mapeo PROPIO de Horarios.
 *
 * Mapeo verificado con Selenium Headed (HTML real inspeccionado):
 *  - Usa la convención `group-field` (igual que Departamentos/Requisiciones),
 *    NO `dx-field-item`.
 *  - Campo REQUERIDO además de las horas: "Descripción" (texto libre) — es
 *    también la columna que identifica la fila en el listado, así que se
 *    usa para `abrirDetalle`/`buscar` (no hay un "Nombre" separado en esta
 *    entidad).
 *  - "Hora Inicial"/"Hora final" (`dx-datebox` tipo `time`, REQUERIDOS) son
 *    un editor de lista (`dx-datebox-list`, incrementos de 30 min), pero
 *    ACEPTAN escribirse directo como texto SIEMPRE que el texto matchee
 *    EXACTO el formato local que usa la lista: "8:00 a. m." / "5:00 p. m."
 *    (hora sin cero a la izquierda, "a. m."/"p. m." con puntos y espacio) —
 *    confirmado con evidencia real, incluyendo que "Jornada diaria"
 *    recalcula sola tras tipear ambos campos así. Escribir en un formato
 *    "razonable" pero DISTINTO (ej. "08:00 AM", con cero a la izquierda y
 *    sin puntos) se ve aceptado visualmente pero el validador lo rechaza
 *    igual ("Operación Inválida" al Guardar, "Jornada diaria" nunca
 *    recalcula) — el parser del widget exige el formato exacto, no uno
 *    "parecido". Por eso la estrategia `custom` normaliza cualquier hora
 *    razonable ("8:00 AM", "08:00", "17:00", "5:00 pm") al formato exacto
 *    ANTES de escribirla (`_formatoHoraLista`), en vez de tratar de
 *    seleccionarla de la lista (innecesario: escribir el texto exacto ya
 *    alcanza, y evita lidiar con la virtualización de esa lista de 48
 *    ítems).
 *  - "Jornada diaria" se CALCULA SOLA a partir de "Hora Inicial"/"Hora
 *    final" (`dx-numberbox` SIEMPRE deshabilitado, confirmado) — A PEDIDO
 *    EXPLÍCITO no se declara en `ESTRATEGIAS` (no se puede completar de
 *    todos modos, y no debe ofrecerse como parámetro del Panel).
 *  - "Estado" es un selectbox editable (a diferencia de Sucursales/Puestos,
 *    acá NO está deshabilitado ni es requerido) — estrategia `directSelect`.
 *  - "Referencia" es texto libre opcional, con `maxlength="10"` (confirmado
 *    con evidencia real) — un valor más largo se trunca solo, sin error.
 *  - Esta pantalla NO tiene tabview/sección adicional que obviar (a
 *    diferencia de Departamentos/Puestos).
 *  - El buscador del listado (`grid.buscar()`) está ROTO en el ambiente
 *    actual (confirmado con evidencia real: buscar CUALQUIER texto, incluso
 *    el de un registro recién creado por este mismo framework, dispara
 *    "Internal Error" del backend) — mientras esa falla siga,
 *    `consultar-horario`/`editar-horario` usan
 *    `ConfiguracionEntidadListadoPage.abrirPrimero()` (doble-click directo
 *    en la primera fila, sin buscador) en vez de `abrirDetalle(nombre)`; no
 *    se puede dirigir un Horario puntual por nombre desde el Panel todavía.
 */

/**
 * Convierte una hora en formato "razonable" (12h con AM/PM en cualquier
 * variante, o 24h sin AM/PM) al formato EXACTO que el widget de la app
 * acepta al escribirse ("8:00 a. m.", "5:00 p. m." — sin cero a la
 * izquierda en la hora, "a. m."/"p. m." con puntos y espacio). Si no
 * reconoce el patrón, devuelve el valor tal cual (deja que la app lo
 * rechace explícito con "Operación Inválida", en vez de adivinar).
 */
function _formatoHoraLista(valor) {
  const m = String(valor)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*([AaPp]\.?\s*[Mm]\.?)?$/);
  if (!m) return valor;

  let horas = parseInt(m[1], 10);
  const minutos = m[2];
  let ampm = m[3];

  if (ampm) {
    ampm = /^p/i.test(ampm) ? 'p. m.' : 'a. m.';
  } else {
    ampm = horas >= 12 ? 'p. m.' : 'a. m.';
    horas = horas % 12;
    if (horas === 0) horas = 12;
  }
  return `${horas}:${minutos} ${ampm}`;
}

function _escribirHora(form, label, valor) {
  if (valor === undefined || valor === null || valor === '') return undefined;
  const formateado = _formatoHoraLista(valor);
  return form.escribir(label, formateado);
}

const ESTRATEGIAS = {
  Referencia: 'text',
  'Hora Inicial': { estrategia: 'custom', fn: _escribirHora },
  'Hora final': { estrategia: 'custom', fn: _escribirHora },
  Descripción: 'text',
  Estado: 'directSelect',
};

class HorarioDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'horario';
  }

  /** Formato EXACTO que acepta el widget al escribirse ("8:00 a. m.") a partir de una hora "razonable" — ver mapeo de clase. */
  static formatoHora(valor) {
    return _formatoHoraLista(valor);
  }
}

module.exports = HorarioDetallePage;
