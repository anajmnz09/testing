const { By, Key } = require('selenium-webdriver');
const { BasePage, Form, Notify, Popup } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * "Identificación" es un editor ENMASCARADO de DevExtreme (`dx-texteditor-masked`,
 * placeholder inicial `"___-_______-_"`) — confirmado real, 2026-09-10: el
 * `escribir()` genérico del Core (`input.sendKeys(texto, Key.TAB)`, todo el
 * string en UN solo call de WebDriver) deja el campo SIN LLENAR (sigue
 * mostrando los guiones bajos del placeholder) — la máscara no procesa un
 * bloque de texto pegado de una vez. Tipeando CARÁCTER POR CARÁCTER (una
 * llamada `sendKeys` por dígito) sí funciona y arma la máscara sola
 * ("001-7033393-9"). Esto NO afecta a otros campos enmascarados ya probados
 * en el framework (ej. "Teléfono de trabajo" de Empleado, que sí acepta
 * `escribir()` normal) — es específico de ESTE editor/mask, así que se
 * resuelve acá con `custom` (escape hatch estándar del framework para un
 * campo puntual) en vez de cambiar `Form.escribir()` para todos. Si este
 * mismo síntoma aparece en OTRO campo enmascarado, recién ahí conviene
 * promover esto a un helper del Core (`Form.escribirEnMascara` o similar).
 */
async function _escribirCaracterPorCaracter(form, label, texto) {
  const campo = await form._elemCampo(label);
  await form.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', campo);
  const input = await form._inputDeCampo(campo, label);
  await input.click();
  await input.sendKeys(Key.chord(Key.CONTROL, 'a'));
  await input.sendKeys(Key.BACK_SPACE);
  for (const ch of String(texto)) {
    await input.sendKeys(ch);
  }
  await input.sendKeys(Key.TAB);
}

/**
 * Formulario INLINE "Agregar" de la sección "Dependientes" del detalle de
 * Empleado: `EmpleadoDetallePage.abrirSeccion('Dependientes')` deja la
 * sección como una listview (título + botones "Agregar"/"Eliminar"/"Filtro"
 * + grid, MISMO layout que "Capacitación"); "Agregar" EXPANDE este
 * formulario dentro de la sección con su propio "Guardar"/"Descartar" (NO
 * navega — confirmado real: mismo patrón que `CapacitacionFormPage`, a
 * diferencia de "Adjuntar documento" de Capacitación que sí navega).
 *
 * Markup DISTINTO al de Capacitación (confirmado real, 2026-09-10, probe
 * dedicado): cada campo vive en un `<div class="dependiente-form-item">`
 * (no `.group-field`/`.dx-field-item`) — por eso `Form._campo()` ahora
 * reconoce esa TERCERA convención como propia (ver su docblock), en vez de
 * caer al fallback genérico lento.
 *
 * Campos y editor real (probe, en orden de pantalla):
 *   Parentesco *           directSelect (dx-selectbox)  — REQUERIDO
 *   Tipo ID *               directSelect (dx-selectbox)  — REQUERIDO
 *   Identificación *        text (dx-textbox)            — REQUERIDO
 *   Nombres *                text (dx-textbox)            — REQUERIDO
 *   Apellidos *              text (dx-textbox)            — REQUERIDO
 *   Género *                 directSelect (dx-selectbox)  — REQUERIDO
 *   Fecha de nacimiento *    datePicker (dx-datebox)      — REQUERIDO
 *   Edad                     dx-numberbox READONLY (`dx-state-readonly`) —
 *                            se AUTOCALCULA desde "Fecha de nacimiento".
 *                            NUNCA se escribe (siempre en `excepto` de
 *                            `completar()`) — escribir en un readonly no
 *                            aplica y podría enmascarar el valor real.
 *   Discapacidad             text (dx-textbox, libre) — opcional
 *   Proveedor de seguros     directSelect (dx-selectbox) — opcional,
 *                            HABILITA el bloque de seguro (ver abajo)
 *   Plan de seguro           directSelect (dx-selectbox) — DESHABILITADO
 *                            por defecto (`dx-state-disabled`); se habilita
 *                            recién con "Proveedor de seguros" elegido —
 *                            no confirmado con evidencia el detalle exacto
 *                            de la dependencia, así que por defecto queda
 *                            en `excepto` salvo que el Panel dirija
 *                            "Proveedor de seguros".
 *   Tarifa                  text (dx-numberbox) — mismo estado deshabilitado
 *                            condicional que "Plan de seguro".
 *   % Empresa                text (dx-numberbox) — ídem.
 *   % Empleado                text (dx-numberbox) — ídem.
 *   Dependiente directo      checkbox (dx-checkbox, NO dx-switch) —
 *                            opcional, `soloSiDirigido` (no se fuerza un
 *                            estado sin dirección explícita del Panel).
 *
 * Requeridos reales (asterisco en la app, confirmado real): Parentesco,
 * Tipo ID, Identificación, Nombres, Apellidos, Género, Fecha de nacimiento.
 */
const CAMPOS_SEGURO_CONDICIONALES = ['Plan de seguro', 'Tarifa', '% Empresa', '% Empleado'];

