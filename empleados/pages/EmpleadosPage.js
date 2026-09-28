const { By, until } = require('selenium-webdriver');
const { BasePage, DataGrid } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const EmpleadoDetallePage = require('./EmpleadoDetallePage');
const EmpleadoFormPage = require('./EmpleadoFormPage');

/**
 * Page Object del listado de "Empleados" — módulo propio (como Reclutamiento
 * o Nómina), NO vive dentro de Configuración.
 *
 * A diferencia del listado de Requisiciones (solo modo lista), este entra en
 * "Modo tarjeta" por defecto y tiene un toggle a "Modo lista" (2 botones con
 * `title="Modo tarjeta"`/`title="Modo lista"` junto al buscador — ver
 * `DataGrid.asegurarModoLista`, ya soporta este caso concreto). Se prefiere
 * SIEMPRE el modo lista para los tests (columnas legibles con
 * `filasPorColumnas`, buscador de grid estándar): `listo()` cambia a lista
 * automáticamente antes de esperar el grid, sin que cada test tenga que
 * acordarse de hacerlo.
 *
 * Columnas confirmadas en "Modo lista" (Selenium real): "" (checkbox),
 * "Código de empleado.", "Nombre", "Sucursal", "Departamento", "Puesto",
 * "Supervisor", "Fecha de ingreso", "Estado".
 *
 * navRouteItems del módulo (navbar, clase `navDropDownItem dx-dropdownbutton`
 * — DISTINTA de la de Reclutamiento, que usa `NavRoute`), mapeados pero sin
 * pantallas propias todavía (se agregan a medida que haya tests):
 *   Empleados (activo, este listado) | Gestión > Acciones de Personal |
 *   Operaciones > Archivos, Ministerio de Trabajo | Consultas y Reportes >
 *   Reportes generales de empleado, Reportes de acciones de personal |
 *   Mi Trabajo > Aprobaciones, Mis Actividades.
 */
class EmpleadosPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
  }

  /** Cambia a "Modo lista" (si hace falta) y espera a que el grid esté cargado. Encadenable. */
  async listo() {
    await this.grid.asegurarModoLista();
    await this.grid.listo();
    logger.info('EmpleadosPage: listado cargado (Modo lista)');
    return this;
  }

  /**
   * Integración CORRECTA del buscador (confirmada por el usuario): este
   * buscador filtra, poniendo el registro que más matchea PRIMERO en la
   * lista — nunca hay que asumir "roto" solo porque el conteo de filas no
   * cambia al toque. Por eso `abrirDetalle` busca y ESPERA a que la
   * PRIMERA fila refleje el resultado, en vez de matchear texto contra
   * TODAS las filas renderizadas (`_filaLocator` fallaría en cuanto el
   * match no sea la única fila con ese texto).
   *
   * NOTA (2026-09-02): en el ambiente de QA actual, el endpoint de
   * búsqueda de este grid en "Modo lista" está devolviendo la respuesta
   * muy lenta (~14s) e inconsistente (llegó a devolver 0 resultados para
   * un nombre exacto presente en pantalla) — parece un problema puntual de
   * API, no de esta integración. La lógica de acá queda codificada para el
   * comportamiento correcto (busca y espera el reflejo en la primera fila,
   * con margen generoso) para cuando el endpoint se normalice; el timeout
   * ya contempla ese retraso observado.
   */
  async abrirDetalle(texto) {
    // Timeout propio (no el `explicitWaitMs` genérico de 10s): el
    // round-trip real observado en este endpoint ronda los ~14s.
    const timeout = 25000;
    await this.grid.buscar(texto);

    try {
      await this.driver.wait(async () => {
        const filas = await this.grid.filasPorColumnas();
        if (!filas.length) return false;
        const primera = Object.values(filas[0]).join(' ').toLowerCase();
        return primera.includes(String(texto).toLowerCase());
      }, timeout);
    } catch (err) {
      throw new Error(
        `EmpleadosPage: tras buscar "${texto}", la primera fila del listado nunca lo reflejó — no se encontró el empleado.`
      );
    }

    return this.abrirPrimero();
  }

  /**
   * Abre el detalle de la PRIMERA fila del listado, sin buscar ni matchear
   * ningún texto. Es el modo "automático" (Panel sin dirigir ningún
   * empleado puntual): SIEMPRE toma lo primero que el listado muestre en
   * ese momento — nunca un nombre fijo/memorizado, porque los registros
   * cambian según la compañía activa.
   */
  async abrirPrimero() {
    const timeout = config.timeouts.explicitWaitMs;
    const filaLoc = By.css('.dx-data-row');

    let ultimoError;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const fila = await this.driver.wait(until.elementLocated(filaLoc), timeout);
        await this.driver.wait(until.elementIsVisible(fila), timeout);
        const celdas = await fila.findElements(By.css('td:not(.dx-command-select)'));
        const celda = celdas.length ? celdas[0] : fila;
        await this.driver.actions().doubleClick(celda).perform();
        await this.esperarSinLoader(timeout);
        return await new EmpleadoDetallePage(this.driver).estaCargado();
      } catch (err) {
        ultimoError = err;
        logger.info(`EmpleadosPage: reintentando abrir detalle de la primera fila (intento ${intento + 1})`);
      }
    }
    throw ultimoError;
  }

  /**
   * Abre el formulario "Crear Empleado" (botón "Crear" de la toolbar, click
   * NATIVO — un click por `executeScript` NO navega, confirmado con
   * Selenium real). Es una pantalla PROPIA (cambia de URL), no un popup —
   * ver `EmpleadoFormPage`.
   */
  async crear() {
    logger.info('EmpleadosPage: click en "Crear"');
    const btn = await this.waitVisible(By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Crear']"));
    await btn.click();
    return new EmpleadoFormPage(this.driver).estaCargado();
  }
}

module.exports = EmpleadosPage;
