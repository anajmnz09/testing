const { By, Key, until } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');
const config = require('../config');
const { containsTextoIgnoreCase } = require('../utils/xpath');

/**
 * Componente del DataGrid de DevExtreme. Es el widget que MÁS se repite en la
 * app (Reclutamiento, Empleados, Vacantes, Nómina… todos listan datos en este
 * grid), así que encapsularlo una vez evita reescribir buscar/paginar/etc. en
 * cada módulo.
 *
 * Selectores verificados en el grid real de Requisiciones (DevExtreme):
 *  - búsqueda: input[placeholder="Buscar"] (filtra en vivo al tipear)
 *  - filas: tr.dx-data-row (sin duplicación; la tabla es única aunque tenga
 *    la clase -fixed)
 *  - paginación: .dx-page[aria-label="Page N"], .dx-next-button, .dx-prev-button,
 *    tamaño de página .dx-page-size, info en .dx-info
 */
class DataGrid extends BaseComponent {
  /**
   * @param driver
   * @param {object} [opts]
   * @param {string} [opts.contenedor]  selector CSS de un contenedor PROPIO que
   *   delimita a ESTE grid en pantallas con MÁS DE UN `.dx-datagrid` montado a
   *   la vez (ej. Nómina: el grid de arriba en CardView/ListView + "Empleados
   *   de Nuevo Ingreso", ambos visibles juntos — sin esto, cualquier método
   *   que recorra "el primer/único `.dx-datagrid`" puede operar el grid
   *   equivocado). Opcional y retrocompatible: sin `contenedor`, el
   *   comportamiento es IDÉNTICO al de siempre (busca en todo el documento).
   */
  constructor(driver, { contenedor = null } = {}) {
    super(driver);

    this.contenedor = contenedor;
    const conAmbito = (selectorHijo) => (contenedor ? `${contenedor} ${selectorHijo}` : selectorHijo);

    // Con `contenedor`, el contenedor PROPIO delimita la espera de "grid
    // visible" (ver `listo()`): puede ser el `.dx-datagrid` mismo o un
    // wrapper que lo contiene, cualquiera de los dos sirve para esperar
    // visibilidad/loader. El resto de los selectores sí necesita el
    // combinador descendiente (`.dx-header-row`, `.dx-data-row`, etc. viven
    // SIEMPRE anidados varios niveles adentro del `.dx-datagrid`).
    this.grid = By.css(contenedor || '.dx-datagrid');
    this.searchInput = By.css(conAmbito('input[placeholder="Buscar"]'));
    this.dataRow = By.css(conAmbito('.dx-data-row'));
    this.info = By.css(conAmbito('.dx-info'));
    this.nextPageButton = By.css(conAmbito('.dx-next-button'));
    this.prevPageButton = By.css(conAmbito('.dx-prev-button'));
    // Botones de la toolbar (DevExtreme no expone id/testid: se ubican por texto)
    this.createButton = By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Crear']");
    this.filterButton = By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Filtro']");
  }

  /**
   * Como `waitVisible`, pero tolerante a que `locator` matchee VARIOS
   * elementos a la vez en el DOM y solo uno esté visible — confirmado con
   * evidencia real: pantallas con más de un `.dx-datagrid`/buscador montado
   * simultáneamente (ej. "Banco de candidatos", un grid POR TAB, uno oculto).
   * `waitVisible` normal ubica el PRIMERO en orden de DOM y espera a que ESE
   * puntual sea visible — si el primero no es el visible, cuelga el timeout
   * completo aunque otro match sí lo esté. Acá se hace poll sobre TODOS los
   * matches hasta que alguno esté visible.
   */
  async _primerVisible(locator, timeout = config.timeouts.explicitWaitMs) {
    let encontrado = null;
    await this.driver.wait(async () => {
      const els = await this.driver.findElements(locator);
      for (const el of els) {
        try {
          if (await el.isDisplayed()) {
            encontrado = el;
            return true;
          }
        } catch (e) {
          /* stale */
        }
      }
      return false;
    }, timeout);
    return encontrado;
  }

