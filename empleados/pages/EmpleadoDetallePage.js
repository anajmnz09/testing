const { By, Key } = require('selenium-webdriver');
const { BasePage, Notify, textoIgual } = require('@triple/core');
const DataGrid = require('@triple/core/components/DataGrid');
const Popup = require('@triple/core/components/Popup');
const config = require('@triple/core/config');
const EmpleadoFormPage = require('./EmpleadoFormPage');
const CapacitacionFormPage = require('./CapacitacionFormPage');
const CapacitacionAdjuntosPage = require('./CapacitacionAdjuntosPage');
const DependienteFormPage = require('./DependienteFormPage');

/**
 * "Resumen/CV" > "Educación y experiencia": el select "Tipo" condiciona el
 * LABEL del segundo campo — confirmado con Selenium real, mismo widget,
 * mismo orden de controles, solo cambia el texto: Tipo="Educación" ->
 * "Nombre programa educativo:"; Tipo="Experiencia" -> "Puesto:". No es un
 * campo genérico "Nombre/Puesto": son dos preguntas de negocio distintas
 * (título del programa educativo vs. cargo ocupado), por eso
 * `agregarEducacionOExperiencia` recibe el tipo explícito y resuelve el
 * label real internamente en vez de exponer un parámetro ambiguo.
 */
const LABEL_SEGUNDO_CAMPO_EDUCACION_EXPERIENCIA = {
  Educación: 'Nombre programa educativo',
  Experiencia: 'Puesto',
};

/**
 * Mapa COMPLETO del sidemenu de secciones CONSULTABLES del panel de detalle
 * de Empleado (visible en modo SOLO CONSULTA, sin necesidad de entrar a
 * "Editar" — confirmado con Selenium real: el sidemenu completo ya está ahí
 * apenas se abre el detalle). Cada valor es la CADENA de acordeones padre a
 * expandir en orden ANTES del click final (`[]` = ítem de nivel superior,
 * click directo).
 *
 * Correcciones reales (2026-09-02), no asumidas por proximidad/orden visual:
 *  - "Acciones" es un ítem de nivel superior INDEPENDIENTE, no un sub-ítem
 *    de "Recursos humanos" — aunque aparece justo después de "Centro de
 *    Costo" en el texto plano del sidemenu, la clase DOM (`subitem_wrapper`
 *    presente/ausente) confirma que NO está anidado.
 *  - "Dynamics 365" NO es una sección consultable: es OTRO acordeón (clases
 *    `with_subitems`/`has_children` confirmadas) cuyo único hijo real es
 *    "Dimensiones financieras" — anidamiento de DOS niveles bajo
 *    "Interfaces". Clickearlo solo expande, no navega a ningún contenido;
 *    por eso no tiene entrada propia acá (no es una sección para testear).
 */
const SECCIONES = {
  'Datos básicos': [],
  'Resumen/CV': [],
  'Datos personales': [],
  Capacitación: [],
  Dependientes: [],
  Amonestaciones: [],
  Herramientas: [],
  Ausencias: [],
  Acciones: [],
  'Datos básicos RH': ['Recursos humanos'],
  'Paquete salarial': ['Recursos humanos'],
  Beneficios: ['Recursos humanos'],
  Préstamos: ['Recursos humanos'],
  Seguros: ['Recursos humanos'],
  'Centro de Costo': ['Recursos humanos'],
  'Análisis médicos': ['Documentos'],
  Contratos: ['Documentos'],
  'Otros Documentos': ['Documentos'],
  Cartas: ['Documentos'],
  'Cartas Pendientes': ['Documentos'],
  'Dimensiones financieras': ['Interfaces', 'Dynamics 365'],
};

/**
 * Panel de detalle de UN empleado (Empleados > doble-click en una fila del
 * listado, en "Modo lista").
 *
 * A diferencia de Requisición/Configuración, este detalle abre como panel
 * LATERAL (sidebar) superpuesto al listado, NO como navegación de página
 * completa — confirmado con evidencia real: el título principal del navbar
 * (`SRHHNavBar.tituloSeccion`, el mismo XPath que usa esa clase) no cambia
 * al abrirlo, y el listado sigue de fondo. El nombre del registro se lee del
 * propio header del panel ("Empleado <Nombre completo>"), no de un
 * `<label>` como en Requisición ("Nombre de requisición") ni de un
 * `data-dx_placeholder` como en Grupo Editar — cada pantalla tiene su propia
 * convención, no se asume.
 */
