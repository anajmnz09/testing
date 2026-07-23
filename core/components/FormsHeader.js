const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const Notify = require('./Notify');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Barra de acciones superior de las pantallas de formulario/detalle de la app
 * (`<div class="forms-header ...">`, ej. `forms-header requisicion-header`).
 *
 * Vive en el core —y no en un Page Object de módulo— porque el patrón se repite
 * en TODA la app: cada pantalla de detalle tiene su header con acciones (Editar,
 * Cerrar, Pausar, Cancelar…), muchas de ellas **solo ícono**, sin id, sin
 * data-testid y con la imagen embebida como `data:image/png;base64,...`.
 *
 * Cómo localiza un botón (de más estable a menos, primero que coincide gana):
 *   1. **Nombre accesible** del botón: `title`, `aria-label`, `data-testid`,
 *      `alt`/`title` de su `<img>` interno o su texto visible.
 *   2. **Ícono con nombre**: `img`/`svg`/`i` cuyo `title`, `alt`, `aria-label` o
 *      clase describe la acción → se acciona su contenedor clickeable.
 *
 * Qué se considera "clickeable" (ver CLICKEABLE): además de `.dx-button`,
 * `button`, `[role="button"]` y `a`, se incluyen los **botones de acción propios
 * de la app**, que NO son `.dx-button` sino `<div class="xxxButton" title="…">`
 * (ej. `documentoButton` → "Documentos", `seguimientoButton` → "Seguimiento").
 * Se detectan por la convención de clase `*Button` (con B mayúscula), que no
 * colisiona con los internos de DevExtreme (`dx-button-content`, en minúscula).
 * La coincidencia SIEMPRE es por nombre accesible, así que ampliar el conjunto
 * de candidatos no puede seleccionar un botón equivocado: solo permite encontrar
 * más acciones reales.
 *
 * Si ninguna vía identifica el botón, **NO se adivina**: no se usa la posición
 * dentro del header, ni el índice del botón, ni "el único ícono que hay". Se
 * devuelve `encontrado: false` junto con el inventario de acciones del header
 * para que el test falle con un diagnóstico accionable. Un selector que adivina
 * produce falsos verdes y clicks en el botón equivocado, que es peor que fallar.
 *
 * NUNCA se usa el contenido base64 de la imagen como selector: es enorme,
 * cambia con cualquier retoque del ícono y no describe la acción.
 */

const HEADER_SELECTOR = '[class*="forms-header"], [class*="requisicion-header"]';
const DATA_QA = 'header-accion';
const DATA_QA_SWITCH = 'header-switch';

/* eslint-disable no-undef */
/**
 * Corre EN EL BROWSER: marca el botón encontrado con `data-qa` para poder
 * operarlo después con un selector corto y estable, y devuelve el diagnóstico.
 */
