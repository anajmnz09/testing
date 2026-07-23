const fs = require('fs');
const path = require('path');
const { By } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Carga de archivos SIN abrir el diálogo del sistema operativo.
 *
 * En la app, el botón "Buscar en sistema" (o un drag&drop) dispara el selector
 * nativo del SO, que Selenium NO puede operar. El patrón robusto y estándar es
 * enviar la ruta ABSOLUTA del archivo directamente al `<input type="file">`
 * oculto: el navegador procesa el archivo igual que si el usuario lo hubiera
 * elegido, y el diálogo nativo nunca se abre.
 *
 * Vive en el core porque la carga de archivos se repite en toda la app
 * (documentos de requisición hoy; adjuntos de empleados, importaciones, etc.
 * mañana). Cada pantalla solo aporta el SELECTOR de su input y el archivo.
 *
 * El input suele estar oculto (`display:none` / `h-0px`). Selenium `sendKeys`
 * funciona igual sobre inputs ocultos siempre que existan en el DOM: por eso NO
 * se exige que sea visible.
 */
class FileUploader extends BaseComponent {
  /**
   * @param driver
   * @param {string} [selector] CSS del `input[type=file]`. Por defecto, cualquiera.
   */
  constructor(driver, { selector = 'input[type="file"]' } = {}) {
    super(driver);
    this.selector = selector;
  }

  /**
   * Envía `rutaArchivo` (absoluta) al input de archivos. Si hay varios inputs que
   * matchean, usa el que declara `accept` (el que filtra por extensión) y, si
   * ninguno lo declara, el primero.
   *
   * FALLA EXPLÍCITO si el archivo no existe: cargar "nada" produciría un falso
   * verde. No adivina ni sustituye el archivo silenciosamente.
   *
   * @param {string} rutaArchivo  ruta ABSOLUTA a un archivo existente
   * @param {object} [opts]
   * @param {string} [opts.selector]  sobreescribe el selector del input
   * @returns {Promise<{ruta:string, nombre:string, bytes:number}>}
   */
  async subir(rutaArchivo, { selector = this.selector, timeout = config.timeouts.explicitWaitMs } = {}) {
    const ruta = path.resolve(rutaArchivo);
    if (!fs.existsSync(ruta) || !fs.statSync(ruta).isFile()) {
      throw new Error(`FileUploader: el archivo a subir no existe: "${ruta}"`);
    }
    const nombre = path.basename(ruta);
    const bytes = fs.statSync(ruta).size;

    // Espera a que exista AL MENOS un input (puede estar oculto).
    await this.driver.wait(async () => {
      const inputs = await this.driver.findElements(By.css(selector));
      return inputs.length > 0;
    }, timeout);

    const inputs = await this.driver.findElements(By.css(selector));
    let objetivo = null;
    for (const inp of inputs) {
      const accept = await inp.getAttribute('accept');
      if (accept) {
        objetivo = inp;
        break;
      }
    }
    if (!objetivo) [objetivo] = inputs;

    logger.info(`FileUploader: enviando "${nombre}" (${bytes} bytes) al input "${selector}"`);
    await objetivo.sendKeys(ruta);
    return { ruta, nombre, bytes };
  }
}

module.exports = FileUploader;
