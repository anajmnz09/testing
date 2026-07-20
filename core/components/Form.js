const { By, Key, until } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Componente reutilizable para los formularios de la app Triple. Los formularios
 * ubican cada campo en un contenedor `.group-field-*` con un `<label>` (el
 * asterisco requerido es un <span> rojo) y un editor DevExtreme. Este componente
 * permite operar los campos POR SU LABEL, sin acoplar los tests a la estructura
 * DOM interna de cada widget dx-*.
 *
 * Sigue el mismo patrón que DataGrid/NavBar: extiende BaseComponent, encapsula
 * los selectores dx-* en un solo lugar. Es aditivo (no modifica nada existente).
 */
class Form extends BaseComponent {
  _timeout() {
    return config.timeouts.explicitWaitMs;
  }

  /** Contenedor de un campo por el texto de su label. */
  _campo(label) {
    return By.xpath(
      `//div[contains(@class,'group-field')][.//label[contains(normalize-space(.), '${label}')]]`
    );
  }

  async _elemCampo(label) {
    return this.driver.wait(until.elementLocated(this._campo(label)), this._timeout());
  }

  _opcionLocator() {
    return By.css('.dx-list-item, .dx-overlay-content .dx-data-row');
  }

  /** Espera y devuelve el primer item VISIBLE del dropdown abierto (evita items pre-renderizados ocultos). */
  async _primerItemVisible() {
    return this.driver.wait(async () => {
      const items = await this.driver.findElements(this._opcionLocator());
      for (const it of items) {
        try { if (await it.isDisplayed()) return it; } catch (e) { /* stale */ }
      }
      return false;
    }, this._timeout());
  }

  /**
   * Espera y devuelve el item VISIBLE cuyo texto contiene `texto`.
   * `selectorCss` es opcional: permite apuntar a otro tipo de item (ej. nodos de
   * un treeview) sin duplicar la lógica de espera. Sin él, comportamiento igual
   * que siempre.
   */
  async _itemVisiblePorTexto(texto, selectorCss) {
    const locator = selectorCss ? By.css(selectorCss) : this._opcionLocator();
    return this.driver.wait(async () => {
      const items = await this.driver.findElements(locator);
      for (const it of items) {
        try {
          if (await it.isDisplayed()) {
            const t = (await it.getText()).trim();
            if (t.includes(texto)) return it;
          }
        } catch (e) { /* stale */ }
      }
      return false;
    }, this._timeout());
  }

  /** Espera a que no quede ningún item de dropdown visible. */
  async _esperarOverlayCerrado() {
    await this.driver.wait(async () => {
      const ovs = await this.driver.findElements(this._opcionLocator());
      for (const o of ovs) {
        try { if (await o.isDisplayed()) return false; } catch (e) { /* stale = cerrado */ }
      }
      return true;
    }, this._timeout());
  }

  /** True si hay algún item de dropdown visible en pantalla. */
  async _hayItemVisible() {
    const items = await this.driver.findElements(this._opcionLocator());
    for (const it of items) {
      try { if (await it.isDisplayed()) return true; } catch (e) { /* stale */ }
    }
    return false;
  }

  /**
   * Abre el dropdown de un selectbox/tagbox por label y espera (timeout completo,
   * tolerante a server lento) a que aparezca un item visible. Se mantiene simple
   * y seguro (un solo click, sin re-clicks que puedan cerrar por toggle); la rara
   * intermitencia en la que el click no dispara la apertura se cubre con el
   * reintento a nivel de test (TEST_RETRIES), estándar para E2E contra un server
   * externo variable.
   */
  async _abrirDropdown(label) {
    const campo = await this._elemCampo(label);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', campo);
    const boton = await campo.findElement(By.css('.dx-dropdowneditor-button, .dx-texteditor-input'));
    await boton.click();
    await this.driver.wait(() => this._hayItemVisible(), this._timeout());
  }

  /**
   * Selecciona en un selectbox la primera opción válida y devuelve su texto.
   * (Cumple la regla: "para selectbox, primera opción válida si no hay regla".)
   */
  async seleccionarPrimera(label) {
    logger.info(`Form: seleccionar primera opción de "${label}"`);
    await this._abrirDropdown(label);
    const item = await this._primerItemVisible();
    const texto = (await item.getText()).trim();
    await item.click();
    await this._esperarOverlayCerrado();
    return texto;
  }

  /** Selecciona una opción por su texto exacto/contenido en un selectbox. */
  async seleccionar(label, opcionTexto) {
    logger.info(`Form: seleccionar "${opcionTexto}" en "${label}"`);
    await this._abrirDropdown(label);
    const item = await this._itemVisiblePorTexto(opcionTexto);
    await item.click();
    await this._esperarOverlayCerrado();
  }

  /**
   * Selecciona en un tagbox (multi-select) el item cuyo texto contiene `texto`
   * y cierra el dropdown con Escape (un tagbox no cierra solo al elegir).
   */
  async seleccionarTagPorTexto(label, texto) {
    logger.info(`Form: seleccionar tag "${texto}" en "${label}"`);
    await this._abrirDropdown(label);
    const item = await this._itemVisiblePorTexto(texto);
    await item.click();
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this._esperarOverlayCerrado();
  }

