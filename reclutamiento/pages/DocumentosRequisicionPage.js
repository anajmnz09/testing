const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const FormsHeader = require('@triple/core/components/FormsHeader');
const Popup = require('@triple/core/components/Popup');
const Form = require('@triple/core/components/Form');
const FileUploader = require('@triple/core/components/FileUploader');
const Notify = require('@triple/core/components/Notify');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const { SELECTORES } = require('../data/documentos.data');

// El botón "Documentos" del header es un `<div class="documentoButton" title="Documentos">`
// (no un .dx-button). FormsHeader lo localiza por su title gracias a la ampliación
// del conjunto de clickeables a los botones de acción propios de la app.
const PATRON_DOCUMENTOS = '^\\s*documentos\\s*$';

/**
 * Page Object de la funcionalidad "Documentos" de una requisición (panel de
 * adjuntos + popup "Importar Documentos"). Representa esa PORCIÓN de la pantalla
 * de detalle; asume que el detalle ya está abierto.
 *
 * NO reimplementa mecánica de bajo nivel: COMPONE los componentes del core
 *   - FormsHeader  → abre el panel desde el botón "Documentos" del header
 *   - Popup        → el modal "Importar Documentos"
 *   - Form         → el selectbox de clasificación (por locator, sin label)
 *   - FileUploader → carga el archivo al input oculto (sin diálogo del SO)
 *   - Notify       → resultado del guardado
 * y solo aporta lo específico de ESTA pantalla (qué botón, qué selectores).
 */
class DocumentosRequisicionPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.header = new FormsHeader(driver);
    this.popup = new Popup(driver, { contiene: SELECTORES.popupContiene });
    this.form = new Form(driver);
    this.uploader = new FileUploader(driver, { selector: SELECTORES.inputArchivo });
    this.notify = new Notify(driver);
    this.panel = By.css(SELECTORES.panel);
  }

  /** True si el panel de documentos está visible ahora mismo. */
  async panelVisible() {
    const el = await this.driver.executeScript((sel) => {
      const p = document.querySelector(sel);
      return !!(p && p.offsetWidth > 0 && p.offsetHeight > 0);
    }, SELECTORES.panel);
    return !!el;
  }

  /**
   * Asegura que el panel "Documentos" esté abierto (idempotente): si ya está
   * visible no hace nada; si no, clickea el botón "Documentos" del header.
   * @returns {Promise<{abierto:boolean, boton:object|null}>}
   */
  async abrirPanel(timeout = config.timeouts.explicitWaitMs) {
    if (await this.panelVisible()) {
      logger.info('DocumentosRequisicion: el panel ya estaba abierto');
      return { abierto: true, boton: null };
    }
    const boton = await this.header.clickBoton(PATRON_DOCUMENTOS, {
      etiqueta: 'Documentos',
      timeout,
      dataQa: 'boton-documentos',
    });
    if (!boton.accionado) {
      return { abierto: false, boton };
    }
    await this.driver.wait(async () => this.panelVisible(), timeout).catch(() => {});
    return { abierto: await this.panelVisible(), boton };
  }

  /**
   * Documentos adjuntos actualmente listados en el panel.
   * Cada fila (`.documentoContent`) muestra el nombre en un `<b>`.
   * @returns {Promise<Array<{nombre:string, detalle:string}>>}
   */
  async documentosAdjuntos() {
    return this.driver.executeScript(
      (selFila, selNombre) => {
        const txt = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();
        return Array.from(document.querySelectorAll(selFila)).map((f) => ({
          nombre: txt(f.querySelector(selNombre)),
          detalle: txt(f),
        }));
      },
      SELECTORES.filaDocumento,
      SELECTORES.nombreEnFila
    );
  }

  /** Cantidad de documentos adjuntos en el panel. */
  async contarDocumentos() {
    return (await this.documentosAdjuntos()).length;
  }

  /** True si el panel lista un documento cuyo nombre contiene `nombre`. */
  async tieneDocumento(nombre) {
    const docs = await this.documentosAdjuntos();
    return docs.some((d) => d.nombre.includes(nombre));
  }

  /** Espera (explícito) a que aparezca en el panel un documento con `nombre`. */
  async esperarDocumento(nombre, timeout = config.timeouts.explicitWaitMs) {
    let ok = false;
    await this.driver
      .wait(async () => {
        ok = await this.tieneDocumento(nombre);
        return ok;
      }, timeout)
      .catch(() => {});
    return ok;
  }

  /** Abre el popup "Importar Documentos" desde el botón del panel. */
  async _abrirPopupImportar(timeout = config.timeouts.explicitWaitMs) {
    // El botón "Importar archivos" del panel es un .dx-button; se localiza por su
    // nombre accesible entre los visibles y se clickea por JS (consistente con el
    // resto de acciones sobre overlays sticky).
    const clickeado = await this.driver.executeScript((patron) => {
      const re = new RegExp(patron, 'i');
      const vis = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
      const btn = Array.from(document.querySelectorAll('.dx-button, [class*="Button"]')).find(
        (b) => vis(b) && re.test((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || ''))
      );
      if (!btn) return false;
      btn.setAttribute('data-qa', 'btn-importar-archivos');
      btn.click();
      return true;
    }, SELECTORES.botonImportarArchivos);

    if (!clickeado) {
      throw new Error('DocumentosRequisicion: no se encontró el botón "Importar archivos" en el panel');
    }
    await this.popup.esperarVisible(timeout);
    return this.popup;
  }

  /**
   * Importa UN documento: abre el popup, elige la clasificación, carga el archivo
   * (sin diálogo del SO), guarda y devuelve el resultado del notify.
   *
   * No cierra la requisición ni vuelve al listado: deja la pantalla lista para la
   * siguiente clasificación.
   *
   * @param {object} opts
   * @param {string} opts.clasificacion  texto de la clasificación (opción real del dropdown)
   * @param {string} opts.archivoRuta    ruta ABSOLUTA del archivo a subir (la resuelve el test)
   * @returns {Promise<{clasificacionElegida:string, archivo:{nombre:string,bytes:number},
   *                    notify:string, exito:boolean, invalido:boolean, errorSistema:boolean,
   *                    guardar:object}>}
   */
  async importarDocumento({ clasificacion, archivoRuta }, timeout = config.timeouts.explicitWaitMs) {
    logger.info(`DocumentosRequisicion: importar documento (clasificación "${clasificacion}")`);
    await this._abrirPopupImportar(timeout);

    // 1) clasificación — selectbox por locator (no tiene label group-field)
    const clasificacionElegida = await this.form.elegirEnSelectbox(
      By.css(SELECTORES.dropdownClasificacion),
      clasificacion
    );

    // 2) archivo — al input oculto del popup (sin abrir el selector del SO)
    const archivo = await this.uploader.subir(archivoRuta, { timeout });

    // 3) esperar a que el popup refleje el archivo (listo para subir)
    const listo = await this.driver
      .wait(async () => {
        return this.driver.executeScript((n) => {
          const p = Array.from(document.querySelectorAll('.dx-popup-wrapper')).filter(
            (x) => x.offsetWidth > 0
          ).pop();
          return !!(p && (p.textContent || '').includes(n));
        }, archivo.nombre);
      }, timeout)
      .then(() => true)
      .catch(() => false);
    if (!listo) {
      logger.error(`DocumentosRequisicion: el popup no reflejó el archivo "${archivo.nombre}"`);
    }

    // 4) Guardar — botón habilitado del popup (no adivina; no clickea deshabilitados)
    const guardar = await this.popup.accionar('guardar', { etiqueta: 'Guardar', timeout });
    if (!guardar.encontrado || guardar.deshabilitado) {
      return {
        clasificacionElegida,
        archivo,
        guardar,
        ...Notify.clasificar(''),
      };
    }

    // 5) resultado de la app
    const resultado = await this.notify.esperarResultado(timeout);

    // 6) Esperar a que el popup CIERRE antes de devolver: así la siguiente
    //    importación no encuentra dos modales solapados (evita stale elements al
    //    reabrir el selectbox de clasificación en la próxima iteración).
    await this.popup.esperarCerrado(timeout);

    return { clasificacionElegida, archivo, guardar, ...resultado };
  }
}

module.exports = DocumentosRequisicionPage;
