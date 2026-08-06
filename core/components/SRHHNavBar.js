const { By, Key } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');

/**
 * Barra de navegación superior (SRHHNavBar), presente en todas las pantallas de
 * la app. ÚNICO componente reutilizable para TODO el sistema: ningún módulo
 * necesita su propia subclase.
 *
 * Estructura (verificada por inspección real del DOM):
 *   navbarLogo      → logo + selectModulos. Siempre igual. Métodos genéricos.
 *   navConfigItems  → sync, notificaciones, configuración, compañía, usuario.
 *                     Siempre igual. Métodos GENÉRICOS por nombre de opción
 *                     (no un método nuevo por cada opción que agregue la app).
 *   navRouteItems   → ÚNICA parte que cambia según el módulo. Se resuelve con
 *                     un catálogo de datos (`CATALOGO_RUTAS`, documentación/
 *                     discoverability) + una búsqueda EN VIVO en el DOM
 *                     (`ir()`): solo el módulo actualmente abierto tiene sus
 *                     rutas renderizadas, así que no hace falta lógica
 *                     específica por módulo — el mismo mecanismo sirve para
 *                     cualquiera.
 *
 * EVIDENCIA OFICIAL de navegación (única fuente de verdad, ver `estaEn()`):
 * el título mostrado en el encabezado principal de la app —
 * `/html/body/div[1]/div[6]/div[1]/div[1]/span` — debe coincidir EXACTAMENTE
 * con el título REAL de la pantalla destino (que NO necesariamente coincide
 * con el nombre del botón del menú — ver `CATALOGO_RUTAS`). La aparición de un
 * overlay o el cambio de longitud de `document.body.innerText` son solo
 * evidencia de INTERACCIÓN, nunca la validación oficial.
 *
 * `ir()` es un DESPACHADOR sin heurísticas: no detecta ni adivina cómo
 * navegar — lee `tipoNavegacion` de `CATALOGO_RUTAS` y ejecuta el flujo
 * correspondiente. Cada tipo conocido:
 *   - 'direct':   un click navega inmediatamente (ancla `navItemLink`).
 *   - 'dropdown': el click abre un dropdown (DevExtreme DropDownButton/
 *                 ButtonGroup, contenedor `NavRoute`); hay que esperar a que
 *                 abra y RECIÉN AHÍ elegir la opción real dentro de él.
 *   - 'future':   reservado para un tercer patrón que aún no apareció; agregar
 *                 su propio caso en `ir()` con evidencia real cuando exista,
 *                 nunca reutilizar 'direct'/'dropdown' por conveniencia.
 */

// Catálogo de navRouteItems CONOCIDOS por módulo — ÚNICA fuente de verdad de
// cómo navegar y cómo confirmar la llegada. `ir()` NO adivina: si una ruta no
// está acá (o le falta `tituloEsperado`), no se puede validar su llegada con
// certeza. Cada entrada documenta EXACTAMENTE lo verificado, nada supuesto:
//   texto           → nombre visible del botón/opción en el navbar.
//   tipoNavegacion  → 'direct' | 'dropdown' | 'future' (ver comentario de clase).
//   tituloEsperado  → texto EXACTO del encabezado tras llegar. `null` si el
//                      tipo de navegación ya se confirmó pero el título de
//                      destino todavía no (no se adivina; se documenta el hueco).
const CATALOGO_RUTAS = {
  Reclutamiento: [
    {
      texto: 'Requisiciones',
      tipoNavegacion: 'direct',
      tituloEsperado: 'Requisición de personal',
    },
    {
      texto: 'Solicitudes de Empleo',
      tipoNavegacion: 'dropdown',
      tituloEsperado: 'Solicitudes de Empleo',
    },
    {
      // Mismo widget/contenedor `NavRoute` que "Solicitudes de Empleo"
      // (verificado en el DOM: comparten la cadena de clases dx-dropdownbutton
      // / dx-buttongroup), de ahí `tipoNavegacion: 'dropdown'` por evidencia
      // estructural. El título de destino AÚN NO se confirmó — no se adivina.
      texto: 'Mi Trabajo',
      tipoNavegacion: 'dropdown',
      tituloEsperado: null,
    },
  ],
};

