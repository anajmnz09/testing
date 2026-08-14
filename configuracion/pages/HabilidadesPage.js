const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const DataGrid = require('@triple/core/components/DataGrid');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const Popup = require('@triple/core/components/Popup');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const testContext = require('@triple/core/context/testContext');

/**
 * Listado + modal de "Habilidades" (Configuración > Empleados > Habilidades).
 * Se llega vía `ConfiguracionesPage.irA('Habilidades', 'Empleados')` (core).
 * MISMO patrón que `GradosAcademicosPage` (mapeo verificado con Selenium
 * Headless, probe dedicado) — Crear/Consultar/Editar por el MISMO popup, sin
 * navegar de pantalla:
 *  - Listado con columnas "Código" (auto, no se mapea), "Habilidad", "Estado",
 *    "Acciones" (íconos `<img alt="Consultar">`/`<img alt="Editar">`, igual
 *    que Grados Académicos).
 *  - Popup real, misma clase `.popup-style-container` en el WRAPPER (no en un
 *    descendiente) — se instancia `Popup` SIN `contiene`, igual criterio que
 *    Grados Académicos (nunca hay más de un popup abierto a la vez acá).
 *  - "Habilidad" (`dx-field-item-required`): texto libre, REQUERIDO — es
 *    también la columna que identifica la fila en el listado (a diferencia
 *    de Grados Académicos/Beneficios, acá el campo y la columna se llaman
 *    IGUAL).
 *  - "Estado" (`dx-field-item-required`): selectbox REQUERIDO,
 *    DESHABILITADO (`dx-state-readonly`) al Crear (nace "Activo" fijo, mismo
 *    patrón que Grados Académicos/Sucursales/Puestos) — SÍ se habilita al
 *    Editar (mismo criterio, no confirmado puntualmente pero asumido por
 *    consistencia con el resto de entidades de Configuración).
 *  - El buscador del listado está ROTO en el ambiente actual (a pedido
 *    explícito del usuario: "aquí no funciona actualmente, [...] para que
 *    cuando se arregle yo pueda filtrar desde el panel, en automático que
 *    toma siempre el primero") — el código queda LISTO para buscar
 *    (`consultarPorNombre`/`editarPorNombre`, vía `grid.buscar()`) apenas lo
 *    arreglen; mientras tanto, los casos automáticos (sin nombre dirigido)
 *    usan `consultarPrimero`/`editarPrimero`, que operan por POSICIÓN, nunca
 *    buscando.
 */
const ESTRATEGIAS = {
  Habilidad: 'text',
  Estado: 'directSelect',
};

class HabilidadesPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    this.popup = new Popup(driver);
    this.btnGuardar = By.xpath("//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Habilidades', 'Empleados');
    return new HabilidadesPage(driver).listo();
  }

  async listo() {
    await this.grid.listo();
    logger.info('HabilidadesPage: listado cargado');
    return this;
  }

  /** Abre el popup vacío y editable (botón "Crear" de la barra). */
  async crear() {
    logger.info('HabilidadesPage: click en "Crear"');
    await this.grid.crear();
    await this.popup.esperarVisible();
    return this;
  }

  /**
   * Abre el popup en modo `accion` ("Consultar"/"Editar") para la fila en
   * `indice` (0 = primera), clickeando su ícono correspondiente — POR
   * POSICIÓN, nunca por búsqueda (ver mapeo de clase: el buscador está roto).
   */
  async _abrirModalPorIcono(accion, indice = 0, timeout = config.timeouts.explicitWaitMs) {
    logger.info(`HabilidadesPage: abrir modal "${accion}" (fila ${indice}, sin buscador)`);
    const iconos = await this.driver.findElements(By.xpath(`//img[@alt='${accion}']`));
    if (!iconos.length || indice >= iconos.length) {
      throw new Error(`HabilidadesPage: no se encontró el ícono "${accion}" en la fila ${indice} (${iconos.length} disponibles).`);
    }
    const icono = iconos[indice];
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', icono);
    await this.driver.executeScript('arguments[0].click()', icono);
    await this.popup.esperarVisible(timeout);
    await this._esperarCamposHabilitados();
    return this;
  }

  /** Espera (poll, acotado, tolerante) a que la cantidad de editores deshabilitados/readonly en pantalla deje de cambiar. */
  async _esperarCamposHabilitados(timeout = 1500) {
    let anterior = null;
    await this.driver
      .wait(async () => {
        const actual = await this.driver.executeScript(
          () => document.querySelectorAll('.dx-state-disabled, .dx-state-readonly').length
        );
        const estable = actual === anterior;
        anterior = actual;
        return estable;
      }, timeout)
      .catch(() => {});
  }

  /** Abre el popup en modo Consultar (solo lectura) para la primera fila del listado. */
  async consultarPrimero() {
    return this._abrirModalPorIcono('Consultar', 0);
  }

  /** Abre el popup en modo Editar para la primera fila del listado. */
  async editarPrimero() {
    return this._abrirModalPorIcono('Editar', 0);
  }

  /**
   * Abre el popup en modo `accion` para el registro `nombre` — filtra con
   * `grid.buscar(nombre)` y clickea el ícono de la PRIMERA fila resultante.
   * Listo para cuando el buscador de esta pantalla se arregle (ver mapeo de
   * clase); mientras siga roto, los casos automáticos (sin nombre dirigido)
   * usan `consultarPrimero`/`editarPrimero` en su lugar, que nunca buscan.
   */
  async _abrirModalPorNombre(accion, nombre, timeout = config.timeouts.explicitWaitMs) {
    logger.info(`HabilidadesPage: abrir modal "${accion}" para "${nombre}" (buscando)`);
    await this.grid.buscar(nombre);
    await this.grid.esperarSinLoader(timeout);
    return this._abrirModalPorIcono(accion, 0, timeout);
  }

  /** Abre el popup en modo Consultar para el registro `nombre` (buscándolo). */
  async consultarPorNombre(nombre) {
    return this._abrirModalPorNombre('Consultar', nombre);
  }

  /** Abre el popup en modo Editar para el registro `nombre` (buscándolo). */
  async editarPorNombre(nombre) {
    return this._abrirModalPorNombre('Editar', nombre);
  }

  /** Pone un valor con la estrategia declarada para ese control. */
  async setCampo(label, valor, extras = {}) {
    const declarado = ESTRATEGIAS[label];
    const base = typeof declarado === 'string' ? { estrategia: declarado } : declarado || {};
    return this.form.setValor(label, valor, { ...base, ...extras });
  }

  /** Espera (poll) a que el campo `label` muestre `esperado` (mismo criterio que Grados Académicos). */
  async esperarValor(label, esperado, timeout = config.timeouts.explicitWaitMs) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = (await this.getValor(label)).trim();
        return actual === esperado;
      }, timeout)
      .catch(() => {});
    return actual;
  }

  /** Valor actual de un campo (funciona tanto en modo consulta como edición). */
  async getValor(label) {
    return this.form.getValor(label);
  }

  /**
   * Completa los controles declarados en `ESTRATEGIAS` DESDE el Execution
   * Context. Mismo criterio "completar solo vacíos" que el resto del
   * framework: "Estado" (deshabilitado y ya con valor al Crear) queda
   * protegido solo.
   */
  async completarConContexto(caso, { incluirOpcionales = false } = {}) {
    logger.info(`HabilidadesPage: completar popup desde Execution Context (caso="${caso}")`);
    await this.form.validarControlesDeclarados(ESTRATEGIAS, { etiqueta: 'habilidad' });
    const val = (label) => testContext.get(caso, label);
    const resultado = {};

    for (const label of Object.keys(ESTRATEGIAS)) {
      if (!(await this.form.estaVacio(label))) {
        logger.info(`HabilidadesPage: "${label}" ya tiene datos, no se sobreescribe`);
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

  /** Guarda el popup (botón "Guardar"). */
  async guardar() {
    logger.info('HabilidadesPage: Guardar');
    const btn = await this.driver.wait(require('selenium-webdriver').until.elementLocated(this.btnGuardar), config.timeouts.explicitWaitMs);
    await this.driver.executeScript('arguments[0].click()', btn);
  }

  /** Clasifica el resultado tras Guardar según el notify (mismo mecanismo que el resto del framework). */
  async resultadoGuardado(timeoutMs = config.timeouts.explicitWaitMs) {
    const texto = await this.notify.esperarTexto(timeoutMs);
    return Notify.clasificar(texto);
  }
}

module.exports = HabilidadesPage;
