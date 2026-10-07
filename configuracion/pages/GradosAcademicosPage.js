const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const DataGrid = require('@triple/core/components/DataGrid');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const Popup = require('@triple/core/components/Popup');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');
const testContext = require('@triple/core/context/testContext');
const { textoIgual } = require('@triple/core/utils/assert');

/**
 * Listado + modal de "Grados Académicos" (Configuración > Administración >
 * Grados Académicos). Se llega vía
 * `ConfiguracionesPage.irA('Grados Académicos', 'Administración')` (core).
 *
 * A DIFERENCIA de Sucursales/Departamentos/Puestos/Horarios (una pantalla
 * completa por registro, con navegación propia), esta entidad hace TODO —
 * Crear, Consultar, Editar — a través del MISMO popup, sin navegar de
 * pantalla — mapeo verificado con Selenium Headed:
 *  - El listado tiene una columna "Acciones" (última) con 2 ÍCONOS por fila
 *    (`<img alt="Consultar">`/`<img alt="Editar">`, sin texto): click abre
 *    el popup en modo consulta/edición para ESA fila.
 *  - El botón "Crear" de la barra (igual patrón que el resto de listados)
 *    abre el MISMO popup, vacío y editable.
 *  - Popup real (`dx-popup-wrapper`), con clase propia `.popup-style-
 *    container` — pero esa clase está en el WRAPPER mismo, no en un
 *    descendiente (confirmado con evidencia real: `Popup` del core busca
 *    `contiene` como descendiente vía `querySelector`, nunca matchea el
 *    propio elemento — mismo problema ya resuelto antes con
 *    `.confirmPopup` en Sucursales). Tampoco hay una clase de CONTENIDO
 *    propia y distintiva adentro (`.dx-popup-content` es genérico, lo usan
 *    todos los popups de la app). Por eso acá `Popup` se instancia SIN
 *    `contiene`: alcanza porque nunca hay más de un popup abierto a la vez
 *    en este flujo (no tiene `.dx-popup-title` tampoco, así que no se usa
 *    texto de título para confirmarlo).
 *  - Form nativo `dxForm` (clase `dx-field-item`, igual convención que
 *    Sucursales/Solicitud de Empleo) DENTRO del popup.
 *  - "Nombre" es el único campo REQUERIDO y siempre editable — es también
 *    la columna que identifica la fila en el listado.
 *  - "Estado" es REQUERIDO pero DESHABILITADO (`dx-state-readonly`) al
 *    Crear (nace "Activo" fijo, mismo patrón que Sucursales/Puestos) — SÍ
 *    se habilita en el popup de Editar (confirmado). Se declara en
 *    `ESTRATEGIAS` igual que en Sucursales: como ya trae un valor,
 *    `estaVacio()` lo protege solo al Crear, sin lógica especial.
 *  - "Referencia MT": confirmado con evidencia real que el `.clear()` por
 *    defecto de `Form.escribir()` tira `invalid element state` en este
 *    campo puntual (mismo síntoma ya documentado para "Identificación" en
 *    Solicitud de Empleo, aunque acá no se confirmó la clase
 *    `dx-texteditor-masked`) — estrategia `custom` con `clear:false`.
 *  - Al abrir el popup de "Editar"/"Consultar" desde los íconos de la fila,
 *    confirmado con evidencia real que el popup puede quedar VISIBLE un
 *    instante antes de que sus campos terminen de habilitarse — escribir
 *    ahí enseguida podía tirar `stale element` a mitad de tipeo (mismo tipo
 *    de carrera ya resuelta en `ConfiguracionEntidadDetallePage.editar()`
 *    para las otras entidades) — `_abrirModalPorIcono` ahora espera
 *    (`_esperarCamposHabilitados`) a que se estabilice.
 *  - El buscador del listado (`grid.buscar()`) está ROTO en el ambiente
 *    actual (mismo hallazgo que Horarios) — A PEDIDO EXPLÍCITO se obvia el
 *    filtrado: los casos "automáticos" (sin nombre dirigido) operan sobre
 *    la PRIMERA fila del listado, por posición (`consultarPrimero`/
 *    `editarPrimero`), nunca buscando.
 */
const ESTRATEGIAS = {
  Nombre: 'text',
  Estado: 'directSelect',
  'Referencia MT': { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, valor, { clear: false }) },
};