function _ubicarEnBrowser(selectorHeader, fuenteRegex, marca) {
  const re = new RegExp(fuenteRegex, 'i');
  const previo = document.querySelector('[data-qa="' + marca + '"]');
  if (previo) previo.removeAttribute('data-qa');

  const header = document.querySelector(selectorHeader);
  if (!header) return { encontrado: false, motivo: 'header-no-encontrado', botones: [] };

  const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
  const at = (el, a) => (el && el.getAttribute ? el.getAttribute(a) : null) || '';

  // `.dx-button` + botones de acción propios de la app (`<div class="xxxButton">`,
  // B mayúscula, que no matchea los internos `dx-button-*` en minúscula).
  const CLICKEABLE = '.dx-button, button, [role="button"], a, [class*="Button"]';

  // Nombre accesible: todo lo que describa la acción SIN depender del base64.
  const nombreDe = (el) => {
    const img = el.querySelector ? el.querySelector('img') : null;
    return [
      at(el, 'title'),
      at(el, 'aria-label'),
      at(el, 'data-testid'),
      at(el, 'alt'),
      img ? at(img, 'title') : '',
      img ? at(img, 'alt') : '',
      img ? at(img, 'aria-label') : '',
      txt(el),
    ]
      .filter(Boolean)
      .join(' | ');
  };

  const clickeables = Array.from(header.querySelectorAll(CLICKEABLE));

  // Diagnóstico: qué acciones ofrece el header (útil en el reporte si falla).
  const inventario = clickeables.map((b) => ({
    nombre: nombreDe(b) || null,
    soloIcono: !txt(b) && !!(b.querySelector && b.querySelector('img, svg, i')),
    deshabilitado: /dx-state-disabled/.test(b.className || '') || !!b.disabled,
    clase: (b.className || '').slice(0, 80),
  }));

  const marcar = (el, via) => {
    el.setAttribute('data-qa', marca);
    return {
      encontrado: true,
      via,
      nombre: nombreDe(el) || null,
      deshabilitado: /dx-state-disabled/.test(el.className || '') || !!el.disabled,
      botones: inventario,
    };
  };

  // 1) por nombre accesible del clickeable
  for (const b of clickeables) {
    if (re.test(nombreDe(b))) return marcar(b, 'nombre-accesible');
  }

  // 2) por la imagen/ícono con nombre -> se acciona su clickeable contenedor
  const iconos = Array.from(header.querySelectorAll('img, svg, i'));
  for (const ic of iconos) {
    const nombreIcono = [at(ic, 'title'), at(ic, 'alt'), at(ic, 'aria-label'), at(ic, 'class')]
      .filter(Boolean)
      .join(' | ');
    if (re.test(nombreIcono)) {
      const cont = ic.closest(CLICKEABLE) || ic.parentElement;
      if (cont) return marcar(cont, 'icono-con-nombre');
    }
  }

  // No hay tercera vía: si el botón no se puede IDENTIFICAR, se falla explícito.
  // (No se usa posición, índice ni "el único ícono anónimo": eso es adivinar.)
  const anonimos = clickeables.filter(
    (b) => !txt(b) && !nombreDe(b) && b.querySelector && b.querySelector('img, svg, i')
  ).length;

  return {
    encontrado: false,
    motivo: anonimos
      ? `sin-coincidencias (hay ${anonimos} botón/es solo-ícono sin nombre accesible: no se adivina cuál es)`
      : 'sin-coincidencias',
    botones: inventario,
  };
}
/* eslint-enable no-undef */

/* eslint-disable no-undef */
/**
 * Corre EN EL BROWSER: ubica un SWITCH del header por la etiqueta que lo
 * describe y lo marca con `data-qa`.
 *
 * Los headers de la app llevan switches de negocio (Publicada, Activo, …) junto
 * a los botones. La búsqueda es ESTRUCTURA-AGNÓSTICA: no depende del orden ni
 * del anidamiento, solo de la etiqueta y, opcionalmente, de un contenedor propio
 * del switch que el Page Object conozca (ej. `[class*="grupo-publicada"]`).
 */
function _ubicarSwitchEnBrowser(selectorHeader, fuenteRegex, marca, selectorContenedor) {
  const re = new RegExp(fuenteRegex, 'i');
  const previo = document.querySelector('[data-qa="' + marca + '"]');
  if (previo) previo.removeAttribute('data-qa');

  const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();

  const marcar = (sw, via) => {
    if (!sw) return null;
    sw.setAttribute('data-qa', marca);
    const cls = sw.className || '';
    return {
      encontrado: true,
      via,
      // DevExtreme expone el estado por aria-pressed y por clase: se leen ambos
      encendido: sw.getAttribute('aria-pressed') === 'true' || /dx-switch-on-value/.test(cls),
      deshabilitado: /dx-state-disabled/.test(cls),
    };
  };

  // 1) Vía primaria: contenedor propio del switch, si el Page Object lo conoce.
  //    Es el locator más estable y evita confundirlo con otro switch del header.
  if (selectorContenedor) {
    const porContenedor = document.querySelector(selectorContenedor + ' .dx-switch');
    if (porContenedor) return marcar(porContenedor, 'contenedor-propio');
  }

  // 2) Fallback: partir de la etiqueta y subir hasta el .dx-switch más cercano.
  //    Las etiquetas suelen venir con dos puntos ("Publicada:"), por eso el
  //    patrón se compara contra el texto normalizado.
  const ambito = document.querySelector(selectorHeader) || document;
  const candidatos = Array.from(ambito.querySelectorAll('label, span, div')).filter((e) =>
    re.test(txt(e))
  );
  for (let i = candidatos.length - 1; i >= 0; i--) {
    let cont = candidatos[i].parentElement;
    let sw = null;
    for (let k = 0; k < 6 && cont && !sw; k++) {
      sw = cont.querySelector('.dx-switch');
      if (!sw) cont = cont.parentElement;
    }
    if (sw) return marcar(sw, 'etiqueta');
  }

  return { encontrado: false, encendido: null, deshabilitado: null, motivo: 'sin-coincidencias' };
}
/* eslint-enable no-undef */