class SRHHNavBar extends BaseComponent {
  constructor(driver) {
    super(driver);

    // --- navbarLogo ---
    this.logo = By.css('a.navLogoImg');
    // Solo existe DENTRO de un módulo ya abierto (verificado: ausente en el
    // Dashboard, donde no hay "módulo actual" que indicar).
    this.selectModulos = By.id('selectModulos');

    // EVIDENCIA OFICIAL de navegación (ver comentario de clase). XPath absoluto
    // provisto explícitamente: es la única fuente de verdad indicada para
    // confirmar la sección actual, pese a que el framework prefiere en general
    // selectores por nombre accesible/texto — se documenta el porqué de esta
    // excepción acá para que quede claro que es deliberada, no un descuido.
    this.tituloSeccion = By.xpath('/html/body/div[1]/div[6]/div[1]/div[1]/span');

    // --- navConfigItems (ids estables, verificados) ---
    this.syncButton = By.id('SyncCacheButton');
    this.notificationsDropdown = By.id('NotificationDropDown');
    this.configDropdown = By.id('ConfiguracionDropdown');
    this.companyDropdown = By.id('CompanyDropDown');
    this.userDropdown = By.id('userDropDown');
    // el menú de usuario despliega un overlay con items sin id/testid: se ubica por texto
    this.logoutOption = By.xpath(
      "//*[contains(@class,'UserOptionListItem')][contains(normalize-space(.), 'Cerrar sesión')]"
    );
    // al elegir "Cerrar sesión" aparece un diálogo de confirmación (Aceptar/Cancelar)
    this.confirmLogoutButton = By.xpath(
      "//div[contains(@class,'dx-button')][.//span[contains(@class,'dx-button-text') and normalize-space(.)='Aceptar']]"
    );
  }

  /** Catálogo de navRouteItems conocidos (solo lectura; documentación). */
  static get CATALOGO_RUTAS() {
    return CATALOGO_RUTAS;
  }

  // ---------------------------------------------------------------------------
  // Helpers de overlay (DevExtreme) — compartidos por TODOS los dropdowns del
  // navbar (selectModulos, compañía, usuario, configuración): un solo mecanismo,
  // sin duplicarlo por cada uno.
  // ---------------------------------------------------------------------------

  async _hayOverlayVisible() {
    const els = await this.driver.findElements(By.css('.dx-overlay-content'));
    for (const el of els) {
      try { if (await el.isDisplayed()) return true; } catch (e) { /* stale = cerrado */ }
    }
    return false;
  }

  /** Espera a que no quede ningún overlay de DevExtreme (.dx-overlay-content) VISIBLE. */
  async _esperarOverlayCerrado(timeout = 4000) {
    await this.driver.wait(async () => !(await this._hayOverlayVisible()), timeout).catch(() => {});
  }

  /** Cierra el overlay abierto actual (ESC) y espera a que desaparezca. */
  async _cerrarOverlay() {
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this._esperarOverlayCerrado();
  }

  /**
   * Click en el PRIMER item visible dentro del overlay abierto actual (sin
   * exigir un texto concreto). Fallback para dropdowns donde no se conoce (o
   * no aplica) el texto exacto del item a elegir.
   */
  async _elegirPrimeraOpcionOverlay() {
    const item = By.css('.dx-overlay-content .dx-list-item, .dx-overlay-content .dx-menu-item, .dx-overlay-content [role="menuitem"]');
    const els = await this.driver.findElements(item);
    for (const el of els) {
      try {
        if (await el.isDisplayed()) {
          await el.click();
          await this._esperarOverlayCerrado();
          return true;
        }
      } catch (e) {
        /* stale, seguir buscando */
      }
    }
    return false;
  }

  /**
   * Textos "hoja" (sin hijos) de los overlays de DevExtreme VISIBLES ahora
   * mismo, sin el boilerplate de pull-to-refresh (verificado: "Cargando...",
   * "Desliza hacia abajo...", etc. no son datos de la app).
   */
  async _opcionesOverlayVisible() {
    const items = await this.driver.executeScript(() => {
      const overlays = Array.from(document.querySelectorAll('.dx-overlay-content')).filter(
        (o) => o.offsetParent !== null
      );
      const vistos = new Set();
      const out = [];
      overlays.forEach((o) => {
        Array.from(o.querySelectorAll('*')).forEach((e) => {
          const t = (e.textContent || '').trim();
          if (t && e.children.length === 0 && !vistos.has(t)) {
            vistos.add(t);
            out.push(t);
          }
        });
      });
      return out;
    });
    const RUIDO_DEVEXTREME = /^(cargando|actualizando|desliza hacia abajo|suelta para actualizar)/i;
    return items.filter((t) => !RUIDO_DEVEXTREME.test(t));
  }

