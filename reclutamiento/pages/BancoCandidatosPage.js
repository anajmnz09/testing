const { By, until } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const DataGrid = require('@triple/core/components/DataGrid');
const Form = require('@triple/core/components/Form');
const Popup = require('@triple/core/components/Popup');
const Notify = require('@triple/core/components/Notify');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const testContext = require('@triple/core/context/testContext');

/**
 * Pantalla "Banco de candidatos" (dos tabs: "Elegibles"/"Descartados", cada
 * una con su propio listado). Mapeo verificado con Selenium Headed:
 *  - Título real: `[class*="SrhhGenericBar_title"]` — barra de título
 *    DISTINTA a la de Requisiciones/Solicitudes; NO usa el XPath absoluto de
 *    `SRHHNavBar.estaEn` (confirmado con evidencia real, esa evidencia
 *    oficial no aplica a esta pantalla).
 *  - Tabs: widget `dx-tabs` real, ítems `.dx-tab` con texto "Elegibles"/
 *    "Descartados"; el activo tiene la clase `dx-tab-selected`.
 *  - Listado: igual que Empleados, abre en "Modo tarjeta" por defecto (no
 *    legible por `DataGrid`) — hay que cambiar a "Modo lista"
 *    (`DataGrid.asegurarModoLista`, ya genérico) para leer filas.
 *  - Columnas verificadas (tab "Elegibles"): Apreciación, Etiquetas, Nombre,
 *    Teléfono, email, Último puesto aplicado.
 *
 * Se llega acá por DOS caminos, ambos ya cubiertos por el framework, sin
 * lógica propia de esta clase:
 *  - `RequisicionDetallePage.irABancoElegibles()` (botón "B. Elegibles" del
 *    header de una requisición).
 *  - `SRHHNavBar.ir('Banco de candidatos')` (navbar, dentro del dropdown que
 *    también abre "Solicitudes de Empleo" — sin trigger propio).
 */
const SEL = {
  titulo: By.css('[class*="SrhhGenericBar_title"]'),
};

// `contains(@class, 'dx-tab')` (substring) también matchea contenedores
// GRANDES como `dx-tabpanel`/`dx-multiview-wrapper` (envuelven la tab Y todo
// el grid debajo) — confirmado con evidencia real: el "tab" resultante medía
// 785px de alto, y su centro (donde cae el click) caía sobre una celda del
// grid, no sobre el botón real de la tab. Se matchea el TOKEN exacto de
// clase (`... dx-tab ...` con espacios) para evitar ese falso positivo.
function _porClaseExacta(clase, condicionTexto) {
  return `//div[contains(concat(' ', normalize-space(@class), ' '), ' ${clase} ')]${condicionTexto}`;
}

function selTab(nombre) {
  return By.xpath(_porClaseExacta('dx-tab', `[.//span[normalize-space(.)='${nombre}']]`));
}

function selTabSeleccionado(nombre) {
  return By.xpath(_porClaseExacta('dx-tab-selected', `[.//span[normalize-space(.)='${nombre}']]`));
}

