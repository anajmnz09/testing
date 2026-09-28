const { By } = require('selenium-webdriver');
const { BasePage, Form, Notify, Popup } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Formulario INLINE "Agregar" de la sección "Capacitación" del detalle de
 * Empleado: `EmpleadoDetallePage.abrirSeccion('Capacitación')` deja la sección
 * como una listview (título + botones "Agregar"/"Eliminar" + buscador, mismo
 * layout que Requisiciones); "Agregar" EXPANDE este formulario dentro del
 * contenido de la sección (contenedor `.capacitaciones-page .container-form`),
 * con su propio "Guardar"/"Descartar". NO es un popup ni la pantalla "Editar
 * Empleado".
 *
 * A diferencia de los mini-forms de "Resumen/CV" (que usan `<span>Campo:</span>`
 * SIN `<label>` y por eso llevan helpers a mano), este usa el markup estándar
 * `dx-field-item` + `<label class="dx-field-item-label">` de la app —
 * confirmado con Selenium real (probe 2026-09-07) — así que se opera con el
 * componente `Form` del core por label, igual que "Crear Empleado".
 *
 * Campos y editor real (probe, en orden de pantalla; los 2 grupos de columnas
 * `dx-field-item-has-group` NO son controles, se excluyen solos en
 * `Form.controlesVisibles`):
 *   Nombre *            textbox     (REQUERIDO — `dx-field-item-required`)
 *   Descripción         textbox
 *   Centro              textbox
 *   Facilitador         textbox
 *   Costo               numberbox
 *   Inversión Empresa   numberbox
 *   Fecha de inicio *   datebox     (REQUERIDO — `dx-field-item-required`)
 *   Fecha finalización  datebox
 *   Cantidad Horas      numberbox
 *   Frecuencia          selectbox   (catálogo; sin valor dirigido -> 1ª opción)
 *
 * Requeridos (asterisco en la app): SOLO "Nombre" y "Fecha de inicio" — el
 * resto es opcional (verificado en el DOM: `dx-field-item-optional`).
 */
const ESTRATEGIAS = {
  Nombre: 'text',
  Descripción: 'text',
  Centro: 'text',
  Facilitador: 'text',
  // numberbox: `Form.escribir` teclea en el `.dx-texteditor-input` (mismo
  // criterio que "Número de hijos"/"Pies"/"Saldo a favor ISR" de EmpleadoFormPage).
  Costo: 'text',
  'Inversión Empresa': 'text',
  'Fecha de inicio': 'datePicker',
  'Fecha finalización': 'datePicker',
  'Cantidad Horas': 'text',
  Frecuencia: 'directSelect',
};

class CapacitacionFormPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    // "Guardar" del form inline (no el de otra pantalla): acotado al
    // contenedor `capacitaciones-page`.
    this.btnGuardar = By.xpath(
      "//*[contains(@class,'capacitaciones-page')]//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']"
    );
    // Popup de confirmación tras "Guardar" — puede o no aparecer (el mini-form
    // de Resumen/CV NO lo tiene; "Crear/Editar Empleado" SÍ). Se maneja
    // defensivo: si aparece, se confirma.
    this.popupConfirmar = new Popup(driver, { contiene: '.confirmPopupContent' });
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /**
   * Espera a que el form esté montado (botón "Guardar" + campo "Nombre") y
   * ASENTADO. El settle final NO es opcional: confirmado real (2026-09-07) que
   * escribir en el form de EDICIÓN apenas aparece deja los cambios fuera del
   * modelo del dxForm (Guardar los pierde y persiste los valores viejos) — con
   * un beat, el binding bidireccional de DevExtreme ya está enganchado y los
   * cambios sí se guardan.
   */
  async estaCargado() {
    await this.waitVisible(this.btnGuardar, config.timeouts.explicitWaitMs);
    await this.driver
      .wait(
        async () => (await this.driver.findElements(By.css('.capacitaciones-page [name="nombre"]'))).length > 0,
        config.timeouts.explicitWaitMs
      )
      .catch(() => {});
    await this.esperarSinLoader().catch(() => {});
    await this.driver.sleep(1200);
    return this;
  }

  /** True si el form inline sigue abierto (botón "Guardar" visible). */
  async _abierto() {
    const els = await this.driver.findElements(this.btnGuardar);
    for (const e of els) {
      if (await e.isDisplayed().catch(() => false)) return true;
    }
    return false;
  }

  /** Título del form (`<h2>` del breadcrumb): "Crear capacitación" al Agregar, "Editar capacitación" al editar por el lápiz. */
  async tituloForm() {
    return this.driver.executeScript(() => {
      const h = Array.from(document.querySelectorAll('h2, h1')).find(
        (e) => e.offsetParent && /capacitaci[óo]n/i.test(e.textContent) && /crear|editar/i.test(e.textContent)
      );
      return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    });
  }

  /**
   * Llena el form desde `valores` (`{ label: valor }`, Panel + defaults QA ya
   * mezclados por el test). Cobertura OBLIGATORIA primero (`estricta`): si la
   * UI muestra un control que `ESTRATEGIAS` no declara, el test FALLA en vez de
   * pasar con un campo sin cubrir.
   *
   * `autofill` (default `true`, para "Agregar"): un label SIN valor deja que su
   * estrategia haga lo suyo — un select elige la 1ª opción, un texto/fecha no
   * toca nada. Para EDITAR se pasa `false`: un label sin valor se deja
   * EXACTAMENTE como estaba (no re-elige la 1ª opción de "Frecuencia" ni pisa
   * nada que el test no quiso cambiar).
   */
  async completar(valores = {}, { autofill = true } = {}) {
    await this.form.validarControlesDeclarados(ESTRATEGIAS, {
      etiqueta: autofill ? 'Agregar Capacitación' : 'Editar Capacitación',
      estricta: true,
    });
    return this.form.completarDesde(ESTRATEGIAS, valores, { autofill });
  }

  /**
   * Click en "Guardar" y clasificación del resultado. CONFIRMADO con Selenium
   * real (probe): tras Guardar OK el form inline se CIERRA (vuelve a la
   * listview). Criterio de éxito: form cerrado Y sin notify de error. Si
   * apareciera un notify, se clasifica (esta pantalla puede mostrar
   * "...exitosamente" o "...Inválido"). Devuelve `{ exito, invalido, notify }`
   * — el test decide el assert (mismo criterio que
   * `EmpleadoFormPage.resultadoGuardado`).
   */
  async guardar() {
    await this.esperarSinLoader().catch(() => {});

    // Click JS sobre "Guardar" (confirmado real 2026-09-07: el click NATIVO
    // sobre este dx-button en modo edición a veces NO dispara el submit — form
    // abierto, sin notify; el click por `executeScript` sí). Reintento acotado
    // si el form no cierra ni aparece notify (un solo click puede "perderse"
    // si el form todavía se estaba asentando).
    let apareceConfirm = false;
    let cerrado = false;
    let notify = '';
    for (let intento = 1; intento <= 2 && !cerrado && !notify; intento++) {
      const btn = await this.waitVisible(this.btnGuardar);
      await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"});arguments[0].click()', btn);

      if (
        await this.popupConfirmar
          .esperarVisible(2500)
          .then(() => true)
          .catch(() => false)
      ) {
        apareceConfirm = true;
        logger.info('CapacitacionFormPage: confirmando popup de "Guardar"');
        const accion = await this.popupConfirmar.accionar(/guardar|aceptar|s[ií]/i, { etiqueta: 'Guardar/Aceptar' });
        if (!accion.encontrado || accion.deshabilitado) {
          throw new Error(`CapacitacionFormPage: no se pudo confirmar el popup de Guardar (${JSON.stringify(accion)}).`);
        }
        await this.popupConfirmar.esperarCerrado().catch(() => {});
      }

      cerrado = await this.driver
        .wait(async () => {
          if (!(await this._abierto())) return true;
          notify = await this.notify.esperarTexto(500).catch(() => '');
          return !!notify;
        }, intento === 1 ? 8000 : 15000)
        .then(() => true)
        .catch(() => false);
      if (!cerrado && !notify) {
        logger.info(`CapacitacionFormPage: "Guardar" sin efecto (intento ${intento}/2), reintentando`);
      }
    }

    if (!notify) notify = await this.notify.esperarTexto(3000).catch(() => '');
    const formCerrado = !(await this._abierto());
    if (notify) {
      const clasificado = Notify.clasificar(notify);
      return { ...clasificado, cerrado: formCerrado, popupConfirmado: apareceConfirm };
    }
    return { notify: '', exito: formCerrado, invalido: !formCerrado, errorSistema: false, cerrado: formCerrado, popupConfirmado: apareceConfirm };
  }

  /**
   * Texto visible del grid de "Capacitación" — para verificar persistencia sin
   * acoplarse a la estructura de celdas. NO hay `.capacitaciones-page` en la
   * vista de grilla (confirmado real, 2026-09-07): se ubica el grid por firma
   * de columnas ("Frecuencia" + "Acción", única de Capacitación), con fallback
   * al `body`.
   */
  async leerListado() {
    return this.driver.executeScript(() => {
      const grid = Array.from(document.querySelectorAll('.clean-grid.genericDataGrid')).find((g) => {
        const h = Array.from(g.querySelectorAll('.dx-header-row td')).map((c) => (c.textContent || '').trim());
        return h.includes('Frecuencia') && h.includes('Acción');
      });
      return ((grid || document.body).innerText || '').replace(/\s+/g, ' ').trim();
    });
  }

  /**
   * Espera (poll) a que la sección "Capacitación" muestre `texto` tras Guardar
   * — la listview puede tardar un instante en refrescar la fila nueva (mismo
   * motivo que `_esperarBloqueResumenContiene`). Devuelve el último texto
   * leído (aunque nunca matchee) para el mensaje de assert.
   */
  async esperarListadoContiene(texto, timeout = 15000) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = await this.leerListado();
        return actual.toLowerCase().includes(String(texto).toLowerCase());
      }, timeout)
      .catch(() => {});
    return actual;
  }
}

module.exports = CapacitacionFormPage;
