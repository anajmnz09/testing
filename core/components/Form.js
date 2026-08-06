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

  /**
   * Contenedor de un campo por el texto de su label. Soporta DOS convenciones
   * de formulario verificadas en la app: `group-field` (markup propio de la
   * app, ej. Requisiciones) y `dx-field-item` (widget nativo `dxForm` de
   * DevExtreme, ej. Crear Solicitud). Es un OR aditivo: para una pantalla que
   * solo usa `group-field`, el DOM nunca contiene `dx-field-item`, así que
   * agregar esa rama no cambia ni un resultado existente — compatibilidad
   * hacia atrás garantizada por construcción, no por casualidad. `*` en vez de
   * `div`: los contenedores `dx-field-item` no siempre son `div`.
   *
   * `dx-field-item` usa match EXACTO de clase (padding con espacios), no
   * `contains()` simple sobre el nombre de clase (evita colisión con otros
   * tokens que empiezan igual, ej. `dx-field-item-content`).
   *
   * CAUSA RAÍZ REAL confirmada por evidencia (no la del primer intento, que
   * era incorrecta): `dxForm` puede agrupar varios campos relacionados dentro
   * de UN `dx-field-item` contenedor marcado `dx-field-item-has-group` (ej.
   * "Tipo ID" envuelve a "Primer Nombre" como descendiente anidado en el
   * formulario de Solicitud de Empleo). Como `.//label` matchea CUALQUIER
   * label descendiente, el contenedor EXTERIOR del grupo también satisface
   * `.//label[contains(..., 'Primer Nombre')]` aunque su propio label visible
   * sea "Tipo ID" — y al ser el primero en orden de documento, `getValor()`/
   * `escribir()` operaban sobre el campo equivocado. Fix: excluir cualquier
   * match que tenga un DESCENDIENTE que también matchee (quedarse con el más
   * interno/específico). Para pantallas sin agrupamiento (ej. Requisiciones)
   * esta exclusión nunca se activa — no cambia ningún resultado existente.
   */
  _campo(label) {
    const condicion =
      `(contains(@class,'group-field') or ` +
      `contains(concat(' ', normalize-space(@class), ' '), ' dx-field-item ')) ` +
      `and .//label[contains(normalize-space(.), '${label}')]`;
    return By.xpath(`//*[${condicion} and not(.//*[${condicion}])]`);
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
   *
   * Comparación INSENSIBLE a mayúsculas/minúsculas: verificado que un valor
   * enviado con distinta capitalización que el catálogo real (ej. "cedula" vs.
   * "Cedula") nunca encontraba coincidencia y agotaba el timeout. Es aditivo:
   * cualquier coincidencia que ya funcionaba con case exacto sigue funcionando
   * igual (case-insensitive es un superconjunto de case-sensitive).
   */
  async _itemVisiblePorTexto(texto, selectorCss) {
    const locator = selectorCss ? By.css(selectorCss) : this._opcionLocator();
    const textoBuscado = String(texto).toLowerCase();
    return this.driver.wait(async () => {
      const items = await this.driver.findElements(locator);
      for (const it of items) {
        try {
          if (await it.isDisplayed()) {
            const t = (await it.getText()).trim();
            if (t.toLowerCase().includes(textoBuscado)) return it;
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
    await this._abrirDropdownEn(campo);
  }

  /**
   * Abre el dropdown de un selectbox/tagbox a partir de su ELEMENTO RAÍZ (no de
   * un label). Es la misma mecánica que `_abrirDropdown`, extraída para poder
   * operar dropdowns que NO viven en un `group-field` con label —por ejemplo, un
   * `.dx-selectbox` dentro de un popup—. `_abrirDropdown` ahora la reutiliza, así
   * que no hay lógica duplicada.
   *
   * `jsClick`: los selectbox dentro de un popup modal a veces no responden al
   * click nativo de Selenium (el overlay intercepta el evento); ahí se abre con
   * un click por JS —verificado en el popup "Importar Documentos"—. El camino por
   * label mantiene el click nativo de siempre (comportamiento sin cambios).
   */
  async _abrirDropdownEn(rootEl, { jsClick = false } = {}) {
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', rootEl);
    const boton = await rootEl.findElement(By.css('.dx-dropdowneditor-button, .dx-texteditor-input'));
    if (jsClick) {
      await this.driver.executeScript('arguments[0].click()', boton);
    } else {
      await boton.click();
    }
    await this.driver.wait(() => this._hayItemVisible(), this._timeout());
    await this._esperarSiSinDatos();
  }

  /**
   * True si el dropdown recién abierto muestra ÚNICAMENTE el placeholder "Sin
   * datos para mostrar" (ni cero items —eso es un error de selector, no aplica—
   * ni items reales).
   */
  async _soloSinDatos() {
    const items = await this.driver.findElements(this._opcionLocator());
    const visibles = [];
    for (const it of items) {
      try { if (await it.isDisplayed()) visibles.push(it); } catch (e) { /* stale */ }
    }
    if (visibles.length !== 1) return false;
    try {
      return (await visibles[0].getText()).trim() === 'Sin datos para mostrar';
    } catch (e) {
      return false; // stale u otro error: no es el caso que nos ocupa
    }
  }

  /**
   * Regla "Sin datos para mostrar" (permanente, en la infraestructura común):
   * si el dropdown recién abierto muestra ÚNICAMENTE ese placeholder, espera
   * 5000ms FIJOS —una sola vez, sin bucles ni reintentos— y vuelve a consultar
   * la lista SIN cerrar el dropdown. Si ya hay opciones reales, no hace nada
   * (comportamiento normal). Si tras los 5s sigue sin datos, solo lo registra y
   * continúa: el comportamiento normal del framework decide qué pasa después
   * (fallar o seguir, según el campo) — no se agrega lógica especial.
   *
   * Vive en `_abrirDropdownEn`, el único punto de apertura de dropdown que usan
   * `_abrirDropdown` (por label) y `elegirEnSelectbox` (por locator, popups). Por
   * eso lo heredan automáticamente TODOS los controles basados en lista —
   * SelectBox, TagBox, SearchAndSelect, Lookup— de cualquier módulo, sin tocar
   * ningún Page Object ni duplicar código.
   */
  async _esperarSiSinDatos() {
    if (!(await this._soloSinDatos())) return;
    logger.info('Form: dropdown con únicamente "Sin datos para mostrar" — esperando 5000ms fijos (una sola vez)');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if (await this._soloSinDatos()) {
      logger.info('Form: el control continúa sin datos tras los 5s — se sigue con el comportamiento normal del framework');
    }
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
   * Selecciona una opción en un selectbox identificado por un LOCATOR (no por
   * label). Sirve para los dropdowns que no están en un `group-field` — típico de
   * popups/diálogos (ej. la clasificación en "Importar Documentos"). Reutiliza
   * TODA la mecánica de overlay ya verificada (`_itemVisiblePorTexto`,
   * `_primerItemVisible`, `_esperarOverlayCerrado`), así que no duplica nada.
   *
   * @param locator     By.* del `.dx-selectbox`/`.dx-dropdowneditor`
   * @param valor       texto de la opción; si es vacío/undefined, toma la primera
   * @returns {Promise<string>} el texto REAL de la opción elegida
   */
  async elegirEnSelectbox(locator, valor, intentos = 2) {
    logger.info(`Form: seleccionar ${valor ? `"${valor}"` : 'primera opción'} en selectbox por locator`);
    let ultimoError;
    for (let i = 0; i < intentos; i++) {
      try {
        // Se re-localiza el root en CADA intento: en un popup recién montado el
        // elemento puede quedar stale mientras el modal termina de renderizar.
        const root = await this.waitVisible(locator);
        await this._abrirDropdownEn(root, { jsClick: true });
        const item =
          valor === undefined || valor === null || valor === ''
            ? await this._primerItemVisible()
            : await this._itemVisiblePorTexto(valor);
        const texto = (await item.getText()).trim();
        await item.click();
        await this._esperarOverlayCerrado();
        return texto;
      } catch (err) {
        ultimoError = err;
        if (!/stale element/i.test(err.message) || i === intentos - 1) throw err;
        logger.info(`Form: reintentando elegirEnSelectbox tras stale (intento ${i + 1}/${intentos})`);
      }
    }
    throw ultimoError;
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
   * Agrega un tag de TEXTO LIBRE a un tagbox (distinto de `seleccionarPrimerTag`/
   * `seleccionarTagPorTexto`, que eligen de un CATÁLOGO existente): click en el
   * editor, escribe `texto` y confirma con ENTER — verificado en la app real
   * (sección "Etiquetas" del formulario de Solicitud de Empleo). No abre
   * dropdown ni requiere que el texto exista de antemano.
   *
   * Sin `texto` (undefined/vacío) no hace nada — mismo criterio que el resto
   * de las estrategias ante un valor no provisto (no hay un tag "por defecto"
   * razonable para agregar).
   */
  async escribirTagLibre(label, texto) {
    if (texto === undefined || texto === null || texto === '') return undefined;
    logger.info(`Form: agregar tag libre "${texto}" en "${label}"`);
    const campo = await this._elemCampo(label);
    const input = await campo.findElement(By.css('.dx-texteditor-input'));
    await input.click();
    await input.sendKeys(texto, Key.ENTER);
  }

  /**
   * Escribe en un textbox / textarea por label.
   * Los editores DevExtreme commitean su valor en el evento 'change' (al perder
   * foco): por eso se envía TAB al final, para forzar el blur y que el valor
   * quede registrado por el validador (si no, el último campo escrito aparece
   * como "requerido" aunque tenga texto).
   *
   * `clear`: por defecto `true` (comportamiento de siempre; `.clear()` además
   * enfoca el input como efecto colateral). Algunos editores DevExtreme (ej.
   * inputs con MÁSCARA dinámica, como "Identificación" en Solicitud de Empleo)
   * lanzan `invalid element state` ante `.clear()` — mismo problema ya
   * documentado en `agregarPreguntaPersonalizada()` para los campos del modal
   * de pregunta personalizada. Con `clear:false` se omite ese paso, pero se
   * mantiene un `.click()` explícito para enfocar (sin él, `sendKeys` puede
   * escribir con el cursor en una posición inesperada dentro de la máscara —
   * verificado: sin el click, el valor resultante queda corrupto).
   */
  async escribir(label, texto, { clear = true } = {}) {
    logger.info(`Form: escribir en "${label}"`);
    const campo = await this._elemCampo(label);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', campo);
    const input = await campo.findElement(By.css('.dx-texteditor-input'));
    if (clear) {
      await input.clear();
    } else {
      await input.click();
    }
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

  /**
   * True si el editor del campo está vacío (clase dx-texteditor-empty de
   * DevExtreme).
   *
   * Excepción verificada: en editores enmascarados (`dx-texteditor-masked`,
   * ej. "Celular") esa clase NO se aplica aunque el valor sea solo el
   * esqueleto de la máscara (ej. "___-___-____", sin ningún dígito/letra
   * real) — confirmado inspeccionando el DOM real del formulario recién
   * abierto. Para ese caso puntual se revisa además el valor crudo del
   * input; el resto de editores (sin esa clase) usa exactamente el mismo
   * criterio que antes.
   */
  async estaVacio(label) {
    const campo = await this._elemCampo(label);
    const eds = await campo.findElements(By.css('.dx-texteditor'));
    if (!eds.length) return true;
    const cls = (await eds[0].getAttribute('class')) || '';
    if (/dx-texteditor-empty/.test(cls)) return true;
    if (/dx-texteditor-masked/.test(cls)) {
      const inputs = await eds[0].findElements(By.css('.dx-texteditor-input'));
      if (inputs.length) {
        const valor = (await inputs[0].getAttribute('value')) || '';
        if (!/[0-9A-Za-z]/.test(valor)) return true;
      }
    }
    return false;
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
   * Completa un formulario a partir de su mapa `control -> estrategia` y un objeto
   * de VALORES indexado por label. Genérico: sirve para cualquier formulario.
   *
   * Prioridad de llenado (la regla del framework):
   *   - `valores[label]` con valor NO vacío  → se usa ese valor con su estrategia.
   *   - `valores[label]` vacío y `autofill:true`  → se aplica la estrategia SIN
   *     valor (su comportamiento por defecto: firstOption elige la primera, text
   *     no toca el campo, etc.).
   *   - `valores[label]` vacío y `autofill:false` (default) → NO se toca el control.
   *
   * Con `autofill:false` esta rutina es NEUTRA para los campos que el usuario no
   * completó: sólo INYECTA los valores provistos. Por eso no reemplaza la
   * automatización curada de un formulario (dependencias entre campos, textos por
   * defecto): se compone con ella. `solo`/`excepto` acotan qué controles considerar.
   *
   * @param controles mapa `label -> 'estrategia' | { estrategia, ...opciones }`
   * @param valores   objeto `{ [label]: valor }` (típicamente del Execution Context)
   * @param opciones  { autofill=false, solo=[labels], excepto=[labels] }
   * @returns {Promise<Object>} `{ [label]: valorEfectivo }` de los controles operados
   */
  async completarDesde(controles, valores = {}, opciones = {}) {
    const formInputModel = require('../context/formInputModel');
    const { autofill = false, solo = null, excepto = null } = opciones;
    const modelo = formInputModel.desdeControles(controles);
    const usados = {};

    for (const { label, estrategia, opciones: extra } of modelo) {
      if (solo && !solo.includes(label)) continue;
      if (excepto && excepto.includes(label)) continue;

      const valor = (valores || {})[label];
      if (!formInputModel.esVacio(valor)) {
        logger.info(`Form: completar "${label}" con valor provisto`);
        usados[label] = await this.setValor(label, valor, { estrategia, ...extra });
      } else if (autofill) {
        logger.info(`Form: completar "${label}" automáticamente (sin valor)`);
        usados[label] = await this.setValor(label, undefined, { estrategia, ...extra });
      }
    }
    return usados;
  }

  /**
   * Labels de los controles VISIBLES del formulario en pantalla (contenedores
   * `.group-field*` con `<label>`). Normaliza el texto (sin asterisco de requerido
   * ni ':' final) y descarta duplicados/ocultos. Sólo LEE el DOM: no modifica nada.
   */
  async controlesVisibles() {
    return this.driver.executeScript(() => {
      const vistos = new Set();
      const out = [];
      document.querySelectorAll('.group-field, .group-field-2').forEach((g) => {
        if (g.offsetParent === null) return; // no visible
        const label = g.querySelector('label');
        if (!label) return;
        const t = (label.textContent || '').replace(/\*/g, '').replace(/:\s*$/, '').trim();
        if (t && !vistos.has(t)) {
          vistos.add(t);
          out.push(t);
        }
      });
      return out;
    });
  }

  /**
   * Mecanismo PREVENTIVO de desincronización. Compara los controles realmente
   * visibles del formulario contra el mapa `control -> estrategia` declarado por el
   * Page Object y, si hay controles en pantalla que el mapa no declara, registra
   * una ADVERTENCIA clara en el log.
   *
   * Es puramente informativo y ADITIVO: NO rellena los controles no declarados, NO
   * interrumpe la ejecución y NO agrega comportamiento implícito. ESTRATEGIAS sigue
   * siendo la única fuente de verdad; esto sólo avisa cuando la UI cambió.
   *
   * @returns el diagnóstico de `formInputModel.comparar` (para inspección/evidencia).
   */
  async validarControlesDeclarados(controles, opciones = {}) {
    const formInputModel = require('../context/formInputModel');
    const etiqueta = opciones.etiqueta || 'formulario';
    const enPantalla = await this.controlesVisibles();
    const diag = formInputModel.comparar(formInputModel.labels(controles), enPantalla);

    logger.info(
      `Form[${etiqueta}]: sincronización — declarados=${diag.declarados.length}, en pantalla=${diag.enPantalla.length}`
    );
    if (diag.faltantesEnEstrategias.length) {
      logger.warn(
        `Form[${etiqueta}]: controles VISIBLES no declarados en ESTRATEGIAS: ` +
          `[${diag.faltantesEnEstrategias.join(', ')}]. No se rellenan (ESTRATEGIAS es la ` +
          `única fuente de verdad); revisar si el formulario cambió. ` +
          `En pantalla: [${diag.enPantalla.join(', ')}].`
      );
    }
    if (diag.declaradosNoVistos.length) {
      logger.info(
        `Form[${etiqueta}]: declarados no visibles ahora (normal si dependen del contexto): ` +
          `[${diag.declaradosNoVistos.join(', ')}].`
      );
    }
    return diag;
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
