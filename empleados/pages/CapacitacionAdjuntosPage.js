const { By } = require('selenium-webdriver');
const { BasePage, Popup, FileUploader, Notify } = require('@triple/core');
const DataGrid = require('@triple/core/components/DataGrid');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Pantalla de ADJUNTOS de UNA Capacitación (Empleado > detalle > sección
 * "Capacitación" > ícono de clip "Adjuntar documento" en la columna "Acción").
 *
 * Confirmado con Selenium real (probe 2026-09-07):
 *  - El clip NAVEGA a una pantalla propia (`.capacitaciones-docs-page`, cambia
 *    la URL), NO abre un panel lateral.
 *  - El título de la pantalla (`<h2 class*="record-name">` de la `SrhhGenericBar`,
 *    con `title=` y texto) es el NOMBRE DE LA CAPACITACIÓN — se usa para
 *    confirmar "el archivo se adjuntó a ESTA capacitación".
 *  - Al lado del título hay 2 botones: "Adjuntar" y "Eliminar".
 *  - "Adjuntar" abre un popup `.adjuntar-documento-popup` ("Importar
 *    Documentos") con un `dx-fileuploader` (input oculto `input.dx-fileuploader-input`,
 *    `name="files[]"`), "Buscar en sistema", "Guardar" y "Descartar".
 *  - `accept` del input: `.pdf,.docx,.doc,.png,.jpg,.jpeg` — NO acepta `.txt`
 *    (a diferencia de "Documentos" de Requisición). Los tests usan un PDF
 *    genérico (`testFiles.resolver({ tipo: 'pdf' })`).
 *  - Guardar OK -> notify "Documento creado exitosamente", el popup se cierra y
 *    el grid de la pantalla lista el archivo (columna "Nombre archivo" con un
 *    sufijo UUID: `<base>_<uuid>`, columna "Tipo de archivo" = `.pdf`).
 *
 * Confirmado con Selenium real (2026-09-09, `eliminar()`/`descargar()`):
 *  - Headers reales del grid: `["", "Imagen", "Nombre archivo", "Tipo de
 *    archivo", "Fecha de Creación", "Tamaño", ""]` — la PRIMERA columna
 *    (checkbox de selección) y la ÚLTIMA (ícono de descarga,
 *    `.dx-icon-download`) NO tienen título.
 *  - "Eliminar" (checkbox + botón + confirmar "Aceptar") SÍ borra en el
 *    backend, pero el grid en pantalla no se auto-refresca — ver el
 *    docblock de `eliminar()`.
 *  - Descargar (ícono de la última columna) responde "No estás autorizado
 *    para realizar esta acción" en este ambiente/usuario — ver el docblock
 *    de `descargar()`.
 */
class CapacitacionAdjuntosPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.pagina = By.css('.capacitaciones-docs-page');
    this.tituloRecord = By.css('.capacitaciones-docs-page h2[class*="record-name"], h2[class*="record-name"]');
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

  /** Nombre de la capacitación mostrado como título de la pantalla (el `title=` del `<h2>`, o su texto). */
  async tituloCapacitacion() {
    const el = await this.waitVisible(this.tituloRecord);
    const attr = (await el.getAttribute('title')) || '';
    return (attr || (await el.getText()) || '').trim();
  }

  /** Filas del grid de adjuntos como texto (`.dx-data-row` innerText). */
  async leerAdjuntos() {
    return this.driver.executeScript(() => {
      const page = document.querySelector('.capacitaciones-docs-page') || document.body;
      return Array.from(page.querySelectorAll('.dx-data-row'))
        .map((r) => r.innerText.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    });
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
    logger.info(`CapacitacionAdjuntosPage: archivo seleccionado "${subido.nombre}"`);

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
        `CapacitacionAdjuntosPage: "Guardar" del popup quedó deshabilitado tras cargar "${subido.nombre}" — ` +
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
        `CapacitacionAdjuntosPage: no se pudo seleccionar (checkbox) el documento a eliminar ` +
          `(${nombre ? `"${nombre}"` : '(primero)'}).`
      );
    }

    const clickeado = await this.driver.executeScript(() => {
      const page = document.querySelector('.capacitaciones-docs-page') || document.body;
      const btn = Array.from(page.querySelectorAll('button, .dx-button, [role="button"]')).find(
        (b) => b.offsetParent && /^eliminar$/i.test((b.textContent || '').trim())
      );
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return true;
    });
    if (!clickeado) {
      throw new Error('CapacitacionAdjuntosPage: no se encontró el botón "Eliminar" de la pantalla de adjuntos.');
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
    const encontrado = await this.driver.executeScript((buscado) => {
      const page = document.querySelector('.capacitaciones-docs-page') || document.body;
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
    }, nombre || null);
    if (!encontrado) {
      throw new Error(
        `CapacitacionAdjuntosPage: no se encontró el botón de descarga del documento ` +
          `(${nombre ? `"${nombre}"` : '(primero)'}).`
      );
    }
    const notify = await this.notify.esperarTexto(6000);
    return { encontrado, notify };
  }
}

module.exports = CapacitacionAdjuntosPage;