/**
 * Modal "Agregar Nuevo Candidato" (botón "Agregar" de la barra de título,
 * junto al título "Banco de candidatos" — mismo patrón que "Crear" en
 * Requisiciones/Solicitudes). Mapeo verificado con Selenium Headed
 * (`_probe-agregar-candidato.js`, HTML real volcado a disco e inspeccionado):
 *
 *  - A diferencia del panel de "Crear Solicitud" (NO es un dxPopup), este SÍ
 *    es un `dxPopup` real (`.dx-popup-wrapper`/`.dx-overlay-wrapper`,
 *    título "Agregar Nuevo Candidato") — por eso se usa el componente
 *    `Popup` del core (mismo patrón que `DocumentosRequisicionPage`), con
 *    `contiene: '[class*="AgregarCandidatoPopup"]'` para distinguirlo de
 *    cualquier otro overlay.
 *  - El formulario DENTRO del popup es un `dxForm` nativo (clase
 *    `dx-field-item`, igual convención que "Crear Solicitud" de Empleo) —
 *    `Form._campo()` ya soporta esa convención sin cambios, y busca en TODO
 *    el documento (no requiere scope propio del popup).
 *  - Campos confirmados (en orden real del formulario, hay que scrollear
 *    dentro del modal para verlos todos): Tipo ID, Identificación, Primer
 *    Nombre, Segundo Nombre, Primer Apellido, Segundo Apellido, Correo,
 *    Teléfono, Grado académico, Etiquetas, Apreciación.
 *  - "Etiquetas" es un `dx-tagbox` de texto libre (idéntico al de "Crear
 *    Solicitud" de Empleo), pero acá se declara con la estrategia
 *    `tagsLibres` (no `custom`/un solo tag): el Panel envía varias etiquetas
 *    separadas por "|" en un solo valor del Execution Context y
 *    `TagsLibresStrategy` las agrega una por una (mismo mecanismo que
 *    "Datos del puesto" en Requisiciones).
 *  - "Apreciación" NO es un control de `Form` (no tiene estrategia
 *    declarada): son 5 `<img width="25">` sueltos (sin componente
 *    DevExtreme), hijos directos del `<div>` que sigue al `<label>
 *    Apreciación:</label>` — mismo patrón exacto que las estrellas de
 *    valoración en `SolicitudEmpleoDetallePage` (estrella "llena" = `src`
 *    `data:image/...`; "vacía" = `src` a un archivo `SRH-Estrella-Empty...
 *    png`), pero con OTRO contenedor propio de este modal (no reutilizable
 *    por selector, sí por mecánica: clickear la N-ésima imagen llena 1..N).
 *  - "Importar CV" es un botón (`<div class="AgregarCandidatoPopup_
 *    importar_btn__..."><img/><label>Importar CV</label></div>`, NO un
 *    `.dx-button`/`<button>` real) que vive ARRIBA del formulario, junto a
 *    un texto que explica que carga datos del CV automáticamente. Solo
 *    mapeado acá (`SEL_AGREGAR.botonImportarCV`) — su flujo de carga de
 *    archivo no está implementado todavía (pendiente, a pedido explícito).
 */
const SEL_AGREGAR = {
  botonAgregar: By.xpath("//*[contains(@class,'dx-button')][normalize-space(.)='Agregar']"),
  popupContiene: '[class*="AgregarCandidatoPopup"]',
  // Mapeado, sin implementar todavía (ver nota de clase).
  botonImportarCV: By.xpath("//div[contains(@class,'AgregarCandidatoPopup_importar_btn')]"),
  apreciacionContenedor: By.xpath("//label[normalize-space(.)='Apreciación:']/following-sibling::div[contains(@class,'d-flex')][1]"),
  apreciacionImagen: 'img[width="25"]',
};

/**
 * Mapa CONTROL -> SELECTION STRATEGY del formulario "Agregar Nuevo
 * Candidato". Refleja "Datos de Empleado" de Solicitud de Empleo (ver
 * `SolicitudEmpleoFormPage.ESTRATEGIAS`), con "Teléfono" en vez de
 * "Celular" (nombre real y distinto acá, confirmado) y sin "Requisición"/
 * "Fecha Ingreso"/"Comentario" (no existen en este modal). "Tipo ID" e
 * "Identificación" se completan aparte (mismo orden obligatorio que
 * Solicitud de Empleo: Tipo ID define la máscara de Identificación).
 * "Apreciación" queda fuera a propósito (no es un control de Form, ver
 * `getApreciacion`/`setApreciacion`).
 */
const ESTRATEGIAS_AGREGAR = {
  'Tipo ID': 'directSelect',
  Identificación: 'text',
  'Primer Nombre': 'text',
  'Segundo Nombre': 'text',
  'Primer Apellido': 'text',
  'Segundo Apellido': 'text',
  Correo: 'text',
  Teléfono: 'text',
  'Grado académico': 'searchAndSelect',
  Etiquetas: 'tagsLibres',
};