class FormsHeader extends BaseComponent {
  /**
   * @param driver
   * @param {string} [selector] CSS del header (por defecto, el `forms-header` de la app)
   */
  constructor(driver, { selector = HEADER_SELECTOR } = {}) {
    super(driver);
    this.selector = selector;
    this.locator = By.css(selector);
    this.notify = new Notify(driver);
  }

  /** Espera a que el header esté visible y sin loader encima. Encadenable. */
  async listo(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(this.locator, timeout);
    await this.esperarSinLoader(timeout);
    return this;
  }

  /**
   * Busca (una sola pasada) el botón cuyo nombre accesible coincide con `patron`.
   * @param {string|RegExp} patron  ej. 'pausar|pausa'
   * @returns {Promise<{encontrado:boolean, via?:string, nombre?:string, deshabilitado?:boolean, motivo?:string, botones:Array}>}
   */
  async ubicarBoton(patron, dataQa = DATA_QA) {
    const fuente = patron instanceof RegExp ? patron.source : String(patron);
    return this.driver.executeScript(_ubicarEnBrowser, this.selector, fuente, dataQa);
  }

  /**
   * Espera (explícitamente, sin sleeps) a que el botón exista en el header.
   * No lanza si no aparece: devuelve el diagnóstico con `encontrado: false` para
   * que el test decida el assert y el mensaje de fallo.
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
   * Clickea un botón del header por su nombre accesible SIN esperar un notify.
   * Es para acciones que NO producen un toast (abrir un panel, un menú, navegar):
   * esperar el notify ahí solo agregaría un timeout muerto.
   *
   * No adivina: si no lo identifica o está deshabilitado, NO clickea y devuelve
   * el diagnóstico para que el test decida.
   *
   * @returns {Promise<{encontrado:boolean, via?:string, nombre?:string, deshabilitado?:boolean,
   *                    accionado:boolean, motivo?:string, botones:Array}>}
   */
  async clickBoton(patron, { etiqueta, timeout = config.timeouts.explicitWaitMs, dataQa = DATA_QA } = {}) {
    const nombreAccion = etiqueta || String(patron);
    const info = await this.esperarBoton(patron, { timeout, dataQa });

    if (!info.encontrado) {
      logger.error(
        `FormsHeader: no se encontró el botón "${nombreAccion}" (${info.motivo}). ` +
          `Acciones visibles: ${JSON.stringify(info.botones)}`
      );
      return { ...info, accionado: false };
    }
    if (info.deshabilitado) {
      logger.error(`FormsHeader: el botón "${nombreAccion}" está deshabilitado`);
      return { ...info, accionado: false };
    }

    logger.info(`FormsHeader: click "${nombreAccion}" (vía ${info.via}, nombre "${info.nombre}")`);
    const btn = await this.driver.findElement(By.css(`[data-qa="${dataQa}"]`));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
    await this.driver.executeScript('arguments[0].click()', btn);
    return { ...info, accionado: true };
  }

  /**
   * Acciona un botón del header y devuelve el resultado del notify de la app.
   * Compone `clickBoton` (localizar + click) y luego espera el notify.
   *
   * @returns {Promise<{encontrado:boolean, via?:string, nombre?:string, deshabilitado?:boolean,
   *                    notify:string, exito:boolean, invalido:boolean, errorSistema:boolean, botones:Array}>}
   */
  async accionar(patron, { etiqueta, timeout = config.timeouts.explicitWaitMs, dataQa = DATA_QA } = {}) {
    const info = await this.clickBoton(patron, { etiqueta, timeout, dataQa });
    if (!info.accionado) {
      return { ...info, ...Notify.clasificar('') };
    }
    return { ...info, ...(await this.notify.esperarResultado(timeout)) };
  }

  // ---------------------------------------------------------------------------
  // Switches del header (Publicada, Activo, …)
  // ---------------------------------------------------------------------------

