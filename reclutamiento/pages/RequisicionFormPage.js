const { By, Key, until } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const testContext = require('@triple/core/context/testContext');
const { parsearValoresMultiples } = require('@triple/core/strategies');
const datos = require('../data/requisiciones.data');

const RAZON = { CREACION: 'Creacion', SUSTITUCION: 'Sustitucion' };

/**
 * Mapa CONTROL -> SELECTION STRATEGY de esta pantalla.
 *
 * Es la única pieza que sabe cómo se opera cada control. Los tests solo pasan
 * valores. Si mañana un control cambia de tipo (o aparece uno nuevo de
 * DevExtreme), se ajusta acá o se registra una estrategia nueva, sin tocar
 * ningún test.
 *
 * Los catálogos usan searchAndSelect porque filtran al escribir y la app SOLO
 * da por válido el valor cuando se selecciona explícitamente el item del
 * listado (escribir no alcanza).
 */
const ESTRATEGIAS = {
  'Razón de solicitud': 'directSelect',
  // Tagbox (multi-select) de 63 items. VERIFICADO en la app: este control NO
  // filtra al escribir (la lista queda igual), pero searchAndSelect igual sirve
  // porque su paso decisivo es CLICKEAR el item, no escribir. No cierra solo al
  // elegir, de ahí multiple:true. El label real lleva "(s)".
  'Persona(s) a sustituir': { estrategia: 'searchAndSelect', multiple: true },
  'Documentos Requeridos': { estrategia: 'searchAndSelect', multiple: true },
  Supervisor: 'searchAndSelect',
  Ubicación: 'text',
  'Fecha de Creación': 'datePicker',
  Puesto: 'searchAndSelect',
  Sucursal: 'searchAndSelect',
  Departamento: 'searchAndSelect',
  Reclutador: 'searchAndSelect',
  Horario: 'searchAndSelect',
  'Tipo de contrato': 'searchAndSelect',
  Modalidad: 'searchAndSelect',
  'Nombre de requisición': 'text',
  Requisitos: 'text',
  Responsabilidades: 'text',
  Descripción: 'text',
  Comentario: 'text',
  'Cantidad de empleado': 'text',
  Rotativo: 'switch',
};

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

  /** Mapa control -> estrategia de esta pantalla (lo consumen los flows/PO, no los tests). */
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /**
   * Pone un valor en un control usando la estrategia DECLARADA para ese control.
   * El test solo dice qué valor quiere; la mecánica queda acá.
   * Si `valor` viene vacío/undefined, la estrategia aplica su comportamiento por
   * defecto (para los catálogos: primera opción válida = comportamiento actual).
   */
  async setCampo(label, valor, extras = {}) {
    // El mapa admite un string ('text') o un objeto con opciones
    // ({ estrategia: 'searchAndSelect', multiple: true }).
    const declarado = ESTRATEGIAS[label];
    const base = typeof declarado === 'string' ? { estrategia: declarado } : declarado || {};
    return this.form.setValor(label, valor, { ...base, ...extras });
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
   * Igual que `completarRequeridos`, pero DIRIGIDO por el Execution Context: para
   * cada control, si el usuario cargó un valor en la sección `caso`, se usa ese
   * valor con su estrategia; si lo dejó vacío, se hace EXACTAMENTE lo de hoy
   * (primera opción para los selects vacíos, textos QA para los textareas). Además
   * aplica cualquier otro control del formulario que el usuario haya completado
   * (Supervisor, Comentario, Ubicación, Rotativo, Fecha, Documentos…): provisto se
   * aplica, vacío no se toca. Devuelve, como `completarRequeridos`, los valores
   * usados (incluye `nombre`, `requisitos`, `responsabilidades`, `descripcion`).
   *
   * El método original `completarRequeridos(nombre)` NO se modifica: sigue
   * disponible para cualquier caso que aún no migre.
   *
   * @param {string} caso  nombre del caso (sección del Execution Context)
   * @param {object} [opts]
   * @param {boolean} [opts.incluirOpcionales=false]  si es true, además de los
   *   requeridos autorrellena TODOS los controles opcionales que queden vacíos
   *   (Supervisor, Ubicación, Documentos Requeridos, Fecha, Rotativo, Comentario…)
   *   usando la estrategia por defecto de cada uno (primera opción / texto QA / etc.).
   *   Por defecto es false: comportamiento neutro de siempre (solo requeridos +
   *   opcionales que el usuario haya provisto explícitamente).
   */
  async completarRequeridosConContexto(caso, { incluirOpcionales = false } = {}) {
    logger.info(
      `RequisicionForm: completar ${incluirOpcionales ? 'TODOS los campos' : 'requeridos'} desde Execution Context (caso="${caso}")`
    );
    // Chequeo preventivo de desincronización: avisa (solo log) si el formulario
    // muestra controles que ESTRATEGIAS no declara. No rellena ni interrumpe.
    await this.form.validarControlesDeclarados(ESTRATEGIAS, { etiqueta: 'crear-requisicion' });
    const val = (label) => testContext.get(caso, label); // undefined si está vacío

    const nombre = val('Nombre de requisición') || datos.nombreQA(caso);
    const resultado = { nombre };

    // Selects requeridos, en orden de dependencia (Sucursal → Departamento →
    // Puesto). Provisto → se usa (searchAndSelect); vacío → como hoy: primera
    // opción, y sólo si el control quedó vacío en pantalla (respeta Sustitución,
    // donde algunos vienen auto-rellenados).
    const selects = ['Sucursal', 'Departamento', 'Puesto', 'Reclutador', 'Horario', 'Tipo de contrato', 'Modalidad'];
    for (const label of selects) {
      const provisto = val(label);
      if (provisto !== undefined) {
        resultado[label] = await this.setCampo(label, provisto);
      } else if (await this.form.estaVacio(label)) {
        resultado[label] = await this.form.seleccionarPrimera(label);
      }
    }

    // Nombre + textos requeridos. Provisto → se usa; vacío → el texto QA de hoy.
    await this.form.escribir('Nombre de requisición', nombre);
    resultado.requisitos = val('Requisitos') || `Requisitos QA - ${nombre}`;
    resultado.responsabilidades = val('Responsabilidades') || `Responsabilidades QA - ${nombre}`;
    resultado.descripcion = val('Descripción') || `Descripción QA - ${nombre}`;
    await this.form.escribir('Requisitos', resultado.requisitos);
    await this.form.escribir('Responsabilidades', resultado.responsabilidades);
    await this.form.escribir('Descripción', resultado.descripcion);
    // Cantidad de empleado (precargada, pero puede quedar en 0): provisto o "1".
    await this.form.escribir('Cantidad de empleado', val('Cantidad de empleado') || '1');

    // Cualquier OTRO control del formulario. Provisto → se aplica con su
    // estrategia. Vacío → depende de `incluirOpcionales`: con false NO se toca
    // (neutro, igual que hoy); con true se autorrellena con la estrategia por
    // defecto (primera opción / texto QA / etc.). "Persona(s) a sustituir" queda
    // siempre excluida (va en `yaTratados`): su flujo especial lo maneja el test.
    const yaTratados = [
      'Razón de solicitud', 'Persona(s) a sustituir', ...selects,
      'Nombre de requisición', 'Requisitos', 'Responsabilidades', 'Descripción', 'Cantidad de empleado',
    ];
    const otros = {};
    for (const label of Object.keys(ESTRATEGIAS)) {
      if (yaTratados.includes(label)) continue;
      const v = val(label);
      if (v !== undefined) otros[label] = v;
    }

    // Primero se aplican los opcionales que el usuario SÍ proveyó (deben aplicarse).
    Object.assign(
      resultado,
      await this.form.completarDesde(ESTRATEGIAS, otros, { autofill: false, excepto: yaTratados })
    );

    // Con `incluirOpcionales`, se autorrellenan los DEMÁS controles opcionales.
    // Es BEST-EFFORT: "todos los campos DISPONIBLES". Los catálogos de la app no
    // siempre tienen opción seleccionable (vacíos, dependientes) y los multi-select
    // (tagbox) no cierran solos; por eso cada opcional se intenta de forma aislada,
    // con su vía adecuada, y si no se puede se OMITE (recuperando el overlay con
    // ESCAPE) sin abortar el test. Se registra en el log cuáles se omiten.
    if (incluirOpcionales) {
      const omitidos = [];
      // Opcionales con default fijo "QA" cuando el contexto no los provee. El
      // contexto sigue teniendo prioridad absoluta: `otros[label]` ya captura el
      // valor provisto y este branch solo corre cuando NO vino del contexto.
      const DEFAULT_QA = ['Ubicación', 'Comentario'];
      for (const label of Object.keys(ESTRATEGIAS)) {
        if (yaTratados.includes(label) || otros[label] !== undefined) continue;
        const decl = ESTRATEGIAS[label];
        const esMulti = typeof decl === 'object' && decl.multiple === true;
        try {
          resultado[label] = esMulti
            ? await this.form.seleccionarPrimerTag(label) // tagbox: elige primero y cierra con ESCAPE
            : DEFAULT_QA.includes(label)
              ? await this.setCampo(label, 'QA')
              : await this.setCampo(label); // resto: estrategia por defecto (primera opción / etc.)
        } catch (e) {
          omitidos.push(label);
          logger.info(
            `RequisicionForm: opcional "${label}" no disponible para autocompletar, se omite (${e.message.split('\n')[0]})`
          );
          // Recuperar el estado: cerrar cualquier overlay abierto para no arrastrar el fallo.
          try { await this.driver.actions().sendKeys(Key.ESCAPE).perform(); } catch (_) { /* nada abierto */ }
          try { await this.form._esperarOverlayCerrado(); } catch (_) { /* ya cerrado */ }
        }
      }
      if (omitidos.length) {
        logger.info(`RequisicionForm: opcionales omitidos (sin opción disponible): [${omitidos.join(', ')}]`);
      }
    }

    return resultado;
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
   * Abre el selectbox del modal que sigue a un label y elige el item cuyo
   * texto CONTIENE `texto` — no reimplementa nada: reutiliza
   * `Form._itemVisiblePorTexto` (ya case-insensitive, mismo criterio que el
   * resto del framework; evita el problema ya conocido de "cedula" vs.
   * "Cedula") y `Form._esperarOverlayCerrado`. Mismo patrón de apertura que
   * `_modalSelectPrimera` (click nativo, ya probado para este modal).
   */
  async _modalSeleccionarPorTexto(labelContiene, texto) {
    const dd = await this.waitVisible(
      By.xpath(
        `//div[contains(@class,'dx-overlay-content')]//label[contains(normalize-space(.),'${labelContiene}')]/following::*[contains(@class,'dx-dropdowneditor')][1]`
      )
    );
    await dd.click();
    const item = await this.form._itemVisiblePorTexto(texto);
    await item.click();
    await this.form._esperarOverlayCerrado();
  }

  /**
   * Input del TAGBOX del modal que sigue a un label dado (ej. "Opciones").
   * Distinto de `_modalInput`/`_modalSelectPrimera`: el widget es un
   * `dx-tagbox`, no un textbox ni un selectbox de catálogo.
   */
  async _modalTagbox(labelContiene) {
    const campo = await this.waitVisible(
      By.xpath(
        `//div[contains(@class,'dx-overlay-content')]//label[contains(normalize-space(.),'${labelContiene}')]/following::*[contains(@class,'dx-tagbox')][1]`
      )
    );
    return campo.findElement(By.css('.dx-texteditor-input'));
  }

  /**
   * Agrega una pregunta personalizada vía el modal "+ Pregunta(s) Personalizada(s)".
   * Completa la pregunta, el tipo, el nombre del campo y —cuando el tipo lo
   * requiere— las opciones.
   *
   * `tipo`: texto LIBRE, tal cual lo escribe el usuario desde el Panel (ej.
   * "Numérica", "Selección de una opción", "Selección Múltiple", "Texto" —
   * nombres reales verificados en la app, case-insensitive vía
   * `_modalSeleccionarPorTexto`). Sin `tipo`, se mantiene el comportamiento
   * ORIGINAL (elige la primera opción) — retrocompatible con los casos que ya
   * usan este método sin dirigir el tipo.
   *
   * `opciones`: texto LIBRE con varios valores separados por `|` (ej.
   * "Rojo | Azul | Verde", ver `parsearValoresMultiples` en
   * `core/strategies/builtinStrategies.js`). Solo tiene efecto si el tipo
   * elegido habilita el tagbox "Opciones" (Selección de una opción /
   * Selección Múltiple); para los demás tipos el campo queda deshabilitado
   * por la propia app, así que si se provee igual, simplemente no se aplica.
   */
  async agregarPreguntaPersonalizada({ pregunta, tipo, nombreCampo, opciones }) {
    logger.info('RequisicionForm: agregar pregunta personalizada');
    const btn = await this.waitVisible(this.btnAgregarPregunta);
    await this.driver.executeScript('arguments[0].click()', btn);
    // esperar el modal
    await this.waitVisible(By.xpath("//div[contains(@class,'dx-overlay-content')]//label[contains(normalize-space(.),'Pregunta Personalizada')]"));

    // Los campos del modal arrancan vacíos: se escribe directo (sin clear, que
    // sobre estos editores lanza "invalid element state").
    const inPregunta = await this._modalTextarea('Pregunta Personalizada');
    await inPregunta.sendKeys(pregunta, Key.TAB);

    if (tipo) {
      await this._modalSeleccionarPorTexto('Tipo de Pregunta', tipo);
    } else {
      await this._modalSelectPrimera('Tipo de Pregunta');
    }

    if (nombreCampo) {
      const inNombre = await this._modalInput('Nombre del campo');
      await inNombre.sendKeys(nombreCampo, Key.TAB);
    }

    if (opciones) {
      const valores = parsearValoresMultiples(opciones);
      if (valores.length) {
        const inputOpciones = await this._modalTagbox('Opciones');
        await this.form._escribirTagsEnInput(inputOpciones, valores);
      }
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
