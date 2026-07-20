const { By, Key, until } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

const RAZON = { CREACION: 'Creacion', SUSTITUCION: 'Sustitucion' };

/**
 * Page Object del formulario "Crear Requisición" (módulo Reclutamiento).
 * Compone el componente reutilizable Form del core para operar los controles
 * DevExtreme por label. Expone lenguaje de negocio para los casos de prueba.
 *
 * Campos requeridos (asterisco) detectados en el análisis:
 *   Razón de solicitud, Puesto, Nombre de requisición, Reclutador, Sucursal,
 *   Departamento, Horario, Tipo de contrato, Requisitos, Responsabilidades,
 *   Descripción. (Compañía, Cantidad de empleado y Modalidad vienen precargados.)
 *   Con Razón="Sustitucion", "Persona(s) a sustituir" pasa a requerido.
 */
class RequisicionFormPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.btnGuardar = By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
    this.btnAgregarPregunta = By.xpath("//div[contains(@class,'dx-button')][contains(normalize-space(.),'Pregunta')]");
    this.notify = By.css('[class*="notify_record"]');
    this.notifyComponent = new Notify(driver); // toast app-wide (core)
  }

  static get RAZON() {
    return RAZON;
  }

  async estaCargado() {
    await this.waitVisible(By.css('.dx-selectbox'));
    return this;
  }

  /** Espera a que no haya overlay de carga (loader-manager) visible. */
  async esperarCarga() {
    const timeout = config.timeouts.explicitWaitMs;
    await this.driver.wait(async () => {
      const loaders = await this.driver.findElements(
        By.css('[class*="loader_manager"], [class*="loader-manager"]')
      );
      for (const l of loaders) {
        try { if (await l.isDisplayed()) return false; } catch (e) { /* ya no está */ }
      }
      return true;
    }, timeout);
  }

  async seleccionarRazon(valor) {
    await this.form.seleccionar('Razón de solicitud', valor);
    await this.esperarCarga();
  }

  /**
   * Completa los campos requeridos. Los selectbox de catálogo se llenan SOLO si
   * están vacíos (usando la primera opción válida en vivo): así el mismo método
   * sirve para Creación (todos vacíos) y para Sustitución (Sucursal/Departamento/
   * Puesto ya vienen auto-rellenados desde el empleado elegido y no se pisan).
   * El orden respeta la dependencia Sucursal -> Departamento -> Puesto.
   * Devuelve los valores elegidos/escritos para validarlos al reabrir.
   */
  async completarRequeridos(nombre) {
    logger.info(`RequisicionForm: completar requeridos (nombre="${nombre}")`);
    const datos = { nombre };
    const selects = ['Sucursal', 'Departamento', 'Puesto', 'Reclutador', 'Horario', 'Tipo de contrato', 'Modalidad'];
    for (const label of selects) {
      if (await this.form.estaVacio(label)) {
        datos[label] = await this.form.seleccionarPrimera(label);
      }
    }
    await this.form.escribir('Nombre de requisición', nombre);
    datos.requisitos = `Requisitos QA - ${nombre}`;
    datos.responsabilidades = `Responsabilidades QA - ${nombre}`;
    datos.descripcion = `Descripción QA - ${nombre}`;
    await this.form.escribir('Requisitos', datos.requisitos);
    await this.form.escribir('Responsabilidades', datos.responsabilidades);
    await this.form.escribir('Descripción', datos.descripcion);
    // Asegurar Cantidad de empleado >= 1 (precargado, pero puede quedar en 0).
    await this.form.escribir('Cantidad de empleado', '1');
    return datos;
  }

  /**
   * Selecciona el primer empleado disponible en "Persona(s) a sustituir".
   * Al elegir un empleado la app auto-rellena Sucursal/Departamento/Puesto/etc.
   * desde su posición actual, por eso se espera la carga posterior.
   */
  async seleccionarPrimeraPersonaASustituir() {
    const elegido = await this.form.seleccionarPrimerTag('Persona(s) a sustituir');
    await this.esperarCarga();
    return elegido;
  }

  /** Opciones (empleados) disponibles en "Persona(s) a sustituir". */
  async empleadosDisponibles() {
    await this.esperarCarga();
    await this.form._abrirDropdown('Persona(s) a sustituir');
    const items = await this.driver.executeScript(() => {
      return Array.from(document.querySelectorAll('.dx-list-item'))
        .filter((i) => i.offsetParent !== null)
        .map((i) => (i.textContent || '').trim())
        .filter(Boolean)
        // excluir la meta-opción "Seleccionar Todo" del tagbox
        .filter((t) => !/seleccionar todo/i.test(t));
    });
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this.form._esperarOverlayCerrado();
    return items;
  }

  /** Selecciona un empleado puntual (por texto) en "Persona(s) a sustituir". */
  async seleccionarPersonaASustituir(nombreEmpleado) {
    await this.form.seleccionarTagPorTexto('Persona(s) a sustituir', nombreEmpleado);
    await this.esperarCarga();
  }

  /** Quita todos los empleados seleccionados en "Persona(s) a sustituir". */
  async limpiarPersonaASustituir() {
    const removes = await this.driver.findElements(
      By.xpath(
        "//div[contains(@class,'group-field')][.//label[contains(normalize-space(.),'Persona(s) a sustituir')]]//*[contains(@class,'dx-tag-remove-button')]"
      )
    );
    for (const r of removes) {
      try { await r.click(); } catch (e) { /* tag ya removido */ }
    }
  }

  /** True si el formulario sigue presente/usable (no se rompió la página). */
  async formularioPresente() {
    const eds = await this.driver.findElements(By.css('.dx-selectbox'));
    return eds.length > 0;
  }

  async setComentario(texto) {
    await this.form.escribir('Comentario', texto);
  }

  /** Textarea del modal que sigue a un label dado. */
  async _modalTextarea(labelContiene) {
    return this.waitVisible(
      By.xpath(
        `//div[contains(@class,'dx-overlay-content')]//label[contains(normalize-space(.),'${labelContiene}')]/following::textarea[1]`
      )
    );
  }

  /** Input (textbox) del modal que sigue a un label dado. */
  async _modalInput(labelContiene) {
    return this.waitVisible(
      By.xpath(
        `//div[contains(@class,'dx-overlay-content')]//label[contains(normalize-space(.),'${labelContiene}')]/following::input[contains(@class,'dx-texteditor-input')][1]`
      )
    );
  }

  /** Abre el selectbox del modal que sigue a un label y elige la primera opción. */
  async _modalSelectPrimera(labelContiene) {
    const dd = await this.waitVisible(
      By.xpath(
        `//div[contains(@class,'dx-overlay-content')]//label[contains(normalize-space(.),'${labelContiene}')]/following::*[contains(@class,'dx-dropdowneditor')][1]`
      )
    );
    await dd.click();
    const item = await this.form._primerItemVisible();
    await item.click();
    await this.form._esperarOverlayCerrado();
  }

  /**
   * Agrega una pregunta personalizada vía el modal "+ Pregunta(s) Personalizada(s)".
   * Completa la pregunta, el tipo (primera opción) y el nombre del campo.
   */
  async agregarPreguntaPersonalizada({ pregunta, nombreCampo }) {
    logger.info('RequisicionForm: agregar pregunta personalizada');
    const btn = await this.waitVisible(this.btnAgregarPregunta);
    await this.driver.executeScript('arguments[0].click()', btn);
    // esperar el modal
    await this.waitVisible(By.xpath("//div[contains(@class,'dx-overlay-content')]//label[contains(normalize-space(.),'Pregunta Personalizada')]"));

    // Los campos del modal arrancan vacíos: se escribe directo (sin clear, que
    // sobre estos editores lanza "invalid element state").
    const inPregunta = await this._modalTextarea('Pregunta Personalizada');
    await inPregunta.sendKeys(pregunta, Key.TAB);
    await this._modalSelectPrimera('Tipo de Pregunta');
    if (nombreCampo) {
      const inNombre = await this._modalInput('Nombre del campo');
      await inNombre.sendKeys(nombreCampo, Key.TAB);
    }
    // Guardar dentro del modal
    const guardarModal = By.xpath(
      "//div[contains(@class,'dx-overlay-content')]//div[contains(@class,'dx-button')][normalize-space(.)='Guardar']"
    );
    await (await this.waitVisible(guardarModal)).click();
    await this.form._esperarOverlayCerrado();
  }

  /**
   * Guarda la requisición. El botón "Guardar" vive en el header sticky y el
   * navbar superpuesto intercepta el click nativo (y el scrollIntoView lo
   * desalinea por ser sticky). Se usa un click por JS sobre el botón real:
   * es el elemento correcto, solo que visualmente tapado por la barra fija.
   */
  async guardar() {
    logger.info('RequisicionForm: Guardar');
    const btn = await this.waitVisible(this.btnGuardar);
    await this.driver.executeScript('arguments[0].click()', btn);
  }

  /**
   * Espera y devuelve el texto del notify que aparece (o '' si no aparece).
   * Delega en el componente Notify del core (el toast es app-wide).
   */
  async esperarNotify(timeoutMs = config.timeouts.explicitWaitMs) {
    return this.notifyComponent.esperarTexto(timeoutMs);
  }

  /**
   * Clasifica el resultado tras Guardar según el notify y el estado del form.
   * @returns {{notify:string, exito:boolean, invalido:boolean, errorSistema:boolean}}
   */
  async resultadoGuardado(timeoutMs = config.timeouts.explicitWaitMs) {
    const notify = await this.esperarNotify(timeoutMs);
    const invalidos = await this.camposInvalidos();
    return {
      notify,
      exito: /exitosa|exitosamente/i.test(notify),
      invalido: /inv[aá]lido/i.test(notify) || invalidos.length > 0,
      errorSistema: /error en el sistema/i.test(notify),
    };
  }

  /** Lista de labels de campos requeridos marcados como inválidos. */
  async camposInvalidos() {
    return this.driver.executeScript(() => {
      return Array.from(document.querySelectorAll('.group-field-2'))
        .filter((g) => g.querySelector('.dx-invalid'))
        .map((g) => { const l = g.querySelector('label'); return l ? l.textContent.replace('*', '').replace(/:$/, '').trim() : '?'; });
    });
  }

  /** Texto del notify visible (ej. validación o éxito), o '' si no hay. */
  async getNotify(timeout = config.timeouts.explicitWaitMs) {
    try {
      const el = await this.driver.wait(until.elementLocated(this.notify), timeout);
      return (await el.getText()).trim();
    } catch (e) {
      return '';
    }
  }

  /** True si seguimos en el formulario de creación (no navegó). */
  async sigueEnFormulario() {
    const editores = await this.driver.findElements(By.css('.dx-selectbox'));
    return editores.length > 0;
  }
}

module.exports = RequisicionFormPage;