  /** Click en la opción `texto` dentro del overlay visible actual. */
  async _elegirEnOverlay(texto) {
    const opcion = By.xpath(
      `//*[contains(@class,'dx-overlay-content')]//*[normalize-space(.)='${texto}'][not(.//*)]`
    );
    await this.click(opcion);
    await this._esperarOverlayCerrado();
  }

  // ---------------------------------------------------------------------------
  // navbarLogo
  // ---------------------------------------------------------------------------

  /** Vuelve al dashboard haciendo click en el logo. */
  async irAlDashboard() {
    logger.info('SRHHNavBar: volviendo al dashboard (logo)');
    await this.click(this.logo);
  }

  /** Módulos disponibles en `selectModulos` (abre, lista, no navega). */
  async listarModulos() {
    logger.info('SRHHNavBar: listar módulos disponibles (selectModulos)');
    await this.click(this.selectModulos);
    const opciones = await this._opcionesOverlayVisible();
    await this._cerrarOverlay();
    return opciones;
  }

  /**
   * Navega a otro módulo usando el selector del navbar (selectModulos), SIN
   * volver primero al dashboard. Reutilizable por cualquier módulo: no hay que
   * reimplementar esta mecánica en cada uno.
   */
  async irAModulo(nombre) {
    logger.info(`SRHHNavBar: ir al módulo "${nombre}" (selectModulos)`);
    await this.click(this.selectModulos);
    await this._elegirEnOverlay(nombre);
  }

  // ---------------------------------------------------------------------------
  // navRouteItems — ÚNICA parte que cambia por módulo. Un solo método `ir()`
  // para todos los módulos: busca en vivo en el DOM (solo el módulo abierto
  // tiene sus rutas renderizadas), sin lógica por módulo ni clases separadas.
  // ---------------------------------------------------------------------------

  /** Texto actual del título de sección (encabezado principal), o `null` si no está visible. */
  async _textoTituloSeccion() {
    const els = await this.driver.findElements(this.tituloSeccion);
    for (const el of els) {
      try {
        if (await el.isDisplayed()) return (await el.getText()).trim();
      } catch (e) {
        /* stale */
      }
    }
    return null;
  }

  /** Busca `nombreOpcion` en CATALOGO_RUTAS (cualquier módulo). `null` si no está documentada. */
  _buscarRutaEnCatalogo(nombreOpcion) {
    for (const rutas of Object.values(CATALOGO_RUTAS)) {
      const encontrada = rutas.find((r) => r.texto === nombreOpcion);
      if (encontrada) return encontrada;
    }
    return null;
  }

  /**
   * True si el encabezado principal muestra EXACTAMENTE `tituloEsperado`, según
   * la EVIDENCIA OFICIAL (ver comentario de clase). Lectura instantánea, sin
   * esperar ni hacer click. Los Page Objects la reutilizan para comprobar en
   * qué sección están, evitando clicks innecesarios sobre el navbar.
   *
   * IMPORTANTE: `tituloEsperado` es el texto REAL del encabezado de la
   * pantalla, que NO necesariamente coincide con el nombre del botón del menú
   * (confirmado: el botón "Requisiciones" navega a una pantalla cuyo
   * encabezado dice "Requisición de personal", no "Requisiciones"). Nunca
   * asumir que ambos textos son iguales; si no se conoce el título real, hay
   * que confirmarlo antes de usarlo acá.
   */
  async estaEn(tituloEsperado) {
    return (await this._textoTituloSeccion()) === tituloEsperado;
  }

  /**
   * Click directo para rutas `tipoNavegacion: 'direct'` (ancla `navItemLink`).
   */
  async _clickDirecto(nombreOpcion) {
    const els = await this.driver.findElements(
      By.xpath(`//*[contains(@class,'navItemLink')][contains(normalize-space(.),'${nombreOpcion}')]`)
    );
    for (const el of els) {
      try {
        if (await el.isDisplayed()) {
          await el.click();
          return;
        }
      } catch (e) {
        /* stale, seguir buscando */
      }
    }
    throw new Error(`SRHHNavBar: no se encontró el navItemLink de "${nombreOpcion}".`);
  }

