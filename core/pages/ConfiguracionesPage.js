const { By, until } = require('selenium-webdriver');
const BasePage = require('./base/BasePage');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Pantalla "Configuraciones" (landing de la sección de configuración del
 * sistema). Se llega vía el ícono de configuración del navbar —SIEMPRE
 * presente, en cualquier módulo— eligiendo la opción "Configuraciones" de su
 * dropdown (la otra opción, "Acerca de", es distinta y no navega acá). App-
 * global → vive en el core, igual que `DashboardPage`.
 *
 * Lista MUCHAS categorías (Administración, Nómina, Interfaces, Usuarios y
 * permisos, …) en un menú lateral — `irA()` navega genéricamente a CUALQUIER
 * opción de ese menú por su nombre exacto, reutilizable por cualquier módulo
 * que trabaje una entidad de Configuración (Sucursales, Departamentos,
 * Puestos, …); el mapeo del LISTADO/FORM de cada entidad es responsabilidad
 * de su propio módulo (ver `configuracion/pages/SucursalesPage.js`), no de
 * esta clase.
 *
 * Evidencia de llegada verificada con Selenium Headed (URL cambia, click
 * real completado): NO se pudo usar la evidencia "oficial" de
 * `SRHHNavBar.estaEn()` (su `tituloSeccion` queda `null` acá, confirmado) ni
 * la barra `SrhhGenericBar_title` que usan otras pantallas (también `null`
 * acá) — esta pantalla tiene su PROPIO `<h1>Configuraciones</h1>`.
 */
const SEL = {
  titulo: By.xpath("//h1[normalize-space(.)='Configuraciones']"),
};

class ConfiguracionesPage extends BasePage {
  async estaCargado(timeout) {
    await this.waitVisible(SEL.titulo, timeout);
    logger.info('ConfiguracionesPage: cargada');
    return this;
  }

  /** Texto real del título ("Configuraciones"). */
  async getTitulo() {
    return (await this.getText(SEL.titulo)).trim();
  }

  /** Locator del link del menú lateral por su `title` exacto (ej. "Sucursales", "Administración"). */
  _selOpcionMenu(nombre) {
    return By.xpath(`//a[@title='${nombre}']`);
  }

  /** True si el link `nombre` del menú lateral está visible ahora mismo. */
  async _opcionMenuVisible(nombre) {
    const els = await this.driver.findElements(this._selOpcionMenu(nombre));
    for (const el of els) {
      try {
        if (await el.isDisplayed()) return true;
      } catch (e) {
        /* stale */
      }
    }
    return false;
  }

  /**
   * Navega a una opción del menú lateral de Configuraciones (ej.
   * "Sucursales", dentro de la sección "Administración") por el `title`
   * EXACTO del link (`<a title="Sucursales" href="/srhh/config/
   * administracion/sucursales">`, verificado con Selenium Headed) — nunca
   * por posición dentro del menú.
   *
   * `seccionPadre` (opcional): el menú lateral, verificado con Selenium
   * Headed, muestra TODAS las opciones (de todas las secciones) sin
   * necesidad de expandir nada primero — pero por si alguna sección
   * arrancara colapsada (no se puede garantizar para TODAS, solo se
   * confirmó "Administración"), si `nombreOpcion` no está visible se
   * clickea primero el link de `seccionPadre` para revelarla, tolerante a
   * ambos casos.
   *
   * El click nativo de Selenium sobre el link de la opción, verificado con
   * evidencia real, tira `element not interactable` (el ítem está montado
   * pero fuera del viewport/scroll del sidebar) — se hace `scrollIntoView`
   * + click, con click por JS como fallback si el nativo falla igual.
   *
   * Evidencia de llegada: la pantalla destino usa la MISMA barra de título
   * que otras pantallas de listado (`SrhhGenericBar_title`, ej. "Banco de
   * candidatos") — se espera (poll) a que su texto sea EXACTAMENTE
   * `tituloEsperado` (por defecto, `nombreOpcion`: la mayoría de las
   * opciones tienen el mismo texto en el menú y en el título de destino).
   * `tituloEsperado` opcional distinto: confirmado con evidencia real que
   * "Proveedores de seguros" (nombre del link, plural) navega a una
   * pantalla titulada "Proveedor de seguros" (singular) — mismo patrón ya
   * documentado en `SRHHNavBar.CATALOGO_RUTAS` para "Requisiciones" →
   * "Requisición de personal": el texto del menú NUNCA se asume igual al
   * título real de destino.
   *
   * REINTENTO del click completo (no solo el fallback nativo->JS):
   * confirmado con evidencia real que un click (nativo, SIN lanzar excepción)
   * puede quedar como un simple hover/estado visual del ítem del sidebar sin
   * disparar la navegación SPA — el contenido principal seguía mostrando la
   * pantalla anterior (el perfil de usuario) mientras el ítem del menú ya se
   * veía "seleccionado". Causa probable: el sidebar recién montado todavía
   * está terminando de conectar sus handlers de click cuando se lo clickea
   * inmediatamente después de `estaCargado()`. Por eso se reintenta el click
   * completo (no solo el fallback JS) hasta `intentos` veces, esperando la
   * evidencia de llegada en cada uno, en vez de un solo intento.
   */
  async irA(nombreOpcion, seccionPadre, tituloEsperado = nombreOpcion, intentos = 3) {
    logger.info(`ConfiguracionesPage: ir a "${nombreOpcion}"${seccionPadre ? ` (sección "${seccionPadre}")` : ''}`);

    if (seccionPadre && !(await this._opcionMenuVisible(nombreOpcion))) {
      const padre = await this.driver.wait(until.elementLocated(this._selOpcionMenu(seccionPadre)), config.timeouts.explicitWaitMs);
      await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', padre);
      await this.driver.executeScript('arguments[0].click()', padre);
      await this.driver
        .wait(async () => this._opcionMenuVisible(nombreOpcion), 4000)
        .catch(() => {});
    }

    const tituloDestino = By.css('[class*="SrhhGenericBar_title"]');
    const yaLlego = async () => {
      const els = await this.driver.findElements(tituloDestino);
      for (const el of els) {
        try {
          if ((await el.isDisplayed()) && (await el.getText()).trim() === tituloEsperado) return true;
        } catch (e) {
          /* stale */
        }
      }
      return false;
    };

    for (let intento = 1; intento <= intentos; intento++) {
      const opcion = await this.driver.wait(until.elementLocated(this._selOpcionMenu(nombreOpcion)), config.timeouts.explicitWaitMs);
      await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', opcion);
      try {
        await opcion.click();
      } catch (e) {
        await this.driver.executeScript('arguments[0].click()', opcion);
      }

      const llego = await this.driver
        .wait(yaLlego, intento === intentos ? config.timeouts.explicitWaitMs : 4000)
        .then(() => true)
        .catch(() => false);
      if (llego) return;

      logger.info(`ConfiguracionesPage: "${nombreOpcion}" no navegó tras el click (intento ${intento}/${intentos}), reintentando`);
    }
    throw new Error(`ConfiguracionesPage: "${nombreOpcion}" nunca navegó tras ${intentos} intento(s) de click.`);
  }
}

module.exports = ConfiguracionesPage;
