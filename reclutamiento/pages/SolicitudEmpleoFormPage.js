const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const testContext = require('@triple/core/context/testContext');

/**
 * Mapa CONTROL -> SELECTION STRATEGY del formulario "Crear Solicitud" (panel
 * de creación, NO un dxPopup de DevExtreme — verificado, ver
 * SolicitudEmpleoPage.crear()).
 *
 * Verificado por inspección real de la app (NO asumido):
 *  - Usa el widget nativo `dxForm` de DevExtreme (clase `dx-field-item`), NO
 *    la convención `group-field` propia de la app (ej. Requisiciones). Por eso
 *    `Form._campo()` se generalizó para soportar ambas (core/components/Form.js).
 *  - "Tipo ID" tiene 3 opciones confirmadas: Cedula, Pasaporte, Registro
 *    Nacional del Contribuyente. Cambia la máscara de "Identificación"
 *    (11 / 9 / 9 dígitos respectivamente, confirmado exacto).
 *  - "Requisición" es internamente un `dx-tagbox`, pero se COMPORTA como
 *    single-select real: seleccionar una segunda opción REEMPLAZA la primera
 *    (confirmado, nunca acumula tags). Se declara `searchAndSelect` (no
 *    `tagSelect`): la mecánica de abrir+elegir-por-texto es la misma que
 *    cualquier selectbox, y así el test nunca la trata como multi-valor.
 *  - "Etiquetas" SÍ es un tagbox de texto libre real (click + escribir + ENTER
 *    agrega un tag nuevo, sin elegir de un catálogo) — estrategia `custom`
 *    sobre `Form.escribirTagLibre` (nuevo método genérico del core).
 *  - "Fecha Ingreso" trae la fecha de HOY por defecto; `datePicker` no toca
 *    nada si no se provee valor (mismo comportamiento que "Fecha de Creación"
 *    en Requisiciones).
 *
 * Campos que NUNCA se declaran acá (no se tocan, nunca):
 *  - "Origen Solicitante": automático (interno/externo), no interactivo.
 *  - "Departamento", "Puesto de trabajo", "Supervisor": disabled, se
 *    autocompletan SOLO al elegir "Requisición" (confirmado: siguen disabled
 *    antes y después, nunca editables).
 *
 * Campos declarados pero NO llenados por el loop genérico (ver
 * `completarConContexto`): "Tipo ID" e "Identificación" — deben ir ANTES, en
 * ese orden, vía `seleccionarTipoId()` + `identificarYEsperarAutollenado()`.
 *
 * Pendiente de confirmar durante la implementación (no asumido todavía, según
 * indicación explícita): máscara real de "Celular" y validación de "Correo".
 */
const ESTRATEGIAS = {
  'Tipo ID': 'directSelect',
  Identificación: 'text',
  'Primer Nombre': 'text',
  'Segundo Nombre': 'text',
  'Primer Apellido': 'text',
  'Segundo Apellido': 'text',
  'Grado académico': 'searchAndSelect',
  Celular: 'text',
  Correo: 'text',
  Requisición: 'searchAndSelect',
  'Fecha Ingreso': 'datePicker',
  Etiquetas: { estrategia: 'custom', fn: (form, label, valor) => form.escribirTagLibre(label, valor) },
  Comentario: 'text',
};

class SolicitudEmpleoFormPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    // Botón "Guardar": el panel NO es un dxPopup (verificado, ver
    // SolicitudEmpleoPage.crear()), así que se ubica por texto exacto, igual
    // que RequisicionFormPage.guardar().
    this.btnGuardar = By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  async estaCargado() {
    // Mismo criterio que RequisicionFormPage.estaCargado(): esperar un
    // selectbox visible, sin acceder a métodos internos de Form. Además,
    // esperarSinLoader() (mismo mecanismo genérico que usa
    // RequisicionesPage.abrirFormularioCrear()): el panel re-renderiza tras la
    // primera pintura mientras cargan catálogos, y sin esto la primera
    // interacción puede toparse con un elemento ya obsoleto (stale).
    await this.waitVisible(By.css('.dx-selectbox'));
    await this.esperarSinLoader();
    return this;
  }

  /** Pone un valor con la estrategia declarada para ese control (igual criterio que RequisicionFormPage). */
  async setCampo(label, valor, extras = {}) {
    const declarado = ESTRATEGIAS[label];
    const base = typeof declarado === 'string' ? { estrategia: declarado } : declarado || {};
    return this.form.setValor(label, valor, { ...base, ...extras });
  }

  /**
   * "Tipo ID" DEBE elegirse ANTES que "Identificación": cambia su máscara.
   * Valores confirmados: 'Cedula', 'Pasaporte', 'Registro Nacional del Contribuyente'.
   */
  async seleccionarTipoId(valor) {
    return this.setCampo('Tipo ID', valor);
  }

  /**
   * Escribe SOLO los dígitos de la identificación (la máscara agrega los
   * guiones, confirmado) y espera —de forma EXPLÍCITA, no con sleep fijo— a
   * que la app autocomplete "Primer Nombre" si reconoce un empleado interno
   * (confirmado: ocurre casi instantáneo, ~600ms). Si nunca ocurre (solicitante
   * externo, sin reconocimiento), NO es un error: se continúa con el timeout
   * agotado.
   *
   * Requiere que `seleccionarTipoId()` ya se haya llamado (la máscara debe
   * coincidir con la cantidad de dígitos de `identificacion`).
   */
  async identificarYEsperarAutollenado(identificacion, timeout = 3000) {
    logger.info(`SolicitudEmpleoForm: escribir Identificación y esperar autollenado si aplica`);
    // clear:false — verificado en la app real: este editor (máscara dinámica)
    // lanza "invalid element state" con el `.clear()` por defecto de
    // Form.escribir(); mismo problema ya documentado en
    // RequisicionFormPage.agregarPreguntaPersonalizada() para otros editores.
    await this.form.escribir('Identificación', identificacion, { clear: false });

    const hayAutollenado = await this.driver
      .wait(async () => !(await this.form.estaVacio('Primer Nombre')), timeout)
      .then(() => true)
      .catch(() => {
        logger.info('SolicitudEmpleoForm: sin autollenado tras Identificación (posible solicitante externo)');
        return false;
      });

    if (hayAutollenado) {
      // El campo deja de estar "vacío" (cambia de clase) un instante ANTES de
      // que el valor final termine de asentarse — verificado en la app real:
      // leer inmediatamente tras ese cambio devuelve un valor transitorio
      // incorrecto. Se espera EXPLÍCITAMENTE a que el valor deje de cambiar
      // (dos lecturas consecutivas iguales), no un sleep ciego de duración fija.
      let anterior = null;
      await this.driver
        .wait(async () => {
          const actual = await this.form.getValor('Primer Nombre');
          const estable = actual === anterior;
          anterior = actual;
          return estable;
        }, 2000)
        .catch(() => {});
    }
  }

  /**
   * Completa los controles declarados en ESTRATEGIAS (salvo "Tipo ID" e
   * "Identificación", que van antes por separado) DESDE el Execution Context.
   *
   * CLAVE — "completar solo vacíos": si un campo YA tiene datos (autollenado
   * de empleado interno, o cualquier valor previo), NUNCA se sobreescribe, sin
   * importar si el Execution Context trae un valor para ese label. Reutiliza
   * `Form.estaVacio()` (ya existente en el core), mismo patrón que
   * `RequisicionFormPage.completarRequeridosConContexto` ya usa para sus
   * selects — no se inventa un mecanismo nuevo.
   *
   * @param {string} caso
   * @param {{incluirOpcionales?: boolean}} [opts]  con `incluirOpcionales:true`,
   *   además completa los campos vacíos que el contexto NO especificó, usando
   *   la estrategia por defecto de cada uno.
   */
  async completarConContexto(caso, { incluirOpcionales = false } = {}) {
    logger.info(`SolicitudEmpleoForm: completar campos desde Execution Context (caso="${caso}")`);
    await this.form.validarControlesDeclarados(ESTRATEGIAS, { etiqueta: 'crear-solicitud-empleo' });
    const val = (label) => testContext.get(caso, label);

    const yaTratados = ['Tipo ID', 'Identificación'];
    const resultado = {};

    for (const label of Object.keys(ESTRATEGIAS)) {
      if (yaTratados.includes(label)) continue;

      if (!(await this.form.estaVacio(label))) {
        logger.info(`SolicitudEmpleoForm: "${label}" ya tiene datos, no se sobreescribe`);
        continue;
      }

      const provisto = val(label);
      if (provisto !== undefined) {
        resultado[label] = await this.setCampo(label, provisto);
      } else if (incluirOpcionales) {
        resultado[label] = await this.setCampo(label);
      }
    }
    return resultado;
  }

  /**
   * Guarda el formulario. Click por JS (mismo criterio que
   * `RequisicionFormPage.guardar()`: en headers sticky el click nativo puede
   * quedar interceptado) — sin evidencia todavía de si hace falta acá
   * específicamente, pero es el default seguro ya establecido en el framework
   * para este patrón de botón.
   */
  async guardar() {
    logger.info('SolicitudEmpleoForm: Guardar');
    const btn = await this.waitVisible(this.btnGuardar);
    await this.driver.executeScript('arguments[0].click()', btn);
  }

  /**
   * Clasifica el resultado tras Guardar según el notify (mismo mecanismo que
   * RequisicionFormPage, vía el componente Notify del core).
   *
   * PENDIENTE de confirmar con una corrida real: no se guardó ningún registro
   * durante la investigación (instrucción explícita de no crear registros).
   * La app "debe mostrar el solicitante recién creado" según lo indicado, pero
   * no hay evidencia todavía de qué pantalla/selector confirma eso — por ahora
   * la única evidencia de guardado exitoso es el notify.
   */
  async resultadoGuardado(timeoutMs = config.timeouts.explicitWaitMs) {
    const texto = await this.notify.esperarTexto(timeoutMs);
    return Notify.clasificar(texto);
  }
}

module.exports = SolicitudEmpleoFormPage;
