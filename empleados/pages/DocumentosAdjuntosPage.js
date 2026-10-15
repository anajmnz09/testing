const { By } = require('selenium-webdriver');
const { BasePage, Popup, FileUploader, Notify } = require('@triple/core');
const DataGrid = require('@triple/core/components/DataGrid');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Pantalla de ADJUNTOS de un registro de una sección del detalle de Empleado (Capacitación, Herramientas…): una pantalla propia
 * (`<paginaCss>`) titulada con el nombre del registro, con "Adjuntar" / "Eliminar" y un grid de documentos. Comportamiento
 * idéntico en todas (popup "Importar Documentos", checkbox + "Eliminar" + "Aceptar", ícono de descarga en la última columna);
 * solo cambia la clase CSS de la pantalla. Cada sección concreta extiende esta clase, fija su `paginaCss` y declara su
 * `ENTIDAD_FLUJO`. El detalle de lo confirmado con Selenium real vive en `CapacitacionAdjuntosPage`.
 */
class DocumentosAdjuntosPage extends BasePage {
  /** @param {string} paginaCss selector de la pantalla de adjuntos de la sección (p. ej. `.capacitaciones-docs-page`). */
  constructor(driver, paginaCss) {
    super(driver);
    this.paginaCss = paginaCss;
    this.pagina = By.css(paginaCss);
    this.tituloRecord = By.css(`${paginaCss} h2[class*="record-name"], h2[class*="record-name"]`);
    this.btnAdjuntar = By.xpath(
      "//*[contains(@class,'dx-button')][normalize-space(.)='Adjuntar' and not(ancestor::*[contains(@class,'dx-popup')])]"
    );
    this.popup = new Popup(driver, { contiene: '.dx-fileuploader' });
    this.uploader = new FileUploader(driver, {
      selector: '.adjuntar-documento-popup input.dx-fileuploader-input, .adjuntar-documento-popup input[type="file"]',
    });
    this.btnGuardarPopup = By.xpath(
      "//*[contains(@class,'adjuntar-documento-popup')]//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']"
    );
    this.notify = new Notify(driver);
  }

  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(this.pagina, timeout);
    await this.waitVisible(this.btnAdjuntar, timeout);
    await this.esperarSinLoader().catch(() => {});
    return this;
  }

  /** Nombre del registro mostrado como título de la pantalla (el `title=` del `<h2>`, o su texto). */
  async titulo() {
    const el = await this.waitVisible(this.tituloRecord);
    const attr = (await el.getAttribute('title')) || '';
    return (attr || (await el.getText()) || '').trim();
  }

  /** Filas del grid de adjuntos como texto (`.dx-data-row` innerText). */
  async leerAdjuntos() {
    return this.driver.executeScript((css) => {
      const page = document.querySelector(css) || document.body;
      return Array.from(page.querySelectorAll('.dx-data-row'))
        .map((r) => r.innerText.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    }, this.paginaCss);
  }

  /** Espera (poll) a que el grid liste un adjunto que contenga `fragmento`. Devuelve el último listado leído. */
  async esperarAdjunto(fragmento, timeout = 15000) {
    const buscado = String(fragmento).toLowerCase();
    let filas = [];
    await this.driver
      .wait(async () => {
        filas = await this.leerAdjuntos();
        return filas.some((f) => f.toLowerCase().includes(buscado));
      }, timeout)
      .catch(() => {});
    return filas;
  }

  /**
   * Adjunta `rutaArchivo` (absoluta): "Adjuntar" -> popup "Importar Documentos"
   * -> carga el archivo al input oculto (SIN diálogo del SO) -> espera a que
   * "Guardar" quede habilitado -> Guardar -> espera el cierre del popup y
   * clasifica el notify. Devuelve `{ exito, invalido, notify, archivo }`.
   */
  async adjuntar(rutaArchivo) {
    const btn = await this.waitVisible(this.btnAdjuntar);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"});arguments[0].click()', btn);
    await this.popup.esperarVisible();

    const subido = await this.uploader.subir(rutaArchivo);
    logger.info(`DocumentosAdjuntosPage: archivo seleccionado "${subido.nombre}"`);

    // "Guardar" del popup habilitado (el uploader valida la extensión ANTES de
    // habilitarlo — un `.txt` lo deja deshabilitado y muestra "El tipo de
    // archivo no está permitido").
    const guardar = await this.driver.wait(async () => {
      const els = await this.driver.findElements(this.btnGuardarPopup);
      for (const e of els) {
        const cls = await e.getAttribute('class');
        if ((await e.isDisplayed().catch(() => false)) && !/dx-state-disabled/.test(cls)) return e;
      }
      return null;
    }, config.timeouts.explicitWaitMs);
    if (!guardar) {
      throw new Error(
        `DocumentosAdjuntosPage: "Guardar" del popup quedó deshabilitado tras cargar "${subido.nombre}" — ` +
          `¿extensión no permitida? (accept: .pdf,.docx,.doc,.png,.jpg,.jpeg).`
      );
    }
    await this.driver.executeScript('arguments[0].click()', guardar);

    const cerrado = await this.popup
      .esperarCerrado(config.timeouts.explicitWaitMs)
      .then(() => true)
      .catch(() => false);
    const texto = await this.notify.esperarTexto(config.timeouts.explicitWaitMs);
    const clasificado = texto ? Notify.clasificar(texto) : { notify: '', exito: cerrado, invalido: !cerrado, errorSistema: false };
    return { ...clasificado, cerrado, archivo: subido.nombre };
  }

  /** Selecciona (checkbox) el documento cuyo nombre CONTIENE `nombre`, o el PRIMERO si no se pasa nada. */
  async _seleccionarDocumento(nombre) {
    const grid = new DataGrid(this.driver);
    return grid.seleccionarFila(nombre);
  }

  /**
   * Elimina el documento cuyo nombre CONTIENE `nombre` (o el PRIMERO si no se
   * pasa nada): checkbox (columna de selección) -> botón "Eliminar" (al lado
   * de "Adjuntar") -> confirma el popup ("Eliminar documento(s)... ¿Seguro
   * que desea eliminar los registros seleccionados?", Aceptar/Cancelar) con
   * "Aceptar".
   *
   * CONFIRMADO CON SELENIUM REAL (2026-09-09): a diferencia de "Eliminar
   * Capacitación" (bug de app — ver `EmpleadoDetallePage.eliminarCapacitacion`),
   * ESTA eliminación SÍ funciona del lado del backend (notify "Documento
   * eliminado exitosamente", confirmado con un RELOAD completo de la
   * pantalla: el documento ya no está). Pero el GRID EN PANTALLA no se
   * refresca solo tras eliminar — `leerAdjuntos()`/`esperarAdjunto()`
   * llamado INMEDIATAMENTE después de este método sigue mostrando la fila
   * vieja (falso negativo de persistencia, no un bug de borrado real). El
   * caller DEBE RECARGAR (F5, `driver.navigate().refresh()` + `estaCargado()`)
   * esta MISMA pantalla para verificar que el documento ya no aparece — no
   * confiar en el grid in-place. NO re-navegar desde el grid de Capacitación
   * (`EmpleadoDetallePage.abrirAdjuntarCapacitacion`): tras `eliminar()` el
   * navegador sigue en `.capacitaciones-docs-page` (pantalla propia,
   * navegada por URL), no en el listado de Capacitación — reintentar el
   * click del ícono de clip ahí falla ("el grid de Capacitación no se pudo
   * leer"). Mismo criterio de "no confiar en el grid in-place" ya
   * establecido para "Capacitación" (`editar-capacitacion.test.js`: "el grid
   * de esta sección refresca de forma inconsistente").
   *
   * Devuelve `{ seleccionado, popupApareció, popupCerrado, notify }`.
   */
  async eliminar(nombre) {
    const seleccionado = await this._seleccionarDocumento(nombre);
    if (!seleccionado) {
      throw new Error(
        `DocumentosAdjuntosPage: no se pudo seleccionar (checkbox) el documento a eliminar ` +
          `(${nombre ? `"${nombre}"` : '(primero)'}).`
      );
    }

    const clickeado = await this.driver.executeScript((css) => {
      const page = document.querySelector(css) || document.body;
      const btn = Array.from(page.querySelectorAll('button, .dx-button, [role="button"]')).find(
        (b) => b.offsetParent && /^eliminar$/i.test((b.textContent || '').trim())
      );
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return true;
    }, this.paginaCss);
    if (!clickeado) {
      throw new Error('DocumentosAdjuntosPage: no se encontró el botón "Eliminar" de la pantalla de adjuntos.');
    }

    const popup = new Popup(this.driver);
    const popupApareció = await popup
      .esperarVisible(5000)
      .then(() => true)
      .catch(() => false);

    let notify = '';
    if (popupApareció) {
      await popup.accionar(/aceptar/i, { etiqueta: 'Aceptar' });
      await popup.esperarCerrado(8000);
      notify = await this.notify.esperarTexto(8000);
    }
    const popupCerrado = !(await popup.estaVisible());

    return { seleccionado, popupApareció, popupCerrado, notify };
  }

  /**
   * Descarga el documento cuyo nombre CONTIENE `nombre` (o el PRIMERO si no
   * se pasa nada): clickea el ícono de la ÚLTIMA columna del grid (columna
   * SIN título — confirmado real: header `""`, ícono `.dx-icon-download`).
   *
   * BUG/PERMISO CONOCIDO (confirmado con Selenium real, 2026-09-09): el
   * usuario/ambiente actual NO tiene autorización — la app responde
   * "Operación Inválida — No estás autorizado para realizar esta acción" en
   * vez de iniciar la descarga. No es un bug de este método/test. Se deja
   * codificado el flujo CORRECTO (click en el ícono de descarga) para que,
   * cuando se otorgue el permiso, el caso pase solo — ahí SÍ hará falta
   * verificar el archivo descargado (hoy no hay nada que verificar: no
   * descarga nada).
   *
   * Devuelve `{ encontrado, notify }`.
   */
  async descargar(nombre) {
    const encontrado = await this.driver.executeScript((buscado, css) => {
      const page = document.querySelector(css) || document.body;
      const filas = Array.from(page.querySelectorAll('.dx-data-row'));
      const fila = buscado ? filas.find((f) => (f.textContent || '').includes(buscado)) : filas[0];
      if (!fila) return false;
      const celdas = fila.querySelectorAll('td');
      const ultima = celdas[celdas.length - 1];
      const icono = ultima && ultima.querySelector('.dx-icon-download, img, svg, i, [role="button"], a');
      if (!icono) return false;
      icono.scrollIntoView({ block: 'center' });
      icono.click();
      return true;
    }, nombre || null, this.paginaCss);
    if (!encontrado) {
      throw new Error(
        `DocumentosAdjuntosPage: no se encontró el botón de descarga del documento ` +
          `(${nombre ? `"${nombre}"` : '(primero)'}).`
      );
    }
    const notify = await this.notify.esperarTexto(6000);
    return { encontrado, notify };
  }
}

module.exports = DocumentosAdjuntosPage;