class EmpleadoDetallePage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). Las subentidades del empleado son entidades de flujo propias (no se
   * mezclan con el empleado): el formulario hijo confirma capacitación/dependiente al guardar; educación, experiencia
   * y habilidad persisten dentro del propio método (Educación y Experiencia comparten método y se distinguen por su
   * primer argumento literal).
   * Lo lee el escáner estático y la capa común de publicación; en ejecución individual no se usa.
   */
  static get ENTIDAD_FLUJO() {
    return [
      {
        tipo: 'capacitacion',
        referencia: 'nombre',
        metodos: ['abrirAdjuntarCapacitacion'],
        creadores: ['abrirAgregarCapacitacion'],
        editores: ['abrirEditarCapacitacion'],
        eliminadores: ['eliminarCapacitacion'],
      },
      { tipo: 'dependiente', referencia: 'identificacion', metodos: [], creadores: ['abrirAgregarDependiente'] },
      {
        tipo: 'educacion',
        referencia: 'nombre',
        metodos: [],
        creadores: [{ metodo: 'agregarEducacionOExperiencia', argumento: 0, valor: 'Educación', persiste: true, referenciaArg: '1.nombreOPuesto' }],
      },
      {
        tipo: 'experiencia',
        referencia: 'nombre',
        metodos: [],
        creadores: [{ metodo: 'agregarEducacionOExperiencia', argumento: 0, valor: 'Experiencia', persiste: true, referenciaArg: '1.nombreOPuesto' }],
      },
      {
        tipo: 'habilidad',
        referencia: 'habilidad',
        metodos: [],
        creadores: [{ metodo: 'agregarHabilidad', persiste: true, referenciaArg: '0.habilidad' }],
      },
    ];
  }

  constructor(driver) {
    super(driver);
    // Confirma "detalle cargado": mismo locator genérico que usa
    // Configuración (`forms-header`) — presente también acá, verificado con
    // Selenium real (contenido: "EmpleadoDatos básicosEditar").
    this.headerCargado = By.css('[class*="forms-header"]');
    // Header propio del panel lateral, texto "Empleado <Nombre completo>".
    // Selector por fragmento de clase (no la clase completa, que trae un
    // hash de build inestable, ej. `..._NO_TITLE__qp2-9`).
    this.headerSidebar = By.css('[class*="sidebar_menu_header" i]');
    this.notify = new Notify(driver);
  }

  static get SECCIONES() {
    return SECCIONES;
  }

  async estaCargado() {
    await this.waitVisible(this.headerCargado);
    return this;
  }

  /** Nombre completo del empleado, leído del header del panel lateral ("Empleado <nombre>"). */
  async getNombre() {
    const texto = (await this.getText(this.headerSidebar)).trim();
    return texto.replace(/^Empleado\s+/i, '').trim();
  }

  /**
   * Entra en modo edición ("Editar" del panel de consulta). A diferencia de
   * la consulta (panel lateral superpuesto al listado), Editar NAVEGA a una
   * pantalla PROPIA (cambia de URL, confirmado con Selenium real) — el
   * MISMO componente que "Crear Empleado" (mismo sidemenu completo, mismos
   * campos, mismo Guardar/Descartar), pero pre-cargado con los valores
   * actuales del registro. Devuelve una `EmpleadoFormPage` ya cargada.
   */
  async editar() {
    // Confirmado con Selenium real: en el instante en que `abrirPrimero()`/
    // `abrirSeccion()` resuelve, la sección todavía puede tener HASTA 3
    // loaders visibles (la carga de datos propia de la sección, DISTINTA del
    // loader de navegación que `esperarSinLoader` ya esperó antes) — el
    // toolbar que contiene "Editar" (`record-name-and-main-btns`) puede
    // seguir reacomodándose mientras tanto, y un click calculado sobre esa
    // posición ANTES de que se estabilice cae en otro elemento del mismo
    // toolbar (`ElementClickInterceptedError` real, reproducido). Esperar acá
    // a que esos loaders desaparezcan antes de ubicar/clickear "Editar".
    await this.esperarSinLoader().catch(() => {});

    // Tras `abrirSeccion`, el contenido de la sección puede seguir
    // re-renderizando un instante más (confirmado real: click nativo sobre
    // la referencia obtenida inmediatamente después de `abrirSeccion` tira
    // `StaleElementReferenceError`) — reintento acotado re-ubicando el botón,
    // mismo patrón ya usado en el framework para este tipo de falla.
    // También reintenta ante `ElementClickInterceptedError` (el toolbar
    // reacomodándose, ver arriba): re-ubicar el botón desde cero tras un
    // instante suele alcanzar, el `esperarSinLoader` de arriba ya cubre la
    // causa más común.
    const locator = By.xpath("//*[normalize-space(text())='Editar']");
    for (let intento = 1; intento <= 2; intento++) {
      const btn = await this.waitVisible(locator);
      try {
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
        await btn.click();
        return new EmpleadoFormPage(this.driver).estaCargado();
      } catch (err) {
        const mensaje = String((err && err.message) || err);
        const reintentable = /stale element reference|element click intercepted/i.test(mensaje);
        if (intento === 2 || !reintentable) throw err;
        await this.driver.sleep(500);
      }
    }
  }

  /**
   * Click en un ítem del sidemenu por su nombre EXACTO. Los ítems del
   * sidemenu son `<h1>` — se usa ESE tag específico (no cualquier nodo de
   * texto) porque, para secciones tipo grid (ej. "Beneficios"), el título
   * del contenido (`<h2 class*="record-name">`) puede repetir el MISMO
   * texto que el ítem del menú — confirmado con Selenium real, un selector
   * genérico "cualquier nodo hoja" matchea AMBOS y el que se clickea
   * primero no está garantizado.
   */
  async _clickSeccion(nombre) {
    const el = await this.waitVisible(By.xpath(`//h1[normalize-space(text())='${nombre}']`));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el);
    await el.click();
  }

  /** True si el ítem del sidemenu `nombre` está VISIBLE ahora mismo (sin importar si es la sección activa). */
  async _seccionVisible(nombre) {
    const els = await this.driver.findElements(By.xpath(`//h1[normalize-space(text())='${nombre}']`));
    for (const el of els) {
      if (await el.isDisplayed().catch(() => false)) return true;
    }
    return false;
  }

  /**
   * True si el ítem del sidemenu `nombre` está marcado como la sección
   * ACTUAL — clase `is_current` en un ancestro cercano del `<h1>` (única
   * evidencia real y ESTABLE de "esta sección está activa": el contenido de
   * cada sección es demasiado distinto entre sí —formulario, grid, "sin
   * datos"— para tener un marcador de "cargó bien" común más allá de este).
   */
  async _seccionActiva(nombre) {
    return this.driver.executeScript((n) => {
      const h1s = Array.from(document.querySelectorAll('h1')).filter((e) => e.textContent.trim() === n);
      for (const h1 of h1s) {
        let nivel = h1;
        for (let i = 0; i < 5 && nivel; i++) {
          if (typeof nivel.className === 'string' && nivel.className.includes('is_current')) return true;
          nivel = nivel.parentElement;
        }
      }
      return false;
    }, nombre);
  }

  /**
   * Navega a la sección `nombre` del sidemenu (expandiendo su CADENA de
   * acordeones padre en orden, si `SECCIONES` declara alguno — puede ser más
   * de uno, ej. "Dimensiones financieras" cuelga de "Interfaces" > "Dynamics
   * 365") y espera a que quede marcada como activa (`is_current`). Requiere
   * el detalle ya cargado (`estaCargado()`). Devuelve `{ activada }`.
   */
  async abrirSeccion(nombre) {
    if (!(nombre in SECCIONES)) {
      throw new Error(
        `EmpleadoDetallePage: sección "${nombre}" no está declarada en SECCIONES — agregarla (con su cadena de acordeones padre, si aplica) antes de usarla.`
      );
    }
    for (const padre of SECCIONES[nombre]) {
      // No re-clickear un acordeón YA expandido (ej. dos secciones seguidas
      // bajo "Recursos humanos"): un segundo click lo COLAPSA en vez de
      // dejarlo abierto — mismo criterio que `EmpleadoFormPage.irARecursosHumanos`.
      const hijoDirecto = SECCIONES[nombre][SECCIONES[nombre].indexOf(padre) + 1] || nombre;
      if (await this._seccionVisible(hijoDirecto)) continue;
      await this._clickSeccion(padre);
      await this.esperarSinLoader().catch(() => {});
    }
    await this._clickSeccion(nombre);
    await this.esperarSinLoader().catch(() => {});
    let activada = false;
    await this.driver
      .wait(async () => {
        activada = await this._seccionActiva(nombre);
        return activada;
      }, 8000)
      .catch(() => {});
    return { activada };
  }

  /**
   * Nómina(s) a las que el empleado está asignado, leídas de la sub-sección
   * "Nóminas en la que participa" dentro de "Datos básicos RH" (debe estar
   * ya abierta, ver `abrirSeccion('Datos básicos RH')`) — verificado con
   * Selenium real (módulo Nómina, "Asignar a Nómina"): estructura
   * `<div class="nominaGrupoInfo"><h2>Nóminas en la que participa</h2>…
   * <div class="nombreNominasAsignadas"><div class="NominasAsignada">
   * <span>NOMINA GENERAL</span></div></div></div>` — clases propias y
   * estables de la app (no hasheadas), nunca el hash de CSS-modules.
   * Devuelve un array (vacío si el empleado no participa de ninguna nómina
   * todavía, o si la sub-sección no está presente).
   */
  async getNominasAsignadas() {
    const spans = await this.driver.findElements(
      By.css('.nombreNominasAsignadas .NominasAsignada')
    );
    if (spans.length) {
      // Esta sub-sección vive al final de "Datos básicos RH": se la baja a
      // la vista (evidencia visual real en un screenshot, no solo el valor
      // leído) — tolerante si el elemento quedó stale entre medio.
      await this.driver
        .executeScript('arguments[0].scrollIntoView({block:"center"})', spans[0])
        .catch(() => {});
    }
    const nombres = [];
    for (const el of spans) {
      try {
        const texto = (await el.getText()).trim();
        if (texto) nombres.push(texto);
      } catch (e) {
        /* stale, se omite */
      }
    }
    return nombres;
  }

  /**
   * Espera (poll) a que `nombreNomina` aparezca entre las nóminas asignadas
   * del empleado (comparación case/acento-insensitive, `textoIgual` del
   * core). Pensado para confirmar la PERSISTENCIA de "Asignar a Nómina"
   * (módulo Nómina) desde el propio registro del empleado — evidencia más
   * directa que releer el listado "Empleados de Nuevo Ingreso" del origen.
   * @returns {Promise<boolean>} true si apareció dentro del timeout.
   */
  async esperarNominaAsignada(nombreNomina, timeout = config.timeouts.explicitWaitMs, intervalo = 2000) {
    const fin = Date.now() + timeout;
    do {
      const asignadas = await this.getNominasAsignadas();
      if (asignadas.some((n) => textoIgual(n, nombreNomina))) return true;
      await this.driver.sleep(intervalo);
    } while (Date.now() < fin);
    return false;
  }

  /**
   * Textos VISIBLES de los títulos de CONTENIDO de la sección abierta —
   * `<h2>` cuya clase contiene `record-name` (el MISMO selector `.record-name`
   * que usa `ConfiguracionEntidadDetallePage` para el título de registro; acá
   * el contenido de secciones tipo grid —Capacitación, Herramientas,
   * Beneficios…— repite en ese `<h2>` el nombre de la sección, ver
   * `_clickSeccion`). Se EXCLUYE a propósito:
   *   - el `<h1>` del ítem del sidemenu (mismo texto, pero no es "la página"),
   *   - el wrapper del toolbar superior (`record-name-and-main-btns`), que
   *     trae el nombre del EMPLEADO, no el de la sección.
   * Devuelve `[]` si todavía no hay ninguno (contenido aún renderizando).
   */
  async _titulosContenido() {
    return this.driver.executeScript(() => {
      const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      return Array.from(document.querySelectorAll('h2'))
        .filter((el) => {
          const c = typeof el.className === 'string' ? el.className : '';
          return c.includes('record-name') && !c.includes('record-name-and-main-btns') && visible(el);
        })
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean);
    });
  }

  /**
   * Espera (poll) a que el área de título de la página muestre `textoEsperado`
   * (comparación tolerante: colapsa espacios, case-insensitive, `includes`).
   * Es la verificación ANTI-FALSO-POSITIVO de las secciones "solo consulta":
   * que el ítem del sidemenu quede `is_current` (`abrirSeccion().activada`) NO
   * prueba que el contenido cargó; que el `<h2 class*="record-name">` de la
   * página diga el nombre de la sección, sí. Devuelve `{ coincide, vistos }`
   * (`vistos` = todos los títulos leídos, para el mensaje de assert del test).
   */
  async esperarTituloContenido(textoEsperado, timeout = 10000) {
    const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
    const objetivo = norm(textoEsperado);
    let vistos = [];
    let coincide = false;
    await this.driver
      .wait(async () => {
        vistos = await this._titulosContenido();
        coincide = vistos.some((t) => norm(t).includes(objetivo));
        return coincide;
      }, timeout)
      .catch(() => {});
    return { coincide, vistos };
  }

  /**
   * Abre el formulario INLINE "Agregar" de la sección "Capacitación" (botón
   * "Agregar" junto al título, al lado de "Eliminar" — mismo layout de barra
   * que Requisiciones). Requiere estar YA en la sección "Capacitación"
   * (`abrirSeccion('Capacitación')`). Devuelve una `CapacitacionFormPage` ya
   * cargada.
   *
   * Reintento acotado ante `StaleElementReferenceError` (tras `abrirSeccion`
   * el contenido puede seguir re-renderizando un instante — mismo patrón que
   * `editar()`/`_abrirAgregarResumen`).
   */
  async abrirAgregarCapacitacion() {
    await this.esperarSinLoader().catch(() => {});
    const locator = By.xpath(
      "//*[contains(@class,'capacitaciones-page')]//*[normalize-space(text())='Agregar']" +
        " | //*[@title='Agregar' and not(ancestor::*[contains(@class,'record-name-and-main-btns')])]" +
        " | //*[self::button or contains(@class,'dx-button')][normalize-space(.)='Agregar']"
    );
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const btn = await this.waitVisible(locator);
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
        await btn.click();
        return await new CapacitacionFormPage(this.driver).estaCargado();
      } catch (err) {
        if (intento === 2 || !/stale element reference/i.test(String((err && err.message) || err))) throw err;
        await this.driver.sleep(500);
      }
    }
  }

  /**
   * Abre el formulario INLINE "Agregar" de la sección "Dependientes" — MISMO
   * layout de barra (título + "Agregar"/"Eliminar"/"Filtro") que
   * "Capacitación", confirmado real (2026-09-10), pero sin una clase
   * contenedora propia tipo `.capacitaciones-page` en la vista de listview
   * (recién aparece `.dependientes-form` una vez el form ya está abierto) —
   * por eso usa directo el patrón GENÉRICO ya verificado (botón "Agregar"
   * visible, sin ambigüedad porque solo hay uno visible a la vez). Requiere
   * estar YA en la sección "Dependientes" (`abrirSeccion('Dependientes')`).
   * Devuelve una `DependienteFormPage` ya cargada.
   */
  async abrirAgregarDependiente() {
    await this.esperarSinLoader().catch(() => {});
    const locator = By.xpath("//*[self::button or contains(@class,'dx-button')][normalize-space(.)='Agregar']");
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const btn = await this.waitVisible(locator);
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
        await btn.click();
        return await new DependienteFormPage(this.driver).estaCargado();
      } catch (err) {
        if (intento === 2 || !/stale element reference/i.test(String((err && err.message) || err))) throw err;
        await this.driver.sleep(500);
      }
    }
  }

  /**
   * Espera (poll) a que el grid de "Capacitación" TERMINE su fetch y lo MARCA
   * con `data-qa="grid-capacitacion"` para que el resto de métodos lo ubiquen
   * por CSS.
   *
   * Por qué por FIRMA de columnas y no por clase/contenedor (confirmado real,
   * 2026-09-07): NO existe una `.capacitaciones-page` en la vista de grilla; y
   * el DOM tiene ~13 elementos que matchean `.dx-datagrid` (las clases de los
   * menús de filtro por columna incluyen el token `dx-datagrid`). El grid REAL
   * es un `.clean-grid.genericDataGrid` cuyo header trae "Frecuencia" y
   * "Acción" — firma única de Capacitación entre las secciones del detalle.
   *
   * "Listo" = hay `.dx-data-row` con conteo ESTABLE en 2 lecturas, o DevExtreme
   * pintó su `.dx-datagrid-nodata` ("Por el momento, no hay datos para
   * mostrar"). Devuelve `{ listo, filas, vacio }`.
   */
  async _esperarGridCapacitacion(timeout = 20000) {
    await this.esperarSinLoader().catch(() => {});
    let estado = { listo: false, filas: 0, vacio: false };
    let previo = -1;
    await this.driver
      .wait(async () => {
        const r = await this.driver.executeScript(() => {
          const grid = Array.from(document.querySelectorAll('.clean-grid.genericDataGrid')).find((g) => {
            const h = Array.from(g.querySelectorAll('.dx-header-row td')).map((c) => (c.textContent || '').trim());
            return h.includes('Frecuencia') && h.includes('Acción');
          });
          if (!grid) return { marcado: false, filas: 0, vacio: false };
          grid.setAttribute('data-qa', 'grid-capacitacion');
          const filas = grid.querySelectorAll('.dx-data-row').length;
          const nodata = grid.querySelector('.dx-datagrid-nodata');
          const vacio = filas === 0 && !!nodata && !!nodata.offsetParent && /no hay datos/i.test(nodata.textContent || '');
          return { marcado: true, filas, vacio };
        });
        const estable = r.marcado && r.filas > 0 && r.filas === previo;
        previo = r.filas;
        estado = { listo: estable || r.vacio, filas: r.filas, vacio: r.vacio };
        return estado.listo;
      }, timeout)
      .catch(() => {});
    return estado;
  }

  /**
   * Filas del grid de "Capacitación" como `{ columna: valor }[]` (las columnas
   * "" del checkbox y "Acción" quedan fuera). Espera ANTES a que el grid
   * termine de cargar; si NUNCA se estabiliza (ni filas ni "sin datos"), LANZA
   * — no devuelve `[]` (para no confundir "grid no cargó" con "el empleado no
   * tiene capacitaciones").
   */
  async leerFilasCapacitacion() {
    const estado = await this._esperarGridCapacitacion();
    if (!estado.listo) {
      throw new Error(
        `EmpleadoDetallePage: el grid de "Capacitación" no se pudo leer (marcado/filas=${estado.filas}). ` +
          `¿Cambió la firma de columnas del grid o la sección no renderizó?`
      );
    }
    if (estado.vacio) return [];
    return this.driver.executeScript(() => {
      const grid = document.querySelector('[data-qa="grid-capacitacion"]');
      if (!grid) return [];
      const headers = Array.from(grid.querySelectorAll('.dx-header-row td')).map((h) => h.innerText.replace(/\s+/g, ' ').trim());
      return Array.from(grid.querySelectorAll('.dx-data-row')).map((row) => {
        const celdas = Array.from(row.querySelectorAll('td'));
        const obj = {};
        celdas.forEach((c, i) => {
          const k = headers[i];
          if (k) obj[k] = c.innerText.replace(/\s+/g, ' ').trim();
        });
        return obj;
      });
    });
  }

  /**
   * Espera (poll) a que la fila de "Capacitación" con `Nombre === nombre`
   * cumpla `predicado(fila)` — releyendo el grid en cada vuelta (fuerza el
   * re-marcado, así capta el refresh post-Guardar). Devuelve la última fila
   * leída (o `undefined`) aunque nunca cumpla, para el assert del test.
   */
  async esperarFilaCapacitacion(nombre, predicado, timeout = 15000) {
    const buscado = String(nombre).trim().toLowerCase();
    let fila;
    await this.driver
      .wait(async () => {
        const filas = await this.leerFilasCapacitacion().catch(() => []);
        fila = filas.find((f) => String(f.Nombre || '').trim().toLowerCase() === buscado);
        return !!fila && predicado(fila);
      }, timeout)
      .catch(() => {});
    return fila;
  }

  /**
   * Click en el ícono `titulo` ("Editar" / "Adjuntar documento") de la columna
   * "Acción" del grid de "Capacitación", en la fila que matchea `objetivo`:
   *  - `objetivo` string  → la fila cuya celda "Nombre" es EXACTA (case-insensitive).
   *  - `objetivo` number  → la fila en esa posición (0 = primera).
   * FALLA explícito si no hay filas o no matchea.
   */
  async _clickIconoFilaCapacitacion(objetivo, titulo) {
    const datos = await this.leerFilasCapacitacion(); // marca el grid + espera carga
    if (!datos.length) {
      throw new Error(`EmpleadoDetallePage: la sección "Capacitación" no tiene filas (${titulo}).`);
    }
    let indice;
    if (typeof objetivo === 'number') {
      indice = objetivo;
    } else {
      const buscado = String(objetivo).trim().toLowerCase();
      indice = datos.findIndex((d) => String(d.Nombre || '').trim().toLowerCase() === buscado);
    }
    const filas = await this.driver.findElements(By.css('[data-qa="grid-capacitacion"] .dx-data-row'));
    const fila = indice >= 0 ? filas[indice] : undefined;
    if (!fila) {
      throw new Error(
        `EmpleadoDetallePage: no se encontró la fila de "Capacitación" para ${JSON.stringify(objetivo)} (${titulo}).`
      );
    }
    const icono = await fila.findElement(By.xpath(`.//td[last()]//img[@title=${JSON.stringify(titulo)}]`));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"});arguments[0].click()', icono);
  }

  /**
   * Edita una Capacitación por el ÍCONO DE LÁPIZ ("Editar") de la columna
   * "Acción" — este listado no tiene "consulta" ni doble-click: el lápiz abre
   * el MISMO form inline que "Agregar" pero titulado "Editar capacitación" y
   * precargado. Requiere estar en la sección "Capacitación".
   *
   * `objetivo`: nombre EXACTO de la capacitación (columna "Nombre") o índice
   * (0 = primera). Devuelve una `CapacitacionFormPage` cargada.
   */
  async abrirEditarCapacitacion(objetivo = 0) {
    await this.esperarSinLoader().catch(() => {});
    await this._clickIconoFilaCapacitacion(objetivo, 'Editar');
    return new CapacitacionFormPage(this.driver).estaCargado();
  }

  /**
   * Abre la pantalla de ADJUNTOS de una Capacitación por el ícono de clip
   * ("Adjuntar documento") de la columna "Acción" — NAVEGA a una pantalla
   * propia (`.capacitaciones-docs-page`) titulada con el nombre de la
   * capacitación. Requiere estar en la sección "Capacitación".
   *
   * `objetivo`: nombre EXACTO de la capacitación o índice. Devuelve una
   * `CapacitacionAdjuntosPage` cargada.
   */
  async abrirAdjuntarCapacitacion(objetivo = 0) {
    await this.esperarSinLoader().catch(() => {});
    await this._clickIconoFilaCapacitacion(objetivo, 'Adjuntar documento');
    return new CapacitacionAdjuntosPage(this.driver).estaCargado();
  }

  /**
   * Elimina una Capacitación: selecciona su checkbox (columna de selección,
   * primera del grid — `DataGrid.seleccionarFila`) y clickea "Eliminar" (al
   * lado de "Agregar"/"Filtro" en la barra de la sección) -> confirma el
   * popup ("Eliminar Capacitación... ¿Seguro que desea eliminar los
   * registros seleccionados?", botones Aceptar/Cancelar) con "Aceptar".
   * Requiere estar en la sección "Capacitación".
   *
   * `nombre`: si se pasa, selecciona la fila cuyo texto lo contiene; si no,
   * la PRIMERA fila real del grid (mismo criterio que `DataGrid.seleccionarFila`).
   *
   * Historial de investigación (2026-09-09): un PRIMER probe con clicks
   * crudos (`element.click()` por `executeScript`, sin poll de "¿el botón ya
   * está habilitado/enganchado?" antes de clickear "Aceptar") reprodujo 2/2
   * veces un popup que NUNCA cerraba y ningún notify — consistente con el
   * bug reportado por el usuario en uso manual. Esta implementación usa
   * `Popup.accionar()` (que SÍ hace poll hasta que el botón exista y esté
   * habilitado antes de clickear, como el resto del framework) y, con eso,
   * el flujo completó exitosamente 3/3 veces reales (notify "Eliminado
   * exitosamente", fila removida y confirmada tras releer el grid). No se
   * volvió a reproducir el cuelgue con esta implementación — si vuelve a
   * aparecer, agregar la evidencia acá (no asumir que "ya se corrigió" sin
   * volver a confirmar). Devuelve `{ nombre, seleccionado,
   * botonEliminarClickeado, popupApareció, popupCerrado, notify }` — el test
   * decide el assert.
   */
  async eliminarCapacitacion(nombre) {
    await this.leerFilasCapacitacion(); // marca el grid ([data-qa="grid-capacitacion"]) + espera carga

    const grid = new DataGrid(this.driver);
    const seleccionado = await grid.seleccionarFila(nombre);
    if (!seleccionado) {
      throw new Error(
        `EmpleadoDetallePage: no se pudo seleccionar (checkbox) la fila de "Capacitación" a eliminar ` +
          `(${nombre ? `"${nombre}"` : '(primera)'}).`
      );
    }

    const botonEliminarClickeado = await this.driver.executeScript(() => {
      const page = document.querySelector('.capacitaciones-page') || document.body;
      const btn = Array.from(page.querySelectorAll('button, .dx-button, [role="button"]')).find(
        (b) => b.offsetParent && /^eliminar$/i.test((b.textContent || '').trim())
      );
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return true;
    });
    if (!botonEliminarClickeado) {
      throw new Error('EmpleadoDetallePage: no se encontró el botón "Eliminar" de la sección "Capacitación".');
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
      notify = await this.notify.esperarTexto(6000);
    }
    const popupCerrado = !(await popup.estaVisible());

    return { nombre: nombre || '(primera)', seleccionado, botonEliminarClickeado, popupApareció, popupCerrado, notify };
  }

  /**
   * Mini-formularios "Agregar" de "Resumen/CV" (Educación y experiencia,
   * Habilidades): NO son un popup ni la pantalla "Editar Empleado" — un
   * bloque que se expande INLINE dentro del panel de consulta, con su
   * propio Guardar/Descartar (confirmado con Selenium real: guardado
   * persiste sin salir de "Resumen/CV", sin notify — mismo criterio sin
   * notify que "Crear Empleado"). Sus campos NO usan `<label>` (usan
   * `<span>Campo: *</span>` dentro de un contenedor con clase que contiene
   * "inputAgregarResumen", compartida por AMBOS mini-forms) — por eso no
   * pueden operarse con el componente `Form` genérico y usan estos métodos
   * propios, mismo criterio que `SolicitudEmpleoDetallePage.agregarOtroBeneficio`
   * ("Repeatable add via popup widgets").
   */

  /**
   * Abre el mini-form #`indiceBoton` de "Resumen/CV" (0 = Educación y
   * experiencia, 1 = Habilidades). Reintento acotado ante
   * `StaleElementReferenceError`: tras `abrirSeccion`, el contenido puede
   * seguir re-renderizando un instante más — mismo motivo/patrón ya
   * documentado y resuelto en `editar()`.
   */
  async _abrirAgregarResumen(indiceBoton, tituloEsperado) {
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const botones = await this.driver.findElements(By.xpath("//*[@title='Agregar']"));
        if (!botones[indiceBoton]) {
          throw new Error(`EmpleadoDetallePage: no se encontró el botón "Agregar" #${indiceBoton} en "Resumen/CV".`);
        }
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', botones[indiceBoton]);
        await botones[indiceBoton].click();
        await this.waitVisible(By.xpath(`//*[normalize-space(text())='${tituloEsperado}']`));
        return;
      } catch (err) {
        if (intento === 2 || !/stale element reference/i.test(String((err && err.message) || err))) throw err;
      }
    }
  }

  /** Todos los campos visibles del mini-form actualmente abierto: `{ label, contenedor }[]`. */
  async _camposAgregarResumen() {
    const contenedores = await this.driver.findElements(By.css('[class*="inputAgregarResumen"]'));
    const resultado = [];
    for (const c of contenedores) {
      const span = await c.findElement(By.css('span'));
      const label = (await span.getText()).replace(/\s+/g, ' ').trim();
      resultado.push({ label, contenedor: c });
    }
    return resultado;
  }

  /**
   * El contenedor del campo cuyo label EMPIEZA con `prefijoLabel` (ej.
   * "Tipo" matchea "Tipo: *"). Relee los campos en cada llamada a propósito:
   * el label del segundo campo cambia tras elegir "Tipo" (ver
   * `LABEL_SEGUNDO_CAMPO_EDUCACION_EXPERIENCIA`), así que una referencia
   * tomada ANTES de ese cambio quedaría apuntando al campo viejo.
   *
   * CON POLL (confirmado real: tras elegir "Tipo", el label del segundo
   * campo puede actualizarse un instante ANTES de que su editor real
   * termine de montarse — mismo tipo de carrera ya documentado para otros
   * campos condicionales del framework, ej. "Rate" de Categoría
   * Actividades). Reintenta hasta `timeout` en vez de una sola lectura.
   */
  async _campoAgregarResumenPorLabel(prefijoLabel, timeout = 8000) {
    const fin = Date.now() + timeout;
    let campos = [];
    let campo;
    do {
      campos = await this._camposAgregarResumen();
      campo = campos.find((c) => c.label.startsWith(prefijoLabel));
      if (campo) return campo.contenedor;
      await this.driver.sleep(200);
    } while (Date.now() < fin);
    throw new Error(
      `EmpleadoDetallePage: no se encontró el campo "${prefijoLabel}" en el mini-form abierto de "Resumen/CV" (labels visibles: ${JSON.stringify(campos.map((c) => c.label))}).`
    );
  }

  /**
   * Confirmado real: el `contenedor` ya puede estar en el DOM (su label
   * cambió) mientras su editor real (`<input>`) todavía se está montando —
   * mismo motivo que el poll de `_campoAgregarResumenPorLabel`. Espera acá
   * también, en vez de una sola búsqueda dentro del contenedor.
   *
   * Selector `.dx-texteditor-input` (SIN `input` fijo): "Descripción" es un
   * `<textarea class="dx-texteditor-input">`, no un `<input>` — confirmado
   * real, el selector `input.dx-texteditor-input` nunca lo encontraba (no
   * era una carrera de tiempo: el poll agotaba SIEMPRE los 8s porque el
   * elemento buscado no podía matchear, sin importar cuánto se esperara).
   */
  async _escribirEnContenedor(contenedor, valor, timeout = 8000) {
    const input = await this.driver.wait(async () => {
      const els = await contenedor.findElements(By.css('input.dx-texteditor-input, textarea.dx-texteditor-input'));
      return els[0] || null;
    }, timeout);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input);
    await input.click();
    await input.sendKeys(String(valor), Key.TAB);
  }

  /**
   * Elige `texto` en el select del contenedor (catálogo fijo, match
   * case-insensitive). Si `tolerante` y `texto` no está entre las opciones,
   * cierra el dropdown y devuelve `false` en vez de fallar — mismo criterio
   * que el patrón "optional catalog match" del skill (campo no requerido,
   * un valor que no matchea se descarta en vez de romper el caso).
   */
  /**
   * `.dx-list-item` NO está scopeado al dropdown recién abierto — puede
   * matchear ítems VISUALMENTE similares que quedaron en el DOM de una
   * tarjeta ya guardada de "Educación y experiencia"/"Habilidades"
   * (confirmado real: un dropdown recién abierto devolvía como "primera
   * opción" el texto de una tarjeta guardada anteriormente, no una opción
   * real del catálogo — MISMA clase `.dx-list-item`, visibles ambos). La
   * diferencia real (confirmada con Selenium real, inspeccionando la
   * cadena de ancestros) es que las tarjetas guardadas cuelgan de un
   * `dx-list-group`/`dx-list-group-body` que las opciones REALES del
   * dropdown nunca tienen — se excluyen por eso, no solo por visibilidad.
   */
  async _opcionesDropdownVisibles() {
    return this.driver.executeScript(() => {
      const esVisible = (el) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const esTarjetaGuardada = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (typeof p.className === 'string' && p.className.includes('dx-list-group')) return true;
        }
        return false;
      };
      return Array.from(document.querySelectorAll('.dx-list-item')).filter(
        (el) => esVisible(el) && !esTarjetaGuardada(el)
      );
    });
  }

  async _elegirEnContenedor(contenedor, texto, { tolerante = false } = {}) {
    const input = await this.driver.wait(async () => {
      const els = await contenedor.findElements(By.css('input[role="combobox"]'));
      return els[0] || null;
    }, 8000);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input);
    await this.driver.executeScript('arguments[0].click()', input);
    const buscado = String(texto).trim().toLowerCase();
    const opcion = await this.driver
      .wait(async () => {
        const items = await this._opcionesDropdownVisibles();
        for (const it of items) {
          const t = (await it.getText().catch(() => '')).trim();
          if (t.toLowerCase() === buscado) return it;
        }
        return null;
      }, 8000)
      .catch(() => null);
    if (!opcion) {
      if (tolerante) {
        await this.driver.actions().sendKeys(Key.ESCAPE).perform();
        return false;
      }
      throw new Error(`EmpleadoDetallePage: "${texto}" no está entre las opciones disponibles del select.`);
    }
    await opcion.click();
    return true;
  }

  /** Elige la primera opción REAL (visible y no vacía) del select del contenedor. Devuelve el texto elegido. */
  async _elegirPrimeraOpcionEnContenedor(contenedor) {
    const input = await this.driver.wait(async () => {
      const els = await contenedor.findElements(By.css('input[role="combobox"]'));
      return els[0] || null;
    }, 8000);
    await this.driver.executeScript('arguments[0].click()', input);
    const opcion = await this.driver.wait(async () => {
      const items = await this._opcionesDropdownVisibles();
      for (const it of items) {
        const t = (await it.getText().catch(() => '')).trim();
        if (t) return it;
      }
      return null;
    }, 8000);
    const elegido = (await opcion.getText()).trim();
    await opcion.click();
    return elegido;
  }

  async _formAgregarResumenAbierto() {
    return this.driver.executeScript(() => {
      return !!Array.from(document.querySelectorAll('*')).find(
        (e) =>
          e.children.length === 0 &&
          (e.textContent.trim() === 'Nueva educación o experiencia' || e.textContent.trim() === 'Nueva habilidad')
      );
    });
  }

  /**
   * Click en "Guardar" del mini-form abierto, espera a que se cierre y
   * clasifica el notify real ("Resumen creado exitosamente" — CONFIRMADO
   * con Selenium real que esta pantalla SÍ muestra notify, a diferencia de
   * "Crear Empleado"/"Editar" de otras secciones; no asumir "sin notify"
   * por analogía con esas). Devuelve `{ exito, notify }` — el LLAMADOR
   * decide si eso amerita `assert.ok`, mismo criterio que
   * `EmpleadoFormPage.resultadoGuardado`.
   */
  async _guardarResumen() {
    const btn = await this.waitVisible(By.xpath("//*[normalize-space(text())='Guardar']"));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
    await this.driver.executeScript('arguments[0].click()', btn);
    await this.driver.wait(async () => !(await this._formAgregarResumenAbierto()), 8000);
    const texto = await this.notify.esperarTexto();
    return Notify.clasificar(texto);
  }

  /** Texto visible del bloque `tituloBloque` de "Resumen/CV" (hasta `tituloSiguiente`, o 1500 chars si no se da). */
  async _leerBloqueResumen(tituloBloque, tituloSiguiente) {
    return this.driver.executeScript(
      (inicio, fin) => {
        const texto = document.body.innerText;
        const i = texto.indexOf(inicio);
        if (i < 0) return '';
        const desde = i + inicio.length;
        const j = fin ? texto.indexOf(fin, desde) : -1;
        return (j >= 0 ? texto.slice(desde, j) : texto.slice(desde, desde + 1500)).trim();
      },
      tituloBloque,
      tituloSiguiente
    );
  }

  /**
   * Espera (poll) a que el bloque `tituloBloque` contenga `texto` — mismo
   * motivo que `Form.esperarValor`: tras Guardar, la sección puede tardar
   * un instante en reflejar la tarjeta recién creada (confirmado real: una
   * lectura inmediata no la mostraba, una relectura ~15s después sí).
   * Devuelve el ÚLTIMO texto leído (aunque nunca haya matcheado), para que
   * el assert del llamador tenga el detalle completo si falla.
   */
  async _esperarBloqueResumenContiene(tituloBloque, tituloSiguiente, texto, timeout = 15000) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = await this._leerBloqueResumen(tituloBloque, tituloSiguiente);
        return actual.includes(texto);
      }, timeout)
      .catch(() => {});
    return actual;
  }

  /**
   * Agrega una entrada de "Educación y experiencia" (requiere estar en la
   * sección "Resumen/CV" — ver `abrirSeccion`). `tipo` debe ser
   * `"Educación"` o `"Experiencia"` (determina si `nombreOPuesto` llena
   * "Nombre programa educativo" o "Puesto" — ver
   * `LABEL_SEGUNDO_CAMPO_EDUCACION_EXPERIENCIA`).
   */
  async agregarEducacionOExperiencia(tipo, { nombreOPuesto, lugar, fechaInicio, fechaFin, descripcion } = {}) {
    const labelSegundoCampo = LABEL_SEGUNDO_CAMPO_EDUCACION_EXPERIENCIA[tipo];
    if (!labelSegundoCampo) {
      throw new Error(
        `EmpleadoDetallePage.agregarEducacionOExperiencia: tipo "${tipo}" no soportado (usar "Educación" o "Experiencia").`
      );
    }
    await this._abrirAgregarResumen(0, 'Nueva educación o experiencia');
    await this._elegirEnContenedor(await this._campoAgregarResumenPorLabel('Tipo'), tipo);
    await this._escribirEnContenedor(await this._campoAgregarResumenPorLabel(labelSegundoCampo), nombreOPuesto);
    await this._escribirEnContenedor(await this._campoAgregarResumenPorLabel('Lugar'), lugar);
    await this._escribirEnContenedor(await this._campoAgregarResumenPorLabel('Fecha de inicio'), fechaInicio);
    if (fechaFin) {
      await this._escribirEnContenedor(await this._campoAgregarResumenPorLabel('Fecha finalización'), fechaFin);
    }
    if (descripcion) {
      await this._escribirEnContenedor(await this._campoAgregarResumenPorLabel('Descripción'), descripcion);
    }
    return this._guardarResumen();
  }

  /** Texto visible del bloque "Educación y experiencia" (para verificar persistencia). */
  async leerEducacionExperiencia() {
    return this._leerBloqueResumen('Educación y experiencia', 'Habilidades');
  }

  /** Espera (poll) a que "Educación y experiencia" contenga `texto` tras Guardar. */
  async esperarEducacionExperienciaContiene(texto, timeout = 15000) {
    return this._esperarBloqueResumenContiene('Educación y experiencia', 'Habilidades', texto, timeout);
  }

  /**
   * Agrega una entrada de "Habilidades" (requiere estar en la sección
   * "Resumen/CV"). `tipo` es un catálogo fijo requerido — si no se dirige,
   * se elige la primera opción disponible (mismo criterio "modo automático"
   * del resto del framework para selects sin valor dirigido). `nivel` es
   * opcional.
   */
  async agregarHabilidad({ tipo, habilidad, nivel } = {}) {
    await this._abrirAgregarResumen(1, 'Nueva habilidad');
    const tipoContenedor = await this._campoAgregarResumenPorLabel('Tipo');
    const tipoUsado = tipo
      ? (await this._elegirEnContenedor(tipoContenedor, tipo), tipo)
      : await this._elegirPrimeraOpcionEnContenedor(tipoContenedor);
    await this._escribirEnContenedor(await this._campoAgregarResumenPorLabel('Habilidad'), habilidad);
    if (nivel) {
      await this._elegirEnContenedor(await this._campoAgregarResumenPorLabel('Nivel'), nivel);
    }
    const resultado = await this._guardarResumen();
    return { ...resultado, tipoUsado };
  }

  /** Texto visible del bloque "Habilidades" (para verificar persistencia). */
  async leerHabilidades() {
    return this._leerBloqueResumen('Habilidades', null);
  }

  /** Espera (poll) a que "Habilidades" contenga `texto` tras Guardar. */
  async esperarHabilidadesContiene(texto, timeout = 15000) {
    return this._esperarBloqueResumenContiene('Habilidades', null, texto, timeout);
  }
}

module.exports = EmpleadoDetallePage;
