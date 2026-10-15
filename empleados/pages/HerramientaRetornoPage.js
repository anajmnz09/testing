const { By } = require('selenium-webdriver');
const { BasePage, Form, Notify, Popup } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Popup "Retornar Herramienta" (título "Asignación"): se abre desde la columna "Opciones" (3 puntos) > "Retornar" de una fila de
 * "Herramientas". Confirmado con Selenium real (2026-10-13): un mini form con UN solo campo, "Fecha finalización *" (dx-datebox,
 * viene VACÍO), y "Guardar" / "Descartar" en el pie. Al guardar, la fila queda con la fecha en la columna "Fecha de Devolución".
 * El campo usa la convención "<label>…</label><editor/>" sin clase propia (`Form` lo ubica con su fallback genérico).
 */
const ESTRATEGIAS = {
  'Fecha finalización': 'datePicker',
};

class HerramientaRetornoPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.form.soloGenerica = true; // sus campos son `<label>` + editor sin clase propia: ver el docblock de `Form._elemCampo`
    this.notify = new Notify(driver);
    this.popup = new Popup(driver, { contiene: '.herramienta-retornar-form' });
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.popup.esperarVisible(timeout);
    await this.waitVisible(By.css('.herramienta-retornar-form'), timeout);
    return this;
  }

  /** Llena la fecha de finalización (`valores['Fecha finalización']`). */
  async completar(valores = {}, { autofill = false } = {}) {
    return this.form.completarDesde(ESTRATEGIAS, valores, { autofill });
  }

  /** Guarda el retorno: "Guardar" del popup, espera su cierre y clasifica el notify. Devuelve `{ exito, invalido, notify, cerrado }`. */
  async guardar() {
    const accion = await this.popup.accionar(/guardar/i, { etiqueta: 'Guardar' });
    if (!accion.encontrado || accion.deshabilitado) {
      throw new Error(`HerramientaRetornoPage: no se pudo accionar "Guardar" del popup (${JSON.stringify(accion)}).`);
    }
    const cerrado = await this.popup
      .esperarCerrado(config.timeouts.explicitWaitMs)
      .then(() => true)
      .catch(() => false);
    const texto = await this.notify.esperarTexto(config.timeouts.explicitWaitMs);
    if (!cerrado) logger.info('HerramientaRetornoPage: el popup no cerró tras "Guardar"');
    return texto ? { ...Notify.clasificar(texto), cerrado } : { notify: '', exito: cerrado, invalido: !cerrado, errorSistema: false, cerrado };
  }
}

module.exports = HerramientaRetornoPage;