class GradosAcademicosPage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12): este listado-modal crea y edita registros de "grado-academico" (`crear` abre el modal;
   * su guardado confirmado publica el nombre). No declara localizadores: su buscador está roto y opera por posición.
   */
  static get ENTIDAD_FLUJO() {
    return {
      tipo: 'grado-academico',
      referencia: 'nombre',
      metodos: [],
      creadores: ['crear'],
      editores: ['editarPrimero', 'editarPorNombre'],
      confirmadores: [{ metodo: 'resultadoGuardado', leer: 'antes' }],
    };
  }

  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    this.popup = new Popup(driver);
    // El popup NO es un dxPopup con botones de confirmación adicionales
    // (verificado: "Guardar" guarda directo, sin un segundo popup "¿Está
    // seguro...?" como Sucursales/Departamentos/Puestos/Horarios) — se
    // localiza por texto exacto dentro del popup ya abierto.
    this.btnGuardar = By.xpath("//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  /** Navega acá desde cualquier punto del módulo (entra a Configuración, va al menú, espera el listado). */
  static async ir(driver) {
    const navigationFlow = require('@triple/core/flows/navigationFlow');
    const configuraciones = await navigationFlow.abrirConfiguracion(driver);
    await configuraciones.irA('Grados Académicos', 'Administración');
    return new GradosAcademicosPage(driver).listo();
  }

  async listo() {
    await this.grid.listo();
    logger.info('GradosAcademicosPage: listado cargado');
    return this;
  }

  /** Abre el popup vacío y editable (botón "Crear" de la barra). */
  async crear() {
    logger.info('GradosAcademicosPage: click en "Crear"');
    await this.grid.crear();
    await this.popup.esperarVisible();
    return this;
  }

  /**
   * Abre el popup en modo `accion` ("Consultar"/"Editar") para la fila en
   * `indice` (0 = primera), clickeando su ícono correspondiente — POR
   * POSICIÓN, nunca por búsqueda (ver mapeo de clase: el buscador está
   * roto).
   */
  async _abrirModalPorIcono(accion, indice = 0, timeout = config.timeouts.explicitWaitMs) {
    logger.info(`GradosAcademicosPage: abrir modal "${accion}" (fila ${indice}, sin buscador)`);
    const iconos = await this.driver.findElements(By.xpath(`//img[@alt='${accion}']`));
    if (!iconos.length || indice >= iconos.length) {
      throw new Error(`GradosAcademicosPage: no se encontró el ícono "${accion}" en la fila ${indice} (${iconos.length} disponibles).`);
    }
    const icono = iconos[indice];
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', icono);
    await this.driver.executeScript('arguments[0].click()', icono);
    await this.popup.esperarVisible(timeout);
    // El popup puede aparecer VISIBLE un instante antes de que sus campos
    // terminen de habilitarse — confirmado con evidencia real (mismo tipo
    // de carrera ya visto y resuelto en `ConfiguracionEntidadDetallePage.
    // editar()`): escribir apenas se abre el popup de "Editar" podía tirar
    // `stale element` a mitad de tipeo. Se espera (poll, acotado, tolerante)
    // a que la cantidad de `.dx-state-disabled`/`.dx-state-readonly` en
    // pantalla se estabilice.
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
   * clase); mientras siga roto, esto falla igual que `grid.buscar()` solo —
   * los casos automáticos (sin nombre dirigido) usan `consultarPrimero`/
   * `editarPrimero` en su lugar, que nunca buscan.
   */
  async _abrirModalPorNombre(accion, nombre, timeout = config.timeouts.explicitWaitMs) {
    logger.info(`GradosAcademicosPage: abrir modal "${accion}" para "${nombre}" (buscando)`);
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

  /**
   * Espera (poll) a que el campo `label` muestre `esperado`. Reabrir el
   * popup de consulta justo tras Guardar puede caer un instante antes de
   * que el valor recién guardado termine de renderizar (confirmado con
   * evidencia real: una lectura inmediata devolvía vacío) — mismo criterio
   * que `esperarValor` en `ConfiguracionEntidadDetallePage`.
   */
  async esperarValor(label, esperado, timeout = config.timeouts.explicitWaitMs) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = (await this.getValor(label)).trim();
        return textoIgual(actual, String(esperado));
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
    logger.info(`GradosAcademicosPage: completar popup desde Execution Context (caso="${caso}")`);
    await this.form.validarControlesDeclarados(ESTRATEGIAS, { etiqueta: 'grado-academico' });
    const val = (label) => testContext.get(caso, label);
    const resultado = {};

    for (const label of Object.keys(ESTRATEGIAS)) {
      if (!(await this.form.estaVacio(label))) {
        logger.info(`GradosAcademicosPage: "${label}" ya tiene datos, no se sobreescribe`);
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
  /** Datos de referencia para el flujo: el nombre que tiene el modal al guardar. */
  async _datosFlujo() {
    const nombre = String(await this.form.getValor('Nombre')).trim();
    return nombre ? { nombre } : null;
  }

  async guardar() {
    logger.info('GradosAcademicosPage: Guardar');
    const btn = await this.driver.wait(require('selenium-webdriver').until.elementLocated(this.btnGuardar), config.timeouts.explicitWaitMs);
    await this.driver.executeScript('arguments[0].click()', btn);
  }

  /** Clasifica el resultado tras Guardar según el notify (mismo mecanismo que el resto del framework). */
  async resultadoGuardado(timeoutMs = config.timeouts.explicitWaitMs) {
    const texto = await this.notify.esperarTexto(timeoutMs);
    return Notify.clasificar(texto);
  }
}

module.exports = GradosAcademicosPage;