const ESTRATEGIAS = {
  Parentesco: 'directSelect',
  'Tipo ID': 'directSelect',
  // Editor enmascarado — ver `_escribirCaracterPorCaracter` arriba.
  Identificación: {
    estrategia: 'custom',
    fn: (form, label, valor) => (valor === undefined || valor === null ? undefined : _escribirCaracterPorCaracter(form, label, valor).then(() => valor)),
  },
  Nombres: 'text',
  Apellidos: 'text',
  Género: 'directSelect',
  'Fecha de nacimiento': 'datePicker',
  Edad: 'text',
  Discapacidad: 'text',
  'Proveedor de seguros': 'directSelect',
  'Plan de seguro': 'directSelect',
  Tarifa: 'text',
  '% Empresa': 'text',
  '% Empleado': 'text',
  'Dependiente directo': { estrategia: 'checkbox', soloSiDirigido: true },
};

class DependienteFormPage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). Su guardado confirmado publica el dependiente con su identificación
   * (la misma que el listado muestra para verificar el alta) y su nombre.
   * Lo lee el escáner estático y la capa común de publicación; en ejecución individual no se usa.
   */
  static get ENTIDAD_FLUJO() {
    return { tipo: 'dependiente', referencia: 'identificacion', metodos: [], confirmadores: [{ metodo: 'guardar', leer: 'antes' }] };
  }

  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    // "Guardar" del form inline (no el de otra pantalla): acotado al
    // contenedor `dependientes-form`.
    this.btnGuardar = By.xpath(
      "//*[contains(@class,'dependientes-form')]//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']"
    );
    this.popupConfirmar = new Popup(driver, { contiene: '.confirmPopupContent' });
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Espera a que el form esté montado (botón "Guardar" + campo "Parentesco") y ASENTADO — mismo criterio que `CapacitacionFormPage`. */
  async estaCargado() {
    await this.waitVisible(this.btnGuardar, config.timeouts.explicitWaitMs);
    await this.driver
      .wait(
        async () => (await this.driver.findElements(By.css('.dependiente-form-item'))).length > 0,
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

  /**
   * Llena el form desde `valores` (`{ label: valor }`). Cobertura OBLIGATORIA
   * primero (`estricta`): si la UI muestra un control que `ESTRATEGIAS` no
   * declara, el test FALLA en vez de pasar con un campo sin cubrir.
   *
   * "Edad" SIEMPRE queda excluida (readonly/autocalculada). El bloque de
   * seguro (`CAMPOS_SEGURO_CONDICIONALES`) solo se intenta si `valores`
   * incluye un valor para "Proveedor de seguros" — si no, queda excluido
   * (están deshabilitados en la app hasta elegir un proveedor).
   */
  async completar(valores = {}, { autofill = true } = {}) {
    await this.form.validarControlesDeclarados(ESTRATEGIAS, {
      etiqueta: 'Agregar Dependiente',
      estricta: true,
    });
    const excepto = ['Edad'];
    if (!valores['Proveedor de seguros']) excepto.push(...CAMPOS_SEGURO_CONDICIONALES);
    return this.form.completarDesde(ESTRATEGIAS, valores, { autofill, excepto });
  }

  /**
   * Click en "Guardar" y clasificación del resultado — MISMO criterio que
   * `CapacitacionFormPage.guardar()` (reintento acotado, click por JS,
   * popup de confirmación opcional).
   */
  /** Datos de referencia para el flujo: identificación y nombre completo del dependiente al guardar. */
  async _datosFlujo() {
    const leer = async (label) => String(await this.form.getValor(label).catch(() => '')).trim();
    const identificacion = await leer('Identificación');
    const nombre = [await leer('Nombres'), await leer('Apellidos')].filter(Boolean).join(' ');
    return identificacion || nombre ? { ...(identificacion ? { identificacion } : {}), ...(nombre ? { nombre } : {}) } : null;
  }

  async guardar() {
    await this.esperarSinLoader().catch(() => {});

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
        logger.info('DependienteFormPage: confirmando popup de "Guardar"');
        const accion = await this.popupConfirmar.accionar(/guardar|aceptar|s[ií]/i, { etiqueta: 'Guardar/Aceptar' });
        if (!accion.encontrado || accion.deshabilitado) {
          throw new Error(`DependienteFormPage: no se pudo confirmar el popup de Guardar (${JSON.stringify(accion)}).`);
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
        logger.info(`DependienteFormPage: "Guardar" sin efecto (intento ${intento}/2), reintentando`);
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
   * Texto visible del grid de "Dependientes" — mismo criterio que
   * `CapacitacionFormPage.leerListado()`: se ubica el grid por firma de
   * columnas ("Parentesco" + "Acción", única de Dependientes entre las
   * secciones del detalle), con fallback al `body`.
   */
  async leerListado() {
    return this.driver.executeScript(() => {
      const grids = Array.from(document.querySelectorAll('.dx-datagrid')).filter((g) => g.offsetParent);
      const grid = grids.find((g) => {
        const h = Array.from(g.querySelectorAll('.dx-header-row td')).map((c) => (c.textContent || '').trim());
        return h.includes('Parentesco') && h.includes('Acción');
      });
      return ((grid || document.body).innerText || '').replace(/\s+/g, ' ').trim();
    });
  }

  /**
   * Espera (poll) a que la sección "Dependientes" muestre `texto` tras
   * Guardar — mismo criterio que `CapacitacionFormPage.esperarListadoContiene`.
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

module.exports = DependienteFormPage;
