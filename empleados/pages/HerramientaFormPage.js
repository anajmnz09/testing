const { By } = require('selenium-webdriver');
const { BasePage, Form, Notify } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Pantalla "Crear asignación" de la sección "Herramientas" del detalle de Empleado (botón "Agregar" de la barra).
 *
 * Confirmado con Selenium real (2026-10-13): NO es un form inline ni un popup — "Agregar" NAVEGA a una pantalla propia
 * (`.agregar-herramienta-page`, título `h2.record-name` = "Crear asignación") con "Guardar" / "Descartar" en la cabecera y un form
 * (`.agregar-herramienta-form`) de 3 campos:
 *   Fecha de asignación *  datePicker (dx-datebox), viene precargada con la fecha de hoy
 *   Referencia              text (dx-textbox), opcional
 *   Descripción *           text (dx-textarea)
 * Sus campos usan la convención "<div><label>…</label><editor/></div>" sin clase propia: `Form` los ubica con su fallback genérico
 * (`_campoGenerico`), y por eso `controlesVisibles()` no los inventaría (no se llama `validarControlesDeclarados`: devolvería 0
 * controles en pantalla y no validaría nada). `ESTRATEGIAS` declara los 3 controles reales.
 */
const ESTRATEGIAS = {
  'Fecha de asignación': 'datePicker',
  // Texto libre con fuente declarada (mecanismo común `core/utils/datos`): Panel > escenario > fuente.
  Referencia: { estrategia: 'text', dato: 'herramienta.referencia' },
  // Única por corrida: es lo que el grid muestra y lo que el test busca para confirmar el alta.
  Descripción: { estrategia: 'text', dato: { fuente: 'herramienta.descripcion', unico: true } },
};

class HerramientaFormPage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). Su guardado confirmado publica la herramienta con su descripción (la que el
   * grid de "Herramientas" muestra para verificar el alta).
   */
  static get ENTIDAD_FLUJO() {
    return { tipo: 'herramienta', referencia: 'descripcion', metodos: [], confirmadores: [{ metodo: 'guardar', leer: 'antes' }] };
  }

  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.form.soloGenerica = true; // sus campos son `<label>` + editor sin clase propia: ver el docblock de `Form._elemCampo`
    this.notify = new Notify(driver);
    this.pagina = By.css('.agregar-herramienta-page');
    this.btnGuardar = By.xpath("//*[contains(@class,'agregar-herramienta-page')]//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(this.pagina, timeout);
    await this.waitVisible(By.css('.agregar-herramienta-form textarea'), timeout);
    await this.esperarSinLoader().catch(() => {});
    return this;
  }

  /** True si la pantalla "Crear asignación" sigue abierta. */
  async _abierta() {
    const els = await this.driver.findElements(this.pagina);
    for (const e of els) if (await e.isDisplayed().catch(() => false)) return true;
    return false;
  }

  /** Llena el form desde `valores` (`{ label: valor }`); lo que venga vacío se autocompleta. */
  async completar(valores = {}, { autofill = true } = {}) {
    return this.form.completarDesde(ESTRATEGIAS, valores, { autofill });
  }

  /** Datos de referencia para el flujo: la descripción de la herramienta al guardar. */
  async _datosFlujo() {
    const descripcion = String(await this.form.getValor('Descripción').catch(() => '')).trim();
    return descripcion ? { descripcion } : null;
  }

  /**
   * Click en "Guardar" y clasificación del resultado: éxito = la pantalla se cerró (vuelve a "Herramientas") y no hay notify de
   * error. Devuelve `{ exito, invalido, notify, cerrado }`; el test decide el assert.
   */
  async guardar() {
    await this.esperarSinLoader().catch(() => {});
    let notify = '';
    let cerrado = false;
    for (let intento = 1; intento <= 2 && !cerrado && !notify; intento++) {
      const btn = await this.waitVisible(this.btnGuardar);
      await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"});arguments[0].click()', btn);
      cerrado = await this.driver
        .wait(async () => {
          if (!(await this._abierta())) return true;
          notify = await this.notify.esperarTexto(500).catch(() => '');
          return !!notify;
        }, intento === 1 ? 10000 : 15000)
        .then(() => true)
        .catch(() => false);
      if (!cerrado && !notify) logger.info(`HerramientaFormPage: "Guardar" sin efecto (intento ${intento}/2), reintentando`);
    }
    if (!notify) notify = await this.notify.esperarTexto(3000).catch(() => '');
    const formCerrado = !(await this._abierta());
    if (notify) return { ...Notify.clasificar(notify), cerrado: formCerrado };
    return { notify: '', exito: formCerrado, invalido: !formCerrado, errorSistema: false, cerrado: formCerrado };
  }
}

module.exports = HerramientaFormPage;