  /**
   * Selecciona el primer valor de un tagbox (multi-select) y lo cierra.
   * Devuelve el texto elegido.
   */
  async seleccionarPrimerTag(label) {
    logger.info(`Form: seleccionar primer tag de "${label}"`);
    await this._abrirDropdown(label);
    const item = await this._primerItemVisible();
    const texto = (await item.getText()).trim();
    await item.click();
    // el tagbox no cierra solo: cerrar con Escape
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this._esperarOverlayCerrado();
    return texto;
  }

  /**
   * Escribe en un textbox / textarea por label.
   * Los editores DevExtreme commitean su valor en el evento 'change' (al perder
   * foco): por eso se envía TAB al final, para forzar el blur y que el valor
   * quede registrado por el validador (si no, el último campo escrito aparece
   * como "requerido" aunque tenga texto).
   */
  async escribir(label, texto) {
    logger.info(`Form: escribir en "${label}"`);
    const campo = await this._elemCampo(label);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', campo);
    const input = await campo.findElement(By.css('.dx-texteditor-input'));
    await input.clear();
    await input.sendKeys(texto, Key.TAB);
  }

  /** Activa (o desactiva) un switch por label. */
  async setSwitch(label, encendido = true) {
    const campo = await this._elemCampo(label);
    const sw = await campo.findElement(By.css('.dx-switch'));
    const estado = (await sw.getAttribute('aria-pressed')) === 'true';
    if (estado !== encendido) {
      logger.info(`Form: switch "${label}" -> ${encendido}`);
      await sw.click();
    }
  }

  /** True si el campo está marcado como inválido (badge rojo). */
  async estaInvalido(label) {
    const campos = await this.driver.findElements(this._campo(label));
    if (!campos.length) return false;
    const inval = await campos[0].findElements(By.css('.dx-invalid'));
    return inval.length > 0;
  }

  /** True si el editor del campo está vacío (clase dx-texteditor-empty de DevExtreme). */
  async estaVacio(label) {
    const campo = await this._elemCampo(label);
    const eds = await campo.findElements(By.css('.dx-texteditor'));
    if (!eds.length) return true;
    const cls = (await eds[0].getAttribute('class')) || '';
    return /dx-texteditor-empty/.test(cls);
  }

  /**
   * Input donde se escribe para FILTRAR un dropdown abierto. Puede ser un
   * buscador propio dentro del overlay (lookup / list con búsqueda) o el input
   * del propio campo (selectbox/tagbox con searchEnabled). Se prefiere el del
   * overlay si está visible.
   */
  async _inputBusqueda(label) {
    const enOverlay = await this.driver.findElements(
      By.css(
        '.dx-overlay-content .dx-list-search .dx-texteditor-input, ' +
          '.dx-overlay-content .dx-searchbox .dx-texteditor-input, ' +
          '.dx-popup-content input.dx-texteditor-input'
      )
    );
    for (const el of enOverlay) {
      try { if (await el.isDisplayed()) return el; } catch (e) { /* stale */ }
    }
    const campo = await this._elemCampo(label);
    return campo.findElement(By.css('.dx-texteditor-input'));
  }

  /**
   * Pone un valor en un control DELEGANDO en una Selection Strategy.
   *
   * Es el punto de entrada que usan los Page Objects: el test dice "quiero este
   * valor"; la estrategia sabe cómo interactuar con ese tipo de control. Si no
   * se indica estrategia, se usa la de por defecto (primera opción), que es el
   * comportamiento histórico.
   *
   * @param label     label del control
   * @param valor     valor deseado (undefined/'' => la estrategia decide, ej. primera opción)
   * @param opciones  { estrategia: 'searchAndSelect'|'text'|..., ...extras }
   */
  async setValor(label, valor, opciones = {}) {
    const strategies = require('../strategies');
    const estrategia = strategies.obtener(opciones.estrategia || strategies.POR_DEFECTO);
    return estrategia.aplicar(this, label, valor, opciones);
  }

  /**
   * Textos de los tags SELECCIONADOS en un tagbox (multi-select). El valor de un
   * tagbox no vive en un input, sino en chips `.dx-tag-content`, así que
   * getValor() no sirve para verificarlo.
   */
  async getTags(label) {
    const campo = await this._elemCampo(label);
    const tags = await campo.findElements(By.css('.dx-tag-content'));
    const textos = [];
    for (const t of tags) {
      try { textos.push((await t.getText()).trim()); } catch (e) { /* stale */ }
    }
    return textos.filter(Boolean);
  }

  /** Valor actual mostrado en el input del campo. */
  async getValor(label) {
    const campo = await this._elemCampo(label);
    const inputs = await campo.findElements(By.css('.dx-texteditor-input, input'));
    if (!inputs.length) return '';
    return (await inputs[0].getAttribute('value')) || '';
  }
}

module.exports = Form;
