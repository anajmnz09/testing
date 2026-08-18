const { By, until } = require('selenium-webdriver');
const BasePage = require('./base/BasePage');
const DataGrid = require('../components/DataGrid');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Base reutilizable para el LISTADO de cualquier entidad de "Configuración >
 * Administración > <Entidad>" (Sucursales, Departamentos, Puestos, …).
 * Mismo patrón genérico que cualquier listado de la app (DataGrid + botón
 * "Crear" reales) — mapeo verificado con Selenium Headed, primero en
 * Sucursales y confirmado igual en Departamentos.
 *
 * Cada entidad SOLO necesita extender esta clase y declarar
 * `static get DetallePageClass()` (la subclase de
 * `ConfiguracionEntidadDetallePage` correspondiente) — el resto (esperar el
 * grid, clickear "Crear", doble-click + reintento para abrir un registro
 * existente) es idéntico para cualquier entidad, así que vive acá una sola
 * vez.
 */
class ConfiguracionEntidadListadoPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
  }

  /** Page Object del detalle (Crear/Consultar/Editar) de esta entidad (OBLIGATORIO: cada entidad lo declara). */
  static get DetallePageClass() {
    throw new Error(`${this.name}: falta declarar "static get DetallePageClass()".`);
  }

  async listo() {
    await this.grid.listo();
    logger.info(`${this.constructor.name}: listado cargado`);
    return this;
  }

  /**
   * Celda a la que apuntar el doble-click para abrir una fila: la primera
   * `<td>` que NO sea la columna de checkbox de selección masiva
   * (`dx-command-select`, columna 1 de "Proveedores de seguros" — la única
   * entidad de Configuración con esa columna habilitada hasta ahora).
   * Confirmado con evidencia real que un doble-click sobre el `<tr>`
   * completo no abre el detalle en esa pantalla (el punto central del
   * bounding box del row cae fuera del área con el handler real), mientras
   * que un doble-click directo sobre la celda de datos sí — se prefiere
   * SIEMPRE una celda de datos en vez del `<tr>` (nunca solo el `<tr>` como
   * fallback): para el resto de entidades (sin esa columna), la primera
   * `<td>` sigue siendo la MISMA celda que antes recibía el click implícito
   * al clickear el row, así que no cambia nada de su comportamiento ya
   * verificado.
   */
  async _celdaClickeable(fila) {
    const celdas = await fila.findElements(By.css('td:not(.dx-command-select)'));
    return celdas.length ? celdas[0] : fila;
  }

  /** Abre el formulario de creación (botón "Crear"). Devuelve la MISMA pantalla que consulta/edición, ya cargada y editable. */
  async crear() {
    logger.info(`${this.constructor.name}: click en "Crear"`);
    await this.grid.crear();
    const DetallePage = this.constructor.DetallePageClass;
    return new DetallePage(this.driver).estaCargado();
  }

  /**
   * Abre el detalle (modo consulta) de un registro por su nombre —doble-click
   * en la fila tras filtrar—, mismo criterio y mecánica de reintento que
   * `SolicitudEmpleoPage.abrirDetalle` (el doble-click a veces entra en
   * edición inline del grid en vez de abrir el detalle real).
   */
  async abrirDetalle(nombre) {
    const timeout = config.timeouts.explicitWaitMs;
    await this.grid.buscar(nombre);
    const filaLoc = this.grid._filaLocator(nombre);
    const headerDetalle = By.css('[class*="forms-header"]');
    const DetallePage = this.constructor.DetallePageClass;

    let ultimoError;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const fila = await this.driver.wait(until.elementLocated(filaLoc), timeout);
        await this.driver.wait(until.elementIsVisible(fila), timeout);
        const celda = await this._celdaClickeable(fila);
        await this.driver.actions().doubleClick(celda).perform();
        await this.esperarSinLoader(timeout);
        await this.driver.wait(until.elementLocated(headerDetalle), 6000);
        logger.info(`${this.constructor.name}: detalle abierto para "${nombre}"`);
        return new DetallePage(this.driver).estaCargado();
      } catch (err) {
        ultimoError = err;
        logger.info(`${this.constructor.name}: reintentando abrir detalle (intento ${intento + 1})`);
      }
    }
    throw ultimoError;
  }

  /**
   * Abre el detalle (modo consulta) de la PRIMERA fila del listado, SIN
   * pasar por el buscador — a diferencia de `abrirDetalle`, que primero
   * filtra con `grid.buscar(nombre)`. Existe porque el buscador de Horarios
   * está roto en el ambiente actual (confirmado con evidencia real: buscar
   * CUALQUIER texto, incluso el de un registro recién creado por este mismo
   * framework, dispara "Internal Error" del backend antes de poder abrir el
   * detalle) — mientras esa falla siga, los casos "automáticos" (sin nombre
   * dirigido desde el Panel) de esa entidad deben evitar `grid.buscar()` por
   * completo. Queda acá (no solo en Horarios) por si otra entidad futura
   * necesita el mismo desvío.
   */
  async abrirPrimero() {
    const timeout = config.timeouts.explicitWaitMs;
    const filaLoc = By.css('.dx-data-row');
    const headerDetalle = By.css('[class*="forms-header"]');
    const DetallePage = this.constructor.DetallePageClass;

    let ultimoError;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const fila = await this.driver.wait(until.elementLocated(filaLoc), timeout);
        await this.driver.wait(until.elementIsVisible(fila), timeout);
        const celda = await this._celdaClickeable(fila);
        await this.driver.actions().doubleClick(celda).perform();
        await this.esperarSinLoader(timeout);
        await this.driver.wait(until.elementLocated(headerDetalle), 6000);
        logger.info(`${this.constructor.name}: detalle abierto (primera fila, sin buscador)`);
        return new DetallePage(this.driver).estaCargado();
      } catch (err) {
        ultimoError = err;
        logger.info(`${this.constructor.name}: reintentando abrir detalle de la primera fila (intento ${intento + 1})`);
      }
    }
    throw ultimoError;
  }
}

module.exports = ConfiguracionEntidadListadoPage;
