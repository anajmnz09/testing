const { By } = require('selenium-webdriver');
const BasePage = require('./base/BasePage');
const Form = require('../components/Form');
const Notify = require('../components/Notify');
const FormsHeader = require('../components/FormsHeader');
const Popup = require('../components/Popup');
const logger = require('../utils/logger');
const config = require('../config');
const testContext = require('../context/testContext');
const { textoIgual } = require('../utils/assert');

/**
 * Base reutilizable para la pantalla de UN registro de cualquier entidad de
 * "Configuración > Administración > <Entidad>" (Sucursales, Departamentos,
 * Puestos, …). Es UNA SOLA pantalla para los tres casos (Crear / Consultar /
 * Editar) — mapeo verificado con Selenium Headed, primero en Sucursales y
 * confirmado igual en Departamentos:
 *   - Al abrir un registro del listado (doble-click) llega en modo CONSULTA
 *     (campos deshabilitados/readonly, header con botones "Crear"/"Editar").
 *   - Al clickear "Crear" en el listado, llega DIRECTO en modo edición (sin
 *     nombre de registro todavía, campos habilitados, header con "Guardar"/
 *     "Descartar") — mismo formulario, mismos labels.
 *   - Al clickear "Editar" desde consulta, pasa de deshabilitado a habilitado
 *     y el header cambia a "Guardar"/"Descartar".
 *   - Header: `.forms-header` (MISMA clase que Requisición/Solicitud) — se
 *     reutiliza `FormsHeader` del core para "Editar".
 *   - El formulario puede usar CUALQUIERA de las dos convenciones de la app
 *     (`dxForm` nativo / `group-field`) — `Form._campo()` ya soporta ambas,
 *     cada entidad declara sus campos sin preocuparse por cuál usa.
 *   - Clickear "Guardar" abre ADEMÁS un popup de confirmación genérico
 *     (`confirmPopupContent`, el MISMO mecanismo ya usado en Banco de
 *     candidatos) — hay que confirmarlo ahí antes de que la operación se
 *     aplique de verdad.
 *   - Tras confirmar, la app RECARGA la pantalla (aparece "Cargando...") —
 *     leer el nombre/valores de un campo INMEDIATAMENTE después del notify
 *     puede caer en ese instante de transición y devolver vacío; por eso
 *     `esperarNombre`/`esperarValor` (poll) en vez de una lectura directa.
 *
 * Cada entidad SOLO necesita extender esta clase y declarar:
 *   - `static get ESTRATEGIAS()` — mapa control -> Selection Strategy.
 *   - `static get NOMBRE_ENTIDAD()` (opcional) — nombre corto para logs/
 *     `validarControlesDeclarados` (ej. "sucursal"); si no se declara, usa el
 *     nombre de la clase.
 * Cualquier campo/sección que la entidad quiera IGNORAR a propósito (ej.
 * "Distribución Centro Costo" en Departamentos) simplemente no se declara en
 * `ESTRATEGIAS` — no hace falta excluirlo acá.
 */