  /**
   * Espera a que el grid esté visible Y que termine de cargar sus datos
   * (devuelve el componente, encadenable). El contenedor `.dx-datagrid` se
   * monta ANTES de poblarse — sin esperar el loader, una lectura inmediata de
   * `filasPorColumnas()` podía devolver 0 filas aunque el grid sí tuviera
   * datos (confirmado: listado de Empleados recién abierto vía navbar).
   */
  async listo() {
    await this._primerVisible(this.grid);
    await this.esperarSinLoader();
    return this;
  }

  /**
   * Algunos listados (verificado: Empleados) alternan entre "Modo tarjeta"
   * (vista por defecto, tarjetas — este componente NO la puede leer) y "Modo
   * lista" (un `.dx-datagrid` real, sí legible con `filasPorColumnas`/
   * `buscar`/`existeFila`) mediante 2 íconos junto al buscador,
   * identificables por su atributo `title` exacto. Tolerante: si el listado
   * no tiene ese toggle (la mayoría no lo tiene, ya están en modo lista/tabla
   * de por sí), no hace nada y no falla.
   */
  async asegurarModoLista() {
    const selector = this.contenedor ? `${this.contenedor} [title="Modo lista"]` : '[title="Modo lista"]';
    const botones = await this.driver.findElements(By.css(selector));
    for (const b of botones) {
      if (await b.isDisplayed().catch(() => false)) {
        logger.info('DataGrid: cambiar a "Modo lista"');
        await this.driver.executeScript('arguments[0].click()', b);
        await this.listo();
        return true;
      }
    }
    return false;
  }

  /** Localizador de una fila que contenga `texto` en alguna celda. */
  _filaLocator(texto) {
    return By.xpath(
      `//tr[contains(@class,'dx-data-row')][.//td[${containsTextoIgnoreCase(texto)}]]`
    );
  }

  /**
   * Escribe en el buscador (el grid filtra en vivo). Usa `_primerVisible`
   * (no `waitVisible`): mismo motivo que en `listo()` — puede haber más de
   * un `input[placeholder="Buscar"]` montado a la vez (uno por tab).
   */
  async buscar(texto) {
    logger.info(`DataGrid: buscar "${texto}"`);
    const input = await this._primerVisible(this.searchInput);
    await input.clear();
    await input.sendKeys(texto, Key.ENTER);
  }