/**
 * Envío de un candidato entre tabs ("Enviar a elegibles" / "Enviar a
 * descartados", botones de la toolbar del grid — mapeo verificado con
 * Selenium Headed, click real completado):
 *  - Requiere una fila SELECCIONADA (checkbox de la primera columna,
 *    `DataGrid.seleccionarFila`) — sin selección, el botón no hace nada útil
 *    (no se probó clickearlo sin selección: se asume requerido, mismo
 *    criterio de la app en otros grids con acciones masivas).
 *  - Dispara un popup de confirmación GENÉRICO de la app (clase
 *    `confirmPopup`/`confirmPopupContent`, reutilizado en otras pantallas,
 *    no exclusivo de Banco de candidatos): título "B. Elegibles"/
 *    "B. Descartados", pregunta "¿Desea enviar el candidato al banco de
 *    elegibles/descartados?", botones "Sí"/"No" (`aria-label` exacto).
 *  - Tras confirmar, la app muestra el notify estándar (`Notify` del core) y
 *    el candidato pasa de tab.
 */
const SEL_ENVIO = {
  botonEnviarElegibles: By.xpath("//*[@aria-label='Enviar a elegibles']"),
  botonEnviarDescartados: By.xpath("//*[@aria-label='Enviar a descartados']"),
  // `.confirmPopup` está en el WRAPPER del overlay (el mismo elemento que ya
  // matchea `Popup.POPUP_SELECTOR`); `Popup` busca `contiene` como
  // DESCENDIENTE de ese wrapper (`p.querySelector(contiene)`), así que hay
  // que apuntar a `.confirmPopupContent` (el div interno) — confirmado con
  // evidencia real: con `.confirmPopup` el popup nunca se detectaba
  // (`querySelector` no matchea el propio elemento, solo sus hijos).
  popupConfirmarContiene: '.confirmPopupContent',
};