class ConfiguracionEntidadDetallePage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). La pantalla de un registro abre la edición con `editar`; al guardar captura el valor del control `CAMPO_IDENTIFICADOR` y, cuando
   * `resultadoGuardado` confirma el éxito, publica/actualiza la entidad `NOMBRE_ENTIDAD` con ese nombre.
   * Lo lee el escáner estático y la capa común de publicación; en ejecución individual no se usa.
   */
  static get ENTIDAD_FLUJO() {
    return {
      tipo: this.NOMBRE_ENTIDAD,
      referencia: 'nombre',
      metodos: [],
      editores: ['editar'],
      confirmadores: [{ metodo: 'guardar', leer: 'antes', capturar: true }, { metodo: 'resultadoGuardado', datos: null }],
    };
  }

  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    this.header = By.css('[class*="forms-header"]');
    this.acciones = new FormsHeader(driver);
    // El header NO es un dxPopup: se localiza por texto exacto, con click
    // por JS (header sticky) — misma convención que Requisición/Solicitud.
    this.btnGuardar = By.xpath("//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
    this.nombreRegistro = By.css('.record-name');
    // Popup de confirmación tras clickear "Guardar" (ver mapeo de clase).
    this.popupConfirmar = new Popup(driver, { contiene: '.confirmPopupContent' });
  }

  /** Mapa control -> Selection Strategy (OBLIGATORIO: cada entidad lo declara). */
  static get ESTRATEGIAS() {
    throw new Error(`${this.name}: falta declarar "static get ESTRATEGIAS()".`);
  }

  /** Nombre corto para logs (por defecto, el nombre de la clase). */
  static get NOMBRE_ENTIDAD() {
    return this.name;
  }

  get _estrategias() {
    return this.constructor.ESTRATEGIAS;
  }

  /** Espera a que la pantalla esté cargada (header visible, sin loader). */
  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(this.header, timeout);
    await this.esperarSinLoader(timeout);
    return this;
  }

  /** Nombre del registro mostrado en el header ('' en el formulario de Crear, antes del primer Guardar). */
  async getNombre() {
    const els = await this.driver.findElements(this.nombreRegistro);
    if (!els.length) return '';
    return (await els[0].getText()).trim();
  }

  /**
   * Espera (poll) a que el header muestre `nombreEsperado`. Tras Guardar en
   * "Crear", confirmado con evidencia real: la app RECARGA la pantalla — leer
   * `getNombre()` inmediatamente después del notify puede caer en ese
   * instante de transición y devolver vacío. Devuelve el nombre final leído
   * (puede diferir de `nombreEsperado` si nunca llegó, para que el test arme
   * su propio mensaje de assert).
   */
  async esperarNombre(nombreEsperado, timeout = config.timeouts.explicitWaitMs) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = await this.getNombre();
        return textoIgual(actual, nombreEsperado);
      }, timeout)
      .catch(() => {});
    return actual;
  }

  /** Valor actual de un campo (funciona tanto en modo consulta como edición). */
  async getValor(label) {
    return this.form.getValor(label);
  }

  /** Espera (poll) a que el campo `label` muestre `esperado` — mismo motivo que `esperarNombre`. */
  async esperarValor(label, esperado, timeout = config.timeouts.explicitWaitMs) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = (await this.getValor(label)).trim();
        return textoIgual(actual, String(esperado));
      }, timeout)
      .catch(() => {});
    return actual;
  }

  /** Entra en modo edición ("Editar" del header) — tolerante, no lanza si el botón no aparece. */
  async editar(timeout = config.timeouts.explicitWaitMs) {
    logger.info(`${this.constructor.name}: entrar en modo edición ("Editar")`);
    const info = await this.acciones.clickBoton('editar', { etiqueta: 'Editar', timeout });
    if (info.accionado) {
      await this.esperarSinLoader(timeout);
      await this.waitVisible(this.btnGuardar, timeout).catch(() => {});
      // Que "Guardar" ya esté visible NO garantiza que TODOS los campos ya
      // estén habilitados — confirmado con evidencia real (Horarios):
      // escribir en un campo apenas aparece "Guardar" puede tirar `element
      // not interactable`, porque ESE campo puntual todavía tiene
      // `dx-state-disabled` un instante más (el des-habilitado es un paso
      // async propio, no atado al render del botón). Se espera (poll,
      // acotado) a que la cantidad de editores deshabilitados en la
      // pantalla se ESTABILICE entre dos lecturas — genérico, sin depender
      // de qué campo puntual declare cada entidad.
      await this._esperarCamposHabilitados();
    }
    return info;
  }

  /** Espera (poll, acotado, tolerante) a que la cantidad de `.dx-state-disabled` en pantalla deje de cambiar — ver `editar()`. */
  async _esperarCamposHabilitados(timeout = 2000) {
    let anterior = null;
    await this.driver
      .wait(async () => {
        const actual = await this.driver.executeScript(() => document.querySelectorAll('.dx-state-disabled').length);
        const estable = actual === anterior;
        anterior = actual;
        return estable;
      }, timeout)
      .catch(() => {});
  }

  /** Pone un valor con la estrategia declarada para ese control. */
  async setCampo(label, valor, extras = {}) {
    const declarado = this._estrategias[label];
    const base = typeof declarado === 'string' ? { estrategia: declarado } : declarado || {};
    return this.form.setValor(label, valor, { ...base, ...extras });
  }

  /**
   * Completa los controles declarados en `ESTRATEGIAS` DESDE el Execution
   * Context. Criterio "completar solo vacíos": si un campo ya tiene datos
   * (ej. deshabilitado con un valor pre-cargado), nunca se sobreescribe.
   *
   * @param {string} caso
   * @param {{incluirOpcionales?: boolean, excepto?: string[]}} [opts]
   *   `excepto`: labels que este pase NO debe tocar, ni siquiera para leer si
   *   están vacíos — para campos cuya habilitación depende de OTRO campo (ej.
   *   "Tipo Ingreso" solo es clickeable con "Origen"="Ingreso" — regla real de
   *   la app) y que el test ya resolvió explícito ANTES de llamar acá. Sin
   *   esto, el autofill genérico intentaría tocar un control deshabilitado y
   *   colgarse/fallar tratando de abrir un dropdown no clickeable.
   */
  async completarConContexto(caso, { incluirOpcionales = false, excepto = [] } = {}) {
    const entidad = this.constructor.NOMBRE_ENTIDAD;
    logger.info(`${this.constructor.name}: completar formulario desde Execution Context (caso="${caso}")`);
    await this.form.validarControlesDeclarados(this._estrategias, { etiqueta: entidad });
    const val = (label) => testContext.get(caso, label);
    const resultado = {};

    for (const label of Object.keys(this._estrategias)) {
      if (excepto.includes(label)) continue;
      if (!(await this.form.estaVacio(label))) {
        logger.info(`${this.constructor.name}: "${label}" ya tiene datos, no se sobreescribe`);
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
   * Control que IDENTIFICA al registro (su nombre en el listado). Cada entidad lo declara si no se llama "Nombre"; debe ser una
   * clave de `ESTRATEGIAS` (lo vigila el contrato de flujos). El flujo publica su valor como referencia de la entidad.
   */
  static get CAMPO_IDENTIFICADOR() {
    return 'Nombre';
  }

  /** Datos de referencia para el flujo: el valor del control identificador, leído ANTES de guardar (después el formulario se recarga). */
  async _datosFlujo() {
    const nombre = String(await this.form.getValor(this.constructor.CAMPO_IDENTIFICADOR, { intentos: 1, timeoutMs: 5000 })).trim();
    return nombre ? { nombre } : null;
  }

  /**
   * Guarda (botón "Guardar" del header) y confirma el popup que aparece
   * después (ver mapeo de clase). Reintenta el click del header ante
   * `StaleElementReferenceError`.
   */
  async guardar(intentos = 3) {
    logger.info(`${this.constructor.name}: Guardar`);
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const btn = await this.waitVisible(this.btnGuardar);
        await this.driver.executeScript('arguments[0].click()', btn);
        break;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
        logger.info(`${this.constructor.name}: botón "Guardar" "stale" (intento ${intento}/${intentos}), reintentando`);
      }
    }

    const apareceConfirm = await this.popupConfirmar
      .esperarVisible(4000)
      .then(() => true)
      .catch(() => false);
    if (apareceConfirm) {
      // El botón afirmativo del popup NO tiene un texto único en toda la
      // app — confirmado con evidencia real: Sucursales/Departamentos usan
      // "Guardar", Puestos usa "Aceptar" (mismo popup genérico
      // `confirmPopupContent`, distinto texto según la pantalla). Se matchea
      // cualquiera de los conocidos; si la app agrega una variante nueva,
      // agregarla acá (una sola vez, para toda entidad de Configuración).
      logger.info(`${this.constructor.name}: confirmando popup de "Guardar"`);
      const accion = await this.popupConfirmar.accionar(/guardar|aceptar/i, { etiqueta: 'Guardar/Aceptar' });
      if (!accion.encontrado || accion.deshabilitado) {
        throw new Error(`${this.constructor.name}: no se pudo confirmar el popup de Guardar (${JSON.stringify(accion)}).`);
      }
      await this.popupConfirmar.esperarCerrado();
    }
  }

  /** Clasifica el resultado tras Guardar según el notify (mismo mecanismo que el resto del framework). */
  async resultadoGuardado(timeoutMs = config.timeouts.explicitWaitMs) {
    const texto = await this.notify.esperarTexto(timeoutMs);
    return Notify.clasificar(texto);
  }
}

module.exports = ConfiguracionEntidadDetallePage;