  /**
   * Click + dropdown para rutas `tipoNavegacion: 'dropdown'` (DevExtreme
   * DropDownButton/ButtonGroup, contenedor `NavRoute`). Click en el trigger →
   * esperar a que el dropdown abra → elegir la opción real dentro de él (por
   * texto exacto; si no aparece con ese texto, el primer item visible).
   */
  async _clickConDropdown(nombreOpcion, intentos = 3) {
    for (let intento = 1; intento <= intentos; intento++) {
      const candidatos = await this.driver.findElements(By.css('[class*="NavRoute" i] *'));
      let trigger = null;
      for (const el of candidatos) {
        try {
          if ((await el.isDisplayed()) && (await el.getText()).trim() === nombreOpcion) {
            trigger = el;
            break;
          }
        } catch (e) {
          /* stale, seguir buscando */
        }
      }
      if (!trigger) {
        throw new Error(`SRHHNavBar: no se encontró el trigger NavRoute de "${nombreOpcion}".`);
      }

      await trigger.click();
      // Esperar el overlay Y que sus opciones ya estén renderizadas (no
      // alcanza con que el contenedor sea visible: DevExtreme lo monta antes
      // de poblar sus items — verificado, causaba una carrera real).
      let opciones = [];
      await this.driver
        .wait(async () => {
          opciones = await this._opcionesOverlayVisible();
          return opciones.length > 0;
        }, 6000)
        .catch(() => {});

      if (opciones.length > 0) {
        logger.info(`SRHHNavBar: dropdown de "${nombreOpcion}" abierto, opciones: ${JSON.stringify(opciones)}`);
        if (opciones.includes(nombreOpcion)) {
          await this._elegirEnOverlay(nombreOpcion);
        } else {
          await this._elegirPrimeraOpcionOverlay();
        }
        return;
      }

      logger.info(
        `SRHHNavBar: dropdown de "${nombreOpcion}" sin opciones (intento ${intento}/${intentos}), reintentando el click`
      );
      // Recuperar el estado antes de reintentar: cerrar cualquier overlay que
      // haya quedado a medio abrir, para que el próximo click parta limpio.
      await this._cerrarOverlay();
    }
    throw new Error(
      `SRHHNavBar: el dropdown de "${nombreOpcion}" nunca mostró opciones tras ${intentos} intento(s) de click.`
    );
  }

  /**
   * Navega a una opción de navRouteItems del módulo ACTUALMENTE abierto, por
   * su texto visible EN EL MENÚ. DESPACHADOR puro: lee `tipoNavegacion` de
   * `CATALOGO_RUTAS` para esta opción y ejecuta el flujo correspondiente — NO
   * detecta ni adivina el comportamiento cada vez.
   *
   * Validación de llegada: si la ruta tiene `tituloEsperado` confirmado, espera
   * `estaEn(tituloEsperado)` (evidencia oficial exacta). Si el tipo de
   * navegación ya se confirmó pero el título de destino todavía no (documentado
   * como `null` en el catálogo), hace el click correcto igual mediante el flujo
   * apropiado, pero solo puede esperar un cambio genérico de encabezado —
   * queda registrado en el log para no ocultar que la validación es parcial.
   */
  async ir(nombreOpcion) {
    logger.info(`SRHHNavBar: ir a "${nombreOpcion}"`);
    const ruta = this._buscarRutaEnCatalogo(nombreOpcion);
    if (!ruta) {
      throw new Error(
        `SRHHNavBar: "${nombreOpcion}" no está documentada en CATALOGO_RUTAS. ` +
          'Investigar su tipoNavegacion y evidencia de llegada, y agregarla antes de usarla.'
      );
    }

    const tituloAntes = await this._textoTituloSeccion();

    switch (ruta.tipoNavegacion) {
      case 'direct':
        await this._clickDirecto(nombreOpcion);
        break;
      case 'dropdown':
        await this._clickConDropdown(nombreOpcion);
        break;
      default:
        throw new Error(
          `SRHHNavBar: tipoNavegacion "${ruta.tipoNavegacion}" no soportado todavía (ruta "${nombreOpcion}").`
        );
    }

    if (ruta.tituloEsperado) {
      await this.driver.wait(async () => this.estaEn(ruta.tituloEsperado), 10000);
    } else {
      logger.info(
        `SRHHNavBar: "${nombreOpcion}" no tiene tituloEsperado confirmado en el catálogo — ` +
          'se espera solo un cambio de encabezado (validación parcial).'
      );
      await this.driver.wait(async () => (await this._textoTituloSeccion()) !== tituloAntes, 10000);
    }
  }