class BancoCandidatosPage extends BasePage {
  /**
   * Acciones que, por DECISIÓN DE NEGOCIO, no crean ni transforman una entidad de flujo (ver GUIDELINES §12).
   */
  static get ACCIONES_FLUJO() {
    return [
      { metodo: 'abrirFormularioAgregar', clase: 'traslado' },
      { metodo: 'enviarAElegibles', clase: 'traslado' },
      { metodo: 'enviarADescartados', clase: 'traslado' },
    ];
  }

  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    this.popupAgregar = new Popup(driver, { contiene: SEL_AGREGAR.popupContiene });
    this.popupConfirmar = new Popup(driver, { contiene: SEL_ENVIO.popupConfirmarContiene });
  }

  static get ESTRATEGIAS_AGREGAR() {
    return ESTRATEGIAS_AGREGAR;
  }

  /**
   * Espera a que la pantalla esté REALMENTE cargada. NO alcanza con esperar
   * a que exista/sea visible un `[class*="SrhhGenericBar_title"]`: esa clase
   * es una barra de título GENÉRICA que otras pantallas de la app también
   * usan — si se llega acá justo tras navegar desde otra pantalla, la barra
   * VIEJA (con OTRO texto) puede seguir visible un instante mientras la
   * nueva todavía no montó, y esa espera se resolvía en falso (deducido por
   * revisión de código: `irATab` quedaba colgado 30s buscando las tabs, que
   * todavía no existían, tras una navegación real Requisiciones -> Banco de
   * candidatos). Por eso se espera (poll) a que el TEXTO sea exactamente
   * "Banco de candidatos", no solo la presencia del elemento.
   */
  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.driver.wait(async () => {
      const els = await this.driver.findElements(SEL.titulo);
      for (const el of els) {
        try {
          if ((await el.isDisplayed()) && (await el.getText()).trim() === 'Banco de candidatos') return true;
        } catch (e) {
          /* stale */
        }
      }
      return false;
    }, timeout);
    return this;
  }

  /** Texto real del título ("Banco de candidatos"). */
  async getTitulo() {
    return (await this.getText(SEL.titulo)).trim();
  }

  /**
   * Cambia a la tab "Elegibles" o "Descartados" y deja su listado en modo
   * lista, listo para leer (`grid.filasPorColumnas`/`buscar`/`existeFila`).
   *
   * El click NATIVO de Selenium (`el.click()`, lo que usa el `click()`
   * genérico heredado) NO dispara el cambio de tab de este widget `dx-tabs`
   * — confirmado con evidencia real: ni `el.click()` ni un click por JS
   * (`element.click()`) movían la clase `dx-tab-selected`; solo un click vía
   * la API de Actions (mueve el mouse y dispara la secuencia real de
   * eventos) lo logra. Por eso acá se usa `driver.actions()` en vez del
   * `click()` heredado.
   *
   * Espera EXPLÍCITAMENTE a que la tab quede marcada como seleccionada
   * (`dx-tab-selected`) antes de tocar el grid — confirmado con evidencia
   * real (observación manual) que sin esta espera, un `buscar()` inmediato
   * podía seguir filtrando sobre la tab ANTERIOR (ej. "Elegibles", que
   * además es donde cae toda solicitud nueva por defecto) en vez de la
   * recién clickeada.
   */
  async irATab(nombre, intentos = 3) {
    logger.info(`BancoCandidatosPage: ir a tab "${nombre}"`);
    let seleccionada = false;
    for (let intento = 1; intento <= intentos && !seleccionada; intento++) {
      try {
        const tab = await this.waitVisible(selTab(nombre), 15000);
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', tab);
        // Esperar a que la posición se estabilice (mismo criterio que
        // `Form._abrirDropdownEn`): un click de Actions API en movimiento
        // puede caer en el punto viejo si el layout todavía se está acomodando.
        let anterior = null;
        await this.driver
          .wait(async () => {
            const actual = await this.driver.executeScript((el) => {
              const r = el.getBoundingClientRect();
              return `${Math.round(r.x)},${Math.round(r.y)}`;
            }, tab);
            const estable = actual === anterior;
            anterior = actual;
            return estable;
          }, 2000)
          .catch(() => {});
        await this.driver.actions({ bridge: true }).move({ origin: tab }).click().perform();
        seleccionada = await this.driver
          .wait(until.elementLocated(selTabSeleccionado(nombre)), 8000)
          .then(() => true)
          .catch(() => false);
      } catch (e) {
        logger.info(`BancoCandidatosPage: error ubicando/clickeando la tab "${nombre}" (intento ${intento}/${intentos}): ${e.message}`);
      }
      if (!seleccionada) {
        logger.info(`BancoCandidatosPage: tab "${nombre}" no quedó seleccionada (intento ${intento}/${intentos}), reintentando`);
      }
    }
    if (!seleccionada) {
      throw new Error(`BancoCandidatosPage: no se pudo seleccionar la tab "${nombre}" tras ${intentos} intento(s).`);
    }
    await this.grid.asegurarModoLista();
    await this.grid.listo();
    return this;
  }

  /**
   * Abre el modal "Agregar Nuevo Candidato" desde el botón "Agregar" de la
   * barra de título (ver mapeo de clase). Devuelve `this` (el modal se opera
   * con los métodos de esta misma clase, igual criterio que
   * `DocumentosRequisicionPage` con su popup "Importar Documentos").
   */
  async abrirFormularioAgregar(timeout = config.timeouts.explicitWaitMs) {
    logger.info('BancoCandidatosPage: abrir modal "Agregar Nuevo Candidato"');
    const btn = await this.driver.wait(until.elementLocated(SEL_AGREGAR.botonAgregar), timeout);
    await this.driver.wait(until.elementIsVisible(btn), timeout);
    await btn.click();
    await this.popupAgregar.esperarVisible(timeout);
    return this;
  }

  /** Pone un valor con la estrategia declarada para ese control del modal "Agregar". */
  async setCampo(label, valor, extras = {}) {
    const declarado = ESTRATEGIAS_AGREGAR[label];
    const base = typeof declarado === 'string' ? { estrategia: declarado } : declarado || {};
    return this.form.setValor(label, valor, { ...base, ...extras });
  }

  /** "Tipo ID" DEBE elegirse ANTES que "Identificación": cambia su máscara (mismo comportamiento que Solicitud de Empleo). */
  async seleccionarTipoId(valor) {
    return this.setCampo('Tipo ID', valor);
  }

  /**
   * Escribe SOLO los dígitos de la identificación (la máscara agrega los
   * guiones) y espera —de forma explícita, no con sleep fijo— a que la app
   * autocomplete "Primer Nombre" si reconoce a la persona. Sin evidencia
   * todavía de que este modal autocomplete algo (a diferencia de Solicitud
   * de Empleo): se deja el mismo mecanismo TOLERANTE — si nunca ocurre, no
   * es error, se continúa con el timeout agotado (mismo criterio que
   * `SolicitudEmpleoFormPage.identificarYEsperarAutollenado`).
   */
  async identificarYEsperarAutollenado(identificacion, timeout = 3000) {
    logger.info('BancoCandidatosPage: escribir Identificación y esperar autollenado si aplica');
    await this.form.escribir('Identificación', identificacion, { clear: false });

    const hayAutollenado = await this.driver
      .wait(async () => !(await this.form.estaVacio('Primer Nombre')), timeout)
      .then(() => true)
      .catch(() => {
        logger.info('BancoCandidatosPage: sin autollenado tras Identificación');
        return false;
      });

    if (hayAutollenado) {
      let anterior = null;
      await this.driver
        .wait(async () => {
          const actual = await this.form.getValor('Primer Nombre');
          const estable = actual === anterior;
          anterior = actual;
          return estable;
        }, 2000)
        .catch(() => {});
    }
  }

  /**
   * Completa los controles declarados en `ESTRATEGIAS_AGREGAR` (salvo "Tipo
   * ID" e "Identificación", que van antes por separado) DESDE el Execution
   * Context. Mismo criterio "completar solo vacíos" que
   * `SolicitudEmpleoFormPage.completarConContexto`: si un campo ya tiene
   * datos, nunca se sobreescribe.
   *
   * @param {string} caso
   * @param {{incluirOpcionales?: boolean}} [opts]
   */
  async completarConContexto(caso, { incluirOpcionales = false } = {}) {
    logger.info(`BancoCandidatosPage: completar modal "Agregar" desde Execution Context (caso="${caso}")`);
    await this.form.validarControlesDeclarados(ESTRATEGIAS_AGREGAR, { etiqueta: 'agregar-candidato-banco' });
    const val = (label) => testContext.get(caso, label);

    const yaTratados = ['Tipo ID', 'Identificación'];
    const resultado = {};

    for (const label of Object.keys(ESTRATEGIAS_AGREGAR)) {
      if (yaTratados.includes(label)) continue;

      if (!(await this.form.estaVacio(label))) {
        logger.info(`BancoCandidatosPage: "${label}" ya tiene datos, no se sobreescribe`);
        continue;
      }

      const provisto = val(label);
      if (provisto !== undefined) {
        resultado[label] = await this.setCampo(label, provisto);
      } else if (incluirOpcionales) {
        resultado[label] = await this.setCampo(label);
      }
    }
    return resultado;
  }

  /** Cantidad de estrellas llenas actualmente (0-5) en "Apreciación" (ver mapeo de clase). */
  async getApreciacion() {
    const cont = await this.driver.findElements(SEL_AGREGAR.apreciacionContenedor);
    if (!cont.length) return 0;
    const imgs = await cont[0].findElements(By.css(SEL_AGREGAR.apreciacionImagen));
    let llenas = 0;
    for (const img of imgs) {
      const src = (await img.getAttribute('src')) || '';
      if (src.startsWith('data:')) llenas++;
    }
    return llenas;
  }

  /** Pone "Apreciación" a `n` estrellas (1-5), clickeando la N-ésima (ver mapeo de clase). */
  async setApreciacion(n) {
    const cantidad = Math.max(1, Math.min(5, Math.round(Number(n))));
    logger.info(`BancoCandidatosPage: Apreciación -> ${cantidad} estrella(s)`);
    const cont = await this.driver.wait(until.elementLocated(SEL_AGREGAR.apreciacionContenedor), config.timeouts.explicitWaitMs);
    const imgs = await cont.findElements(By.css(SEL_AGREGAR.apreciacionImagen));
    if (imgs.length !== 5) {
      throw new Error(`BancoCandidatosPage: no se encontraron las 5 estrellas de Apreciación (encontradas: ${imgs.length})`);
    }
    const estrella = imgs[cantidad - 1];
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', estrella);
    await this.driver.executeScript('arguments[0].click()', estrella);
    return cantidad;
  }

  /** Guarda el modal "Agregar Nuevo Candidato" (botón "Guardar" del popup). */
  async guardar() {
    logger.info('BancoCandidatosPage: Guardar modal "Agregar"');
    return this.popupAgregar.accionar('guardar', { etiqueta: 'Guardar' });
  }

  /** Clasifica el resultado tras Guardar según el notify (mismo mecanismo que el resto del framework). */
  async resultadoGuardado(timeoutMs = config.timeouts.explicitWaitMs) {
    const texto = await this.notify.esperarTexto(timeoutMs);
    return Notify.clasificar(texto);
  }

  /**
   * Selecciona (checkbox) al candidato `nombre` en la tab ACTUAL (o el
   * primero si no se indica nombre) y lo envía al otro banco: "elegibles" o
   * "descartados". Confirma el popup ("Sí") y espera el notify. Debe estar
   * ya en la tab de ORIGEN correcta antes de llamar (`irATab`): "Descartados"
   * para enviar a elegibles, "Elegibles" para enviar a descartados.
   *
   * @param {'elegibles'|'descartados'} destino
   * @param {string} [nombre]
   */
  async enviarA(destino, nombre) {
    const boton = destino === 'elegibles' ? SEL_ENVIO.botonEnviarElegibles : SEL_ENVIO.botonEnviarDescartados;
    logger.info(`BancoCandidatosPage: enviar a "${destino}" -> ${nombre ? `"${nombre}"` : '(primera fila)'}`);

    const seleccionado = await this.grid.seleccionarFila(nombre);
    if (!seleccionado) {
      throw new Error(
        `BancoCandidatosPage: no se encontró ${nombre ? `el candidato "${nombre}"` : 'ninguna fila'} para enviar a "${destino}".`
      );
    }

    const btn = await this.driver.wait(until.elementLocated(boton), config.timeouts.explicitWaitMs);
    await this.driver.wait(until.elementIsVisible(btn), config.timeouts.explicitWaitMs);
    await this.driver.executeScript('arguments[0].click()', btn);

    await this.popupConfirmar.esperarVisible();
    const accion = await this.popupConfirmar.accionar('sí', { etiqueta: 'Sí' });
    if (!accion.encontrado || accion.deshabilitado) {
      throw new Error(`BancoCandidatosPage: no se pudo confirmar el envío a "${destino}" (popup: ${JSON.stringify(accion)}).`);
    }
    await this.popupConfirmar.esperarCerrado();

    return this.resultadoGuardado();
  }

  /** Envía al candidato (seleccionado por checkbox) de "Descartados" a "Elegibles". */
  async enviarAElegibles(nombre) {
    return this.enviarA('elegibles', nombre);
  }

  /** Envía al candidato (seleccionado por checkbox) de "Elegibles" a "Descartados". */
  async enviarADescartados(nombre) {
    return this.enviarA('descartados', nombre);
  }
}

module.exports = BancoCandidatosPage;
