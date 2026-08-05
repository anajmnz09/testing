const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Editor de comentarios reutilizable. NO es exclusivo de ninguna pantalla: el
 * mismo widget (`CommentEditor_*`) aparece en varios módulos del sistema, así
 * que vive en el core como componente en vez de repetirse por Page Object.
 *
 * Encapsula el flujo completo: localizar el editor minimizado ("Has click para
 * agregar un comentario"), abrirlo, esperar que el editor de texto real esté
 * listo, escribir, verificar que el texto quedó, guardar y esperar a que el
 * guardado termine. El Page Object que lo usa no conoce ningún selector interno.
 *
 * Robusto al tipo real de editor que la pantalla use debajo: detecta en vivo si
 * es `contenteditable`, `textarea` o un iframe editable, y opera el que
 * corresponda — no asume un tipo fijo.
 */
class CommentEditor extends BaseComponent {
  constructor(driver) {
    super(driver);
    // Tolerante al hash CSS generado (__2oPSG, etc.): nunca depende del sufijo.
    this.minimizado = By.css('[class*="CommentEditor_minimizedEditor"]');
    // Tolerante a distintos tags de botón; nunca depende de ids generados.
    this.botonGuardar = By.xpath(
      "//*[self::button or contains(@class,'dx-button') or @role='button']" +
        "[contains(normalize-space(.),'Guardar comentario')]"
    );
  }

  /** True si el editor minimizado está presente y VISIBLE ahora mismo. */
  async _estaMinimizado() {
    const els = await this.driver.findElements(this.minimizado);
    for (const el of els) {
      try {
        if (await el.isDisplayed()) return true;
      } catch (e) {
        /* stale: ya no está */
      }
    }
    return false;
  }

  /**
   * Localiza el editor de texto REAL ya abierto (no el placeholder minimizado).
   * Prueba, en orden de especificidad, contenteditable → textarea → iframe
   * editable, y devuelve el primero visible. `null` si ninguno está abierto.
   */
  async _localizarEditorAbierto() {
    const candidatos = [
      // Quill (DevExtreme HtmlEditor) — selector específico verificado en la
      // app. Sin depender de `ql-blank` (esa clase SOLO está presente cuando el
      // editor está vacío y desaparece al escribir): así matchea el editor
      // recién abierto y el ya escrito por igual, sin necesitar dos locators.
      { tipo: 'contenteditable', locator: By.css('.ql-editor.dx-htmleditor-content') },
      // Fallback genérico para otras pantallas que usen otro contenteditable.
      { tipo: 'contenteditable', locator: By.css('[class*="CommentEditor"] [contenteditable="true"]') },
      { tipo: 'textarea', locator: By.css('[class*="CommentEditor"] textarea') },
      { tipo: 'iframe', locator: By.css('[class*="CommentEditor"] iframe') },
    ];
    for (const c of candidatos) {
      const els = await this.driver.findElements(c.locator);
      for (const el of els) {
        try {
          if (await el.isDisplayed()) return { tipo: c.tipo, el };
        } catch (e) {
          /* stale */
        }
      }
    }
    return null;
  }

  /**
   * Abre el editor si está minimizado y espera (wait basado en estado, sin
   * sleeps) a que el editor de texto real esté listo. Idempotente: si ya está
   * abierto, no hace nada.
   */
  async abrir(timeout = config.timeouts.explicitWaitMs) {
    if (await this._estaMinimizado()) {
      logger.info('CommentEditor: abriendo editor minimizado');
      await this.click(this.minimizado, timeout);
    }
    let encontrado = null;
    await this.driver.wait(async () => {
      encontrado = await this._localizarEditorAbierto();
      return !!encontrado;
    }, timeout);
    logger.info(`CommentEditor: editor listo (tipo="${encontrado.tipo}")`);
    return encontrado;
  }

  /** Escribe `texto` en el editor ya abierto, según su tipo real. */
  async _escribir(editor, texto) {
    const { tipo, el } = editor;
    if (tipo === 'iframe') {
      await this.driver.switchTo().frame(el);
      try {
        const body = await this.driver.findElement(By.css('body'));
        await body.sendKeys(texto);
      } finally {
        await this.driver.switchTo().defaultContent();
      }
      return;
    }
    if (tipo === 'textarea') {
      await el.clear();
      await el.sendKeys(texto);
      return;
    }
    // contenteditable (Quill u otro): interacción NATIVA de Selenium. El click
    // enfoca el editor —lo requiere Quill antes de aceptar texto—, luego
    // sendKeys escribe como lo haría un usuario real.
    await el.click();
    await el.sendKeys(texto);
  }

  /** Texto actualmente escrito en el editor, según su tipo real. */
  async _leerTexto(editor) {
    const { tipo, el } = editor;
    if (tipo === 'iframe') {
      await this.driver.switchTo().frame(el);
      try {
        const body = await this.driver.findElement(By.css('body'));
        return (await body.getText()) || '';
      } finally {
        await this.driver.switchTo().defaultContent();
      }
    }
    if (tipo === 'textarea') {
      return (await el.getAttribute('value')) || '';
    }
    return (await el.getText()) || '';
  }

  /**
   * Flujo completo y único punto de entrada: abre el editor, escribe `texto`,
   * VERIFICA que quedó realmente escrito, guarda, y espera (basado en estado)
   * a que el guardado termine — el editor de escritura deja de estar visible
   * (señal simétrica a `abrir()`, sin asumir un comportamiento específico del
   * placeholder minimizado). Es lo único que necesita conocer un Page Object:
   * ningún selector interno se expone fuera de este componente.
   */
  async agregar(texto, timeout = config.timeouts.explicitWaitMs) {
    const editor = await this.abrir(timeout);
    await this._escribir(editor, texto);

    await this.driver.wait(async () => {
      const actual = await this._leerTexto(editor).catch(() => '');
      return actual.includes(texto);
    }, timeout);
    logger.info('CommentEditor: texto verificado en el editor, antes de guardar');

    // Click por JS: mismo mecanismo ya empleado por RequisicionFormPage.guardar()
    // (y por DataGrid/FormsHeader/Popup) para este patrón exacto — un header
    // sticky intercepta el click nativo. No existe un helper compartido para
    // esto en el framework; se reutiliza el mismo `waitVisible` + `executeScript`
    // ya establecido, sin duplicar una estrategia nueva.
    const btnGuardar = await this.waitVisible(this.botonGuardar, timeout);
    await this.driver.executeScript('arguments[0].click()', btnGuardar);
    logger.info('CommentEditor: "Guardar comentario" clickeado');

    await this.driver.wait(async () => !(await this._localizarEditorAbierto()), timeout);
    logger.info('CommentEditor: guardado finalizado (editor de escritura ya no visible)');
    return true;
  }
}

module.exports = CommentEditor;