  /**
   * True si existe una fila que contenga `texto`. Poll con timeout (maneja el
   * filtrado asíncrono del grid); devuelve false si no aparece en el tiempo dado
   * en vez de lanzar excepción.
   */
  async existeFila(texto, timeout = config.timeouts.explicitWaitMs) {
    try {
      await this.driver.wait(until.elementLocated(this._filaLocator(texto)), timeout);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Hace click en la fila que contenga `texto`. */
  async clickFila(texto) {
    logger.info(`DataGrid: click en fila "${texto}"`);
    await this.click(this._filaLocator(texto));
  }

  /**
   * Selecciona (checkbox) la fila que contiene `texto`, o la PRIMERA fila real
   * del grid si no se pasa `texto`. El checkbox de selección (columna
   * `dx-command-select`) está oculto por CSS hasta que se interactúa con la
   * fila — confirmado con evidencia real: el ícono `.dx-checkbox` en sí tiene
   * `display:none`, pero su CELDA contenedora (`td.dx-command-select`,
   * `aria-label="Seleccionar fila"`) sí es interactiva y dispara la selección
   * al clickearla (un click nativo sobre el ícono oculto tira
   * `element not interactable`). Mismo criterio de grid VISIBLE que
   * `filasPorColumnas` (puede haber más de un `.dx-datagrid` montado, uno por
   * tab, ej. "Banco de candidatos").
   * @returns {Promise<boolean>} true si encontró y clickeó la fila.
   */
  async seleccionarFila(texto) {
    logger.info(`DataGrid: seleccionar fila ${texto ? `"${texto}"` : '(primera)'}`);
    const marcado = await this.driver.executeScript((buscado, contenedorSel) => {
      const esVisible = (el) => {
        const estilo = window.getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || parseFloat(estilo.opacity) === 0) {
          return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // Con `contenedor`, el grid a operar es EXACTAMENTE el de ese ámbito (el
      // elemento mismo si ya es `.dx-datagrid`, o el que contiene adentro) —
      // nunca "el primer `.dx-datagrid` visible del documento", que en una
      // pantalla con más de uno (ej. Nómina) puede ser el grid equivocado.
      const raiz = contenedorSel ? document.querySelector(contenedorSel) : document;
      if (!raiz) return false;
      const grid = contenedorSel
        ? raiz.matches('.dx-datagrid')
          ? raiz
          : raiz.querySelector('.dx-datagrid') || raiz
        : Array.from(raiz.querySelectorAll('.dx-datagrid')).find(esVisible);
      if (!grid) return false;
      const filas = Array.from(grid.querySelectorAll('.dx-data-row'));
      const fila = buscado ? filas.find((f) => (f.textContent || '').includes(buscado)) : filas[0];
      if (!fila) return false;
      const celda = fila.querySelector('.dx-command-select');
      if (!celda) return false;
      const prev = document.querySelector('[data-qa="seleccionar-fila"]');
      if (prev) prev.removeAttribute('data-qa');
      celda.setAttribute('data-qa', 'seleccionar-fila');
      return true;
    }, texto || null, this.contenedor);

    if (!marcado) return false;
    const celda = await this.driver.findElement(By.css('[data-qa="seleccionar-fila"]'));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', celda);
    await celda.click();
    return true;
  }

  /**
   * Cantidad de filas visibles en la página actual del grid — CON POLL.
   *
   * `.dx-datagrid` se monta y el overlay de carga (`esperarSinLoader`, ya
   * esperado por `listo()`) puede desaparecer ANTES de que el grid termine de
   * insertar sus `.dx-data-row` — confirmado con evidencia real (Empleados,
   * 2026-09-03): refrescando la MISMA pantalla con datos reales sin tocar
   * nada, lecturas consecutivas de esta función alternaron 0/50/0/50/50, y
   * una lectura en 0 se corrigió sola 1-2s después sin ninguna acción
   * adicional. Una lectura única (como era antes) no puede distinguir "el
   * grid no tiene registros" de "el grid todavía no terminó de renderizar" —
   * cualquier código que decida "no hay datos" a partir de una lectura en 0
   * heredaba ese falso negativo. Reintenta hasta `timeout` antes de aceptar 0
   * como resultado confirmado; si ya hay filas, devuelve de inmediato (sin
   * demora agregada para el caso con datos).
   */
  async contarFilas(timeout = config.timeouts.explicitWaitMs) {
    const fin = Date.now() + timeout;
    let cantidad = 0;
    do {
      cantidad = (await this.driver.findElements(this.dataRow)).length;
      if (cantidad > 0) return cantidad;
      await this.driver.sleep(300);
    } while (Date.now() < fin);
    return cantidad;
  }

  /**
   * Lee TODAS las filas visibles del grid, indexadas por el nombre REAL de
   * cada columna del header (ej. `{Código:"1815", Etapa:"...", Estado:"..."}`).
   * Reutilizable por cualquier caso que necesite verificar/filtrar datos de
   * una fila SIN abrir el detalle (muchos listados del módulo ya exponen
   * columnas de estado/etapa/etc. directamente en el grid).
   *
   * Encabezados y filas se leen DENTRO del `.dx-datagrid` VISIBLE (no de
   * `document` entero): confirmado con evidencia real que una pantalla puede
   * tener MÁS DE UN `.dx-datagrid` montado a la vez aunque solo uno esté
   * visible (ej. "Banco de candidatos", un grid por tab "Elegibles"/
   * "Descartados") — sin este scope, los headers de ambos grids se
   * mezclaban y el mapeo header->celda quedaba desalineado (una columna
   * real, ej. "Nombre", terminaba `undefined`).
   *
   * La visibilidad se determina con estilo computado (`display`/`visibility`/
   * `opacity` + tamaño real), NO con `offsetParent !== null`: confirmado con
   * evidencia real que ese chequeo detecta `display:none` pero NO
   * `visibility:hidden` — un tab inactivo del TabPanel oculto así seguía
   * "encontrado" como si fuera el visible (la búsqueda en pantalla filtraba
   * bien, en el tab correcto, pero esta función seguía leyendo el grid
   * equivocado y nunca encontraba la fila ya filtrada).
   */
  async _leerFilasPorColumnasDom() {
    return this.driver.executeScript((contenedorSel) => {
      const norm = (e) => (e && e.textContent || '').replace(/\s+/g, ' ').trim();
      const esVisible = (el) => {
        const estilo = window.getComputedStyle(el);
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || parseFloat(estilo.opacity) === 0) {
          return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // Mismo criterio que `seleccionarFila`: con `contenedor`, SIEMPRE ese
      // grid puntual — nunca "el primer visible del documento".
      const raiz = contenedorSel ? document.querySelector(contenedorSel) : document;
      if (!raiz) return [];
      const grid = contenedorSel
        ? raiz.matches('.dx-datagrid')
          ? raiz
          : raiz.querySelector('.dx-datagrid') || raiz
        : Array.from(raiz.querySelectorAll('.dx-datagrid')).find(esVisible);
      if (!grid) return [];
      const headers = Array.from(
        grid.querySelectorAll('.dx-datagrid-headers .dx-header-row td, .dx-datagrid-headers .dx-header-row th')
      ).map(norm);
      return Array.from(grid.querySelectorAll('.dx-data-row')).map((fila) => {
        const celdas = Array.from(fila.querySelectorAll('td')).map(norm);
        const resultado = {};
        headers.forEach((h, i) => {
          if (h) resultado[h] = celdas[i];
        });
        return resultado;
      });
    }, this.contenedor);
  }

  /**
   * Como antes, pero CON POLL — mismo motivo/evidencia que `contarFilas`
   * (ver su docblock): una sola lectura no distingue "sin registros" de
   * "todavía no terminó de renderizar". Reintenta hasta `timeout` antes de
   * aceptar `[]` como resultado confirmado; si ya hay filas, devuelve de
   * inmediato.
   */
  async filasPorColumnas(timeout = config.timeouts.explicitWaitMs) {
    const fin = Date.now() + timeout;
    let filas = [];
    do {
      filas = await this._leerFilasPorColumnasDom();
      if (filas.length > 0) return filas;
      await this.driver.sleep(300);
    } while (Date.now() < fin);
    return filas;
  }

  /**
   * Repite `buscar(textoBuscar)` + `filasPorColumnas()` hasta que alguna fila
   * cumpla `predicado`, o se agote `timeout`. Pensado para datos que tardan
   * en propagarse ENTRE módulos (confirmado con evidencia real: un empleado
   * recién creado desde una Solicitud de Empleo no aparece de inmediato en el
   * listado de Empleados — ni el registro ni el filtro lo reflejan al toque).
   * Sin este poll, una sola lectura inmediata podía dar falso negativo.
   * Devuelve la fila encontrada o `null` si nunca apareció.
   */
  async esperarFila(textoBuscar, predicado, timeout = 60000, intervalo = 2000) {
    const fin = Date.now() + timeout;
    do {
      await this.buscar(textoBuscar);
      const filas = await this.filasPorColumnas();
      const encontrada = filas.find(predicado);
      if (encontrada) return encontrada;
      await this.driver.sleep(intervalo);
    } while (Date.now() < fin);
    return null;
  }

  /**
   * Como `esperarFila`, pero SIN pasar por el buscador global (`buscar()`):
   * escanea directamente las filas de la página actual (`filasPorColumnas()`)
   * contra `predicado`, sin filtrar nada en la UI.
   *
   * Usar cuando el buscador global de DevExtreme NO indexa la columna que hace
   * falta consultar — confirmado con evidencia real en al menos 2 grids: la
   * columna "Concepto" de Comportamiento concepto Nómina (tipo catálogo/lookup;
   * `buscar()` devuelve 0 filas aunque el registro exista y sea visible sin
   * filtrar — `aria-rowcount="0"` real, no un problema de lectura de Selenium)
   * y "No. Cuenta Contable" de Cuentas Contables (el buscador global solo
   * indexa "Descripción"). El síntoma es idéntico en ambos casos: `esperarFila`
   * da un falso negativo ("no existe") sobre un registro que SÍ está, lo que
   * hace que un caso "crear" idempotente reintente crear un duplicado y la app
   * lo rechace.
   *
   * Solo confiable en grids ACOTADOS (fixtures QA, no todo el dataset de
   * producción): lee la página actual tal cual está, no pagina para buscar en
   * todo el listado ni cambia el tamaño de página.
   */
  async esperarFilaSinFiltro(predicado, timeout = 60000, intervalo = 2000) {
    const fin = Date.now() + timeout;
    do {
      const filas = await this.filasPorColumnas();
      const encontrada = filas.find(predicado);
      if (encontrada) return encontrada;
      await this.driver.sleep(intervalo);
    } while (Date.now() < fin);
    return null;
  }

  /**
   * Como `filasPorColumnas`, pero devuelve solo la fila que contiene `texto`
   * en alguna celda (o `null` si no hay ninguna).
   */
  async leerFilaPorColumnas(texto) {
    const filas = await this.filasPorColumnas();
    return filas.find((f) => Object.values(f).some((v) => v && v.includes(texto))) || null;
  }

  /** Abre el formulario de creación (botón Crear). */
  async crear() {
    logger.info('DataGrid: click en Crear');
    await this.click(this.createButton);
  }

  /** Abre el panel de filtros (botón Filtro). */
  async abrirFiltro() {
    logger.info('DataGrid: abrir Filtro');
    await this.click(this.filterButton);
  }

  /**
   * Filtra el grid por el VALOR de una columna usando la FILA DE FILTROS de
   * DevExtreme (la que aparece bajo los encabezados). Genérico para los DOS
   * widgets reales que esa fila usa según el tipo de columna:
   *  - `selectbox` (columnas categóricas, ej. `Estado` = `Autorizada` |
   *    `Cerrada` | `Pausada`…): abre el dropdown y clickea la opción EXACTA.
   *    Verificado en el grid real de Requisiciones.
   *  - `texto` (columnas libres/identificadoras, ej. `Código`): escribe el
   *    valor en el input de la celda y confirma con ENTER. Confirmado con
   *    evidencia real (Nómina, "Empleados de Nuevo Ingreso"): la celda de
   *    filtro de `Código` NO es un `.dx-selectbox` sino un editor de texto
   *    con menú de operador (`dx-filter-menu`) — con el criterio anterior
   *    (solo selectbox) esta columna nunca se encontraba.
   * Se detecta el tipo en vivo por celda, así que un mismo llamado sirve para
   * cualquier columna sin que el Page Object tenga que saber de antemano qué
   * widget usa. Se localiza por el TEXTO del encabezado (no por índice fijo),
   * así no se acopla al orden de columnas —configurable por el usuario—.
   */
  async filtrarPorColumna(nombreColumna, valor, timeout = config.timeouts.explicitWaitMs) {
    logger.info(`DataGrid: filtrar por columna "${nombreColumna}" = "${valor}"`);

    // 1) Marcar la celda de filtro de esa columna (por índice del encabezado)
    // y detectar su tipo de widget (selectbox/texto). CON POLL (no una sola
    // lectura): mismo motivo/evidencia que `contarFilas`/`filasPorColumnas`
    // — el contenedor del grid puede estar visible y sin loader (ya esperado
    // por `listo()`) ANTES de que DevExtreme termine de insertar sus
    // `.dx-header-row`/`.dx-datagrid-filter-row`. Confirmado con evidencia
    // real (Nómina, justo tras `irAEmpleadosNuevoIngreso()`): una lectura
    // única fallaba con "no se encontró el filtro de la columna" aunque la
    // columna existiera (verificado aparte, con un poco más de margen, que
    // sí estaba ahí un instante después).
    let resultado = { encontrado: false, tipo: null };
    await this.driver
      .wait(async () => {
        resultado = await this.driver.executeScript((col, contenedorSel) => {
          const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
          // Mismo criterio que `seleccionarFila`/`_leerFilasPorColumnasDom`: con
          // `contenedor`, SIEMPRE ese grid puntual (nunca "el primer
          // `.dx-datagrid` del documento", que en una pantalla con más de uno
          // puede ser otro grid).
          const raiz = contenedorSel ? document.querySelector(contenedorSel) : document;
          const grid = raiz && contenedorSel
            ? (raiz.matches('.dx-datagrid') ? raiz : raiz.querySelector('.dx-datagrid') || raiz)
            : raiz && raiz.querySelector('.dx-datagrid');
          if (!grid) return { encontrado: false, tipo: null };
          // Combinador DESCENDIENTE (no `>` directo), mismo criterio que
          // `_leerFilasPorColumnasDom`: confirmado con evidencia real (Nómina,
          // "Empleados de Nuevo Ingreso") que el `td` de cada columna NO
          // siempre es hijo DIRECTO de `.dx-header-row`.
          const headers = Array.from(
            grid.querySelectorAll('.dx-datagrid-headers .dx-header-row td, .dx-datagrid-headers .dx-header-row th')
          );
          const idx = headers.findIndex((td) => norm(td.textContent) === norm(col));
          if (idx < 0) return { encontrado: false, tipo: null };
          const filterRow = grid.querySelector('.dx-datagrid-filter-row');
          if (!filterRow) return { encontrado: false, tipo: null };
          const cell = filterRow.querySelectorAll('td')[idx];
          if (!cell) return { encontrado: false, tipo: null };

          const marcar = (el, tipo) => {
            const prev = document.querySelector('[data-qa="filtro-col"]');
            if (prev) prev.removeAttribute('data-qa');
            el.setAttribute('data-qa', 'filtro-col');
            return { encontrado: true, tipo };
          };
          const sb = cell.querySelector('.dx-selectbox, .dx-dropdowneditor');
          if (sb) return marcar(sb, 'selectbox');
          const input = cell.querySelector('.dx-texteditor-input');
          if (input) return marcar(cell, 'texto');
          return { encontrado: false, tipo: null };
        }, nombreColumna, this.contenedor);
        return resultado.encontrado;
      }, timeout)
      .catch(() => {});

    if (!resultado.encontrado) {
      throw new Error(`DataGrid: no se encontró el filtro de la columna "${nombreColumna}"`);
    }

    if (resultado.tipo === 'texto') {
      // Filtro de TEXTO LIBRE: escribir el valor en el input de la celda y
      // confirmar con ENTER (mismo mecanismo que el buscador global
      // `buscar()`, acotado a esta columna puntual).
      const celda = await this.driver.findElement(By.css('[data-qa="filtro-col"]'));
      // Ctrl+A + escribir, NO `.clear()`: mismo criterio que el resto del
      // framework para editores DevExtreme controlados (ej.
      // `SearchAndSelectStrategy`) — `.clear()` nativo de Selenium puede
      // vaciar el input visualmente sin sincronizar el estado interno del
      // widget, dejando el filtro "pegado" al valor anterior (confirmado con
      // evidencia real: re-filtrar por el MISMO valor tras una asignación no
      // refrescaba el conteo de filas, como si el filtro nunca se reaplicara).
      const input = await celda.findElement(By.css('.dx-texteditor-input'));
      await input.sendKeys(Key.chord(Key.CONTROL, 'a'), String(valor), Key.ENTER);
      await this._esperarSinLoaderDelGrid(timeout);
      logger.info(`DataGrid: filtro de texto aplicado "${nombreColumna}" = "${valor}"`);
      return this;
    }

    // tipo === 'selectbox': comportamiento ya verificado, sin cambios.
    // 2) Abrir el dropdown (click por JS: la fila de filtros es sticky en el header).
    const sb = await this.driver.findElement(By.css('[data-qa="filtro-col"]'));
    const boton = await sb.findElement(By.css('.dx-dropdowneditor-button, .dx-texteditor-input'));
    await this.driver.executeScript('arguments[0].click()', boton);

    // 3) Esperar la lista y clickear el item cuyo texto es EXACTAMENTE `valor`
    //    (exacto para no confundir estados que se contienen entre sí).
    //    Se usa la API de ACCIONES (mover + click) y no un click nativo/JS:
    //    verificado en el grid real, el selectbox de la fila de filtros solo
    //    commitea el valor —y dispara el filtrado del grid— ante eventos de
    //    puntero reales; un element.click()/JS click deja el dropdown abierto.
    const item = await this.driver.wait(async () => {
      const items = await this.driver.findElements(By.css('.dx-list-item, .dx-overlay-content .dx-item'));
      for (const it of items) {
        try {
          if ((await it.isDisplayed()) && (await it.getText()).trim() === valor) return it;
        } catch (e) {
          /* stale */
        }
      }
      return false;
    }, timeout);
    await this.driver.actions({ bridge: true }).move({ origin: item }).click().perform();

    // 4) Esperar a que el grid re-filtre (overlay de carga fuera).
    await this._esperarSinLoaderDelGrid(timeout);
    logger.info(`DataGrid: filtro aplicado "${nombreColumna}" = "${valor}"`);
    return this;
  }

  /**
   * Como `esperarSinLoader` (UiContext), pero ACOTADO a `this.contenedor`
   * cuando está definido, en vez de buscar en TODA la página. Confirmado con
   * evidencia real (Nómina, tras filtrar "Empleados de Nuevo Ingreso" por
   * "Código"): el filtro de ESTE grid aplicaba al instante, pero
   * `esperarSinLoader()` sin acotar agotaba igual el timeout completo —
   * esperando un loader de OTRO widget de la misma pantalla (hay más de un
   * `.dx-datagrid`/overlay montado a la vez), irrelevante para saber si
   * ESTE grid ya terminó de refiltrar. Sin `contenedor`, se comporta IGUAL
   * que `esperarSinLoader` (retrocompatible).
   */
  async _esperarSinLoaderDelGrid(timeout = config.timeouts.explicitWaitMs) {
    if (!this.contenedor) return this.esperarSinLoader(timeout);
    const selector = `${this.contenedor} [class*="loader_manager"], ${this.contenedor} [class*="loader-manager"]`;
    await this.driver.wait(async () => {
      const loaders = await this.driver.findElements(By.css(selector));
      for (const l of loaders) {
        try {
          if (await l.isDisplayed()) return false;
        } catch (e) {
          /* stale = ya no está */
        }
      }
      return true;
    }, timeout);
    return this;
  }

  /** Va a la página N (paginación numerada). */
  async irAPagina(n) {
    logger.info(`DataGrid: ir a página ${n}`);
    await this.click(By.css(`.dx-page[aria-label="Page ${n}"]`));
  }

  async paginaSiguiente() {
    logger.info('DataGrid: página siguiente');
    await this.click(this.nextPageButton);
  }

  async paginaAnterior() {
    logger.info('DataGrid: página anterior');
    await this.click(this.prevPageButton);
  }

  /** Texto del pie de paginación (ej. "Página #1. Cantidad de páginas: 3 (46 Registros)"). */
  async getInfoPaginacion() {
    return (await this.getText(this.info)).trim();
  }
}

module.exports = DataGrid;
