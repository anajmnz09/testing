const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Diálogo/modal de DevExtreme (`.dx-popup-wrapper` / `.dx-overlay-wrapper`).
 *
 * Es un patrón que se repite en toda la app (importar documentos, confirmar,
 * editar en un modal…), por eso vive en el core. Encapsula lo transversal:
 *  - esperar a que el popup correcto esté visible;
 *  - accionar un botón por su NOMBRE ACCESIBLE (aria-label / title / texto),
 *    salteando los deshabilitados —igual criterio que FormsHeader: no se adivina
 *    por posición ni índice—;
 *  - saber si sigue abierto y esperar a que cierre.
 *
 * El popup correcto se identifica por un `contiene` (un selector de algo que solo
 * ese popup tiene, ej. `.clasificacionSelecBox`) en vez de por el texto del
 * título, que suele no estar en un elemento estable.
 */

const POPUP_SELECTOR = '.dx-popup-wrapper, .dx-overlay-wrapper';
const DATA_QA = 'popup-accion';

/* eslint-disable no-undef */
/** Corre EN EL BROWSER: devuelve el popup visible objetivo (o null). */
function _popupVisibleEnBrowser(selector, contiene) {
  const vis = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
  const popups = Array.from(document.querySelectorAll(selector)).filter(vis);
  const objetivo = contiene
    ? popups.filter((p) => p.querySelector(contiene))
    : popups;
  // el último visible es el de más arriba en el z-order (el modal activo)
  return objetivo.length ? objetivo[objetivo.length - 1] : null;
}

/** Corre EN EL BROWSER: marca con data-qa el botón del popup cuyo nombre coincide. */
function _accionarEnBrowser(selector, contiene, fuenteRegex, marca) {
  const re = new RegExp(fuenteRegex, 'i');
  const previo = document.querySelector('[data-qa="' + marca + '"]');
  if (previo) previo.removeAttribute('data-qa');

  const vis = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
  const popups = Array.from(document.querySelectorAll(selector)).filter(vis);
  const cand = contiene ? popups.filter((p) => p.querySelector(contiene)) : popups;
  const popup = cand.length ? cand[cand.length - 1] : null;
  if (!popup) return { encontrado: false, motivo: 'popup-no-visible', botones: [] };

  const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  const at = (el, a) => (el && el.getAttribute ? el.getAttribute(a) : null) || '';
  const nombreDe = (el) => [at(el, 'aria-label'), at(el, 'title'), at(el, 'data-testid'), txt(el)]
    .filter(Boolean).join(' | ');
  const deshab = (el) =>
    /dx-state-disabled|customButton-disabled/.test(el.className || '') || !!el.disabled;

  const clickeables = Array.from(popup.querySelectorAll('.dx-button, button, [role="button"], [class*="Button"], a'))
    .filter(vis);
  const inventario = clickeables.map((b) => ({ nombre: nombreDe(b) || null, deshabilitado: deshab(b) }));

  // primero un candidato habilitado; si todos los que matchean están
  // deshabilitados, se reporta el deshabilitado (el test decide).
  let deshabilitadoMatch = null;
  for (const b of clickeables) {
    if (!re.test(nombreDe(b))) continue;
    if (deshab(b)) { deshabilitadoMatch = deshabilitadoMatch || b; continue; }
    b.setAttribute('data-qa', marca);
    return { encontrado: true, nombre: nombreDe(b) || null, deshabilitado: false, botones: inventario };
  }
  if (deshabilitadoMatch) {
    deshabilitadoMatch.setAttribute('data-qa', marca);
    return { encontrado: true, nombre: nombreDe(deshabilitadoMatch) || null, deshabilitado: true, botones: inventario };
  }
  return { encontrado: false, motivo: 'sin-coincidencias', botones: inventario };
}
/* eslint-enable no-undef */

class Popup extends BaseComponent {
  /**
   * @param driver
   * @param {object} [opts]
   * @param {string} [opts.selector]  selector del wrapper del popup
   * @param {string} [opts.contiene]  selector de algo propio de ESE popup, para
   *                                  distinguirlo de otros modales abiertos
   */
  constructor(driver, { selector = POPUP_SELECTOR, contiene = null } = {}) {
    super(driver);
    this.selector = selector;
    this.contiene = contiene;
  }

  /** True si el popup objetivo está visible ahora mismo. */
  async estaVisible() {
    const el = await this.driver.executeScript(_popupVisibleEnBrowser, this.selector, this.contiene);
    return !!el;
  }

  /** Espera (explícito) a que el popup objetivo esté visible. Lanza si no aparece. */
  async esperarVisible(timeout = config.timeouts.explicitWaitMs) {
    await this.driver.wait(async () => this.estaVisible(), timeout).catch(() => {
      throw new Error(
        `Popup: no apareció el popup ${this.contiene ? `(contiene "${this.contiene}") ` : ''}` +
          `tras ${timeout}ms`
      );
    });
    return this;
  }

  /** Espera a que el popup objetivo deje de estar visible. */
  async esperarCerrado(timeout = config.timeouts.explicitWaitMs) {
    await this.driver.wait(async () => !(await this.estaVisible()), timeout).catch(() => {});
    return this;
  }

  /**
   * Ubica (sin clickear) un botón del popup por su nombre accesible.
   * @returns diagnóstico { encontrado, nombre?, deshabilitado?, motivo?, botones }
   */
  async ubicarBoton(patron, dataQa = DATA_QA) {
    const fuente = patron instanceof RegExp ? patron.source : String(patron);
    return this.driver.executeScript(_accionarEnBrowser, this.selector, this.contiene, fuente, dataQa);
  }

  /**
   * Espera (explícito) a que el botón exista en el popup. No lanza: devuelve el
   * diagnóstico para que el test decida el assert.
   */
  async esperarBoton(patron, { timeout = config.timeouts.explicitWaitMs, dataQa = DATA_QA } = {}) {
    let info = { encontrado: false, botones: [] };
    await this.driver
      .wait(async () => {
        info = await this.ubicarBoton(patron, dataQa);
        return info.encontrado;
      }, timeout)
      .catch(() => {});
    return info;
  }

  /**
   * Clickea (por JS) un botón del popup por su nombre accesible.
   * NO adivina: si no lo identifica, devuelve `encontrado:false` con el
   * inventario del popup para diagnóstico. No clickea deshabilitados.
   * @returns diagnóstico { encontrado, nombre?, deshabilitado?, motivo?, botones }
   */
  async accionar(patron, { etiqueta, timeout = config.timeouts.explicitWaitMs, dataQa = DATA_QA } = {}) {
    const nombre = etiqueta || String(patron);
    const info = await this.esperarBoton(patron, { timeout, dataQa });

    if (!info.encontrado) {
      logger.error(`Popup: no se encontró el botón "${nombre}" (${info.motivo}). Botones: ${JSON.stringify(info.botones)}`);
      return info;
    }
    if (info.deshabilitado) {
      logger.error(`Popup: el botón "${nombre}" está deshabilitado`);
      return info;
    }

    logger.info(`Popup: accionando "${nombre}"`);
    const btn = await this.driver.findElement(By.css(`[data-qa="${dataQa}"]`));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
    await this.driver.executeScript('arguments[0].click()', btn);
    return info;
  }

  /** Inventario de botones del popup (diagnóstico para evidencias). */
  async botones() {
    const info = await this.ubicarBoton('__inventario_sin_coincidencia__');
    return info.botones || [];
  }
}

Popup.POPUP_SELECTOR = POPUP_SELECTOR;

module.exports = Popup;