  // ---------------------------------------------------------------------------
  // navConfigItems — SIEMPRE igual, sin importar el módulo. Métodos GENÉRICOS
  // por nombre de opción: si la app agrega una opción nueva a un dropdown
  // existente, no hace falta tocar este componente.
  // ---------------------------------------------------------------------------

  /** Fuerza la actualización/sincronización de caché. */
  async sincronizar() {
    logger.info('SRHHNavBar: sincronizar (SyncCacheButton)');
    await this.click(this.syncButton);
  }

  /** Abre el panel de notificaciones. */
  async abrirNotificaciones() {
    logger.info('SRHHNavBar: abrir notificaciones');
    await this.click(this.notificationsDropdown);
  }

  /** Abre el dropdown de configuración (sin elegir ninguna opción). */
  async abrirConfiguracion() {
    logger.info('SRHHNavBar: abrir configuración');
    await this.click(this.configDropdown);
  }

  /** Opciones disponibles en el dropdown de configuración (abre, lista, cierra). */
  async listarOpcionesConfiguracion() {
    await this.abrirConfiguracion();
    const opciones = await this._opcionesOverlayVisible();
    await this._cerrarOverlay();
    return opciones;
  }

  /** Abre el dropdown de configuración y elige la opción `nombre`. */
  async abrirOpcionConfiguracion(nombre) {
    logger.info(`SRHHNavBar: abrir opción de configuración "${nombre}"`);
    await this.click(this.configDropdown);
    await this._elegirEnOverlay(nombre);
  }

  /** Abre el selector de compañía (sin elegir ninguna). */
  async abrirMenuCompania() {
    logger.info('SRHHNavBar: abrir menú de compañía');
    await this.click(this.companyDropdown);
  }

  /** Texto de la compañía activa mostrada en el navbar. */
  async getCompania() {
    return (await this.getText(this.companyDropdown)).trim();
  }

  /** Compañías disponibles en el selector (abre, lista, cierra). */
  async listarCompanias() {
    await this.abrirMenuCompania();
    const opciones = await this._opcionesOverlayVisible();
    await this._cerrarOverlay();
    return opciones;
  }

  /** Cambia a la compañía `nombre` desde el selector del navbar. */
  async cambiarCompania(nombre) {
    logger.info(`SRHHNavBar: cambiar a compañía "${nombre}"`);
    await this.abrirMenuCompania();
    await this._elegirEnOverlay(nombre);
  }

  /** Abre el menú de usuario (sin elegir ninguna opción). */
  async abrirMenuUsuario() {
    logger.info('SRHHNavBar: abrir menú de usuario');
    await this.click(this.userDropdown);
  }

  /** Texto del usuario logueado mostrado en el navbar. */
  async getUsuario() {
    return (await this.getText(this.userDropdown)).trim();
  }

  /**
   * Opciones disponibles en el menú de usuario (abre, lista, cierra). Se leen
   * EN VIVO del DOM: si la app agrega/quita una opción, se refleja acá sin
   * tocar código.
   */
  async listarOpcionesUsuario() {
    await this.abrirMenuUsuario();
    const opciones = await this._opcionesOverlayVisible();
    await this._cerrarOverlay();
    return opciones;
  }

  /** Abre el menú de usuario y elige la opción `nombre`. */
  async abrirOpcionUsuario(nombre) {
    logger.info(`SRHHNavBar: abrir opción de usuario "${nombre}"`);
    await this.click(this.userDropdown);
    await this._elegirEnOverlay(nombre);
  }

  /** Abre el menú de usuario, elige "Cerrar sesión" y confirma el diálogo. */
  async logout() {
    logger.info('SRHHNavBar: abriendo menú de usuario');
    await this.click(this.userDropdown);
    logger.info('SRHHNavBar: click en "Cerrar sesión"');
    await this.click(this.logoutOption);
    logger.info('SRHHNavBar: confirmando cierre de sesión (Aceptar)');
    await this.click(this.confirmLogoutButton);
  }
}

module.exports = SRHHNavBar;