  /**
   * Ubica un switch del header por su etiqueta (una pasada, sin esperar).
   * @param {string|RegExp} patron  etiqueta del switch, ej. 'publicada'
   * @param {string} [opts.contenedor] CSS del contenedor propio del switch, si
   *        el Page Object lo conoce (vía más estable).
   * @returns {Promise<{encontrado:boolean, via?:string, encendido:boolean|null, deshabilitado:boolean|null}>}
   */
  async ubicarSwitch(patron, { contenedor = null, dataQa = DATA_QA_SWITCH } = {}) {
    const fuente = patron instanceof RegExp ? patron.source : String(patron);
    return this.driver.executeScript(
      _ubicarSwitchEnBrowser,
      this.selector,
      fuente,
      dataQa,
      contenedor
    );
  }

  /**
   * Espera (explícito) a que el switch exista.
   *
   * Por defecto devuelve el diagnóstico sin lanzar, para que el test decida el
   * assert. Con `obligatorio: true` LANZA si el switch no aparece: es el modo
   * que usan las pantallas donde el switch es parte del contrato de la pantalla
   * y su ausencia es un fallo, no un dato.
   */
  async esperarSwitch(
    patron,
    {
      contenedor = null,
      dataQa = DATA_QA_SWITCH,
      timeout = config.timeouts.explicitWaitMs,
      obligatorio = false,
    } = {}
  ) {
    let info = { encontrado: false, encendido: null, deshabilitado: null };
    await this.driver
      .wait(async () => {
        info = await this.ubicarSwitch(patron, { contenedor, dataQa });
        return info.encontrado;
      }, timeout)
      .catch(() => {});

    if (obligatorio && !info.encontrado) {
      throw new Error(
        `FormsHeader: no apareció el switch "${patron}" en el header (${this.selector}) tras ${timeout}ms`
      );
    }
    return info;
  }

  /**
   * Enciende un switch del header y devuelve el resultado del notify.
   * Si ya estaba encendido no hace nada (`yaEstaba: true`).
   *
   * Click por JS: el header es sticky y el navbar puede interceptar el click
   * nativo (mismo criterio que `accionar`).
   */
  async encenderSwitch(
    patron,
    { contenedor = null, dataQa = DATA_QA_SWITCH, etiqueta, timeout = config.timeouts.explicitWaitMs } = {}
  ) {
    const nombre = etiqueta || String(patron);
    const info = await this.esperarSwitch(patron, { contenedor, dataQa, timeout });

    if (!info.encontrado) {
      logger.error(`FormsHeader: no se encontró el switch "${nombre}" en el header`);
      return { yaEstaba: false, ...info, ...Notify.clasificar('') };
    }
    if (info.encendido) {
      logger.info(`FormsHeader: el switch "${nombre}" ya estaba encendido`);
      return { yaEstaba: true, ...info, ...Notify.clasificar('') };
    }

    logger.info(`FormsHeader: encendiendo el switch "${nombre}" (vía ${info.via})`);
    const sw = await this.driver.findElement(By.css(`[data-qa="${dataQa}"]`));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', sw);
    await this.driver.executeScript('arguments[0].click()', sw);

    return { yaEstaba: false, ...info, ...(await this.notify.esperarResultado(timeout)) };
  }

  /**
   * Espera a que el switch quede en `esperado` (re-consultando el DOM, sin
   * cachear) y devuelve si lo logró. Sirve para confirmar el estado REAL tras
   * operarlo.
   */
  async esperarEstadoSwitch(
    patron,
    esperado = true,
    { contenedor = null, dataQa = DATA_QA_SWITCH, timeout = config.timeouts.explicitWaitMs } = {}
  ) {
    let coincide = false;
    await this.driver
      .wait(async () => {
        const info = await this.ubicarSwitch(patron, { contenedor, dataQa });
        coincide = info.encendido === esperado;
        return coincide;
      }, timeout)
      .catch(() => {});
    return coincide;
  }

  /** Inventario de acciones del header (diagnóstico para evidencias/reportes). */
  async acciones() {
    const info = await this.ubicarBoton('__inventario_sin_coincidencia__');
    return info.botones || [];
  }
}

FormsHeader.HEADER_SELECTOR = HEADER_SELECTOR;
FormsHeader.DATA_QA = DATA_QA;
FormsHeader.DATA_QA_SWITCH = DATA_QA_SWITCH;

module.exports = FormsHeader;
