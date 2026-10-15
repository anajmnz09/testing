const { By } = require('selenium-webdriver');
const { BasePage, Form, Notify } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Pantalla "Agregar Seguro" de la sección "Seguros" (Recursos humanos) del detalle de Empleado (botón "Agregar" de la barra).
 *
 * Confirmado con Selenium real (2026-10-13): "Agregar" NAVEGA a una pantalla propia (`.seguro-create-page`, título `h2.record-name` =
 * "Agregar Seguro") con "Guardar" / "Descartar" en la cabecera y un dxForm cuyos campos (`.seguros-form-input.dx-field-item`) `Form`
 * reconoce con su convención estándar:
 *   Proveedor de seguros *  directSelect (catálogo: ARS Universal, ARS Senasa, ARS Humano…)
 *   Plan de seguro *        directSelect (los planes del proveedor elegido; ver más abajo)
 *   Tarifa                  dx-numberbox DESHABILITADO: la app lo calcula al elegir el plan (p. ej. RD$ 1,631)
 *   Comentario              text (dx-textarea)
 *   Estado                  dx-selectbox DESHABILITADO ("Activo"): lo fija la app
 *   % Empresa / % Empleado  dx-numberbox DESHABILITADOS: los calcula la app con el plan (p. ej. 100 / 0)
 * Tarifa, Estado y los dos porcentajes nunca se escriben (se verifican en el grid).
 */
const ESTRATEGIAS = {
  // Proveedor y Plan se eligen de catálogos de Configuración sin que un test del flujo tenga que crearlos (este test crea la
  // ASIGNACIÓN `seguro-empleado`): `sinRequires` evita que "Plan de seguro" los convierta en `requires plan-de-seguro`.
  'Proveedor de seguros': { estrategia: 'directSelect', sinRequires: true },
  'Plan de seguro': { estrategia: 'directSelect', sinRequires: true },
  Tarifa: 'text',
  // Texto libre con fuente declarada (mecanismo común `core/utils/datos`). Único por corrida: identifica la fila en el grid.
  Comentario: { estrategia: 'text', dato: { fuente: 'seguro.comentario', unico: true } },
  Estado: 'text',
  '% Empresa': 'text',
  '% Empleado': 'text',
};

// La app los fija o calcula (deshabilitados): nunca se escriben.
const CAMPOS_CALCULADOS = ['Tarifa', 'Estado', '% Empresa', '% Empleado'];

class SeguroFormPage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). Su guardado confirmado publica el seguro del empleado con su comentario
   * (único por corrida: lo que el grid de "Seguros" muestra para ubicar la fila). Es la ASIGNACIÓN de un plan a un empleado, no el
   * plan (catálogo de Configuración).
   */
  static get ENTIDAD_FLUJO() {
    return { tipo: 'seguro-empleado', referencia: 'comentario', metodos: [], confirmadores: [{ metodo: 'guardar', leer: 'antes' }] };
  }

  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    this.pagina = By.css('.seguro-create-page');
    this.btnGuardar = By.xpath("//*[contains(@class,'seguro-create-page')]//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(this.pagina, timeout);
    await this.waitVisible(By.css('.seguro-create-page textarea'), timeout);
    await this.esperarSinLoader().catch(() => {});
    return this;
  }

  /** True si la pantalla "Agregar Seguro" sigue abierta. */
  async _abierta() {
    const els = await this.driver.findElements(this.pagina);
    for (const e of els) if (await e.isDisplayed().catch(() => false)) return true;
    return false;
  }

  /**
   * Elige el proveedor y luego el plan del alta tomando, de cada banco (`datos`), el primer candidato que EXISTA en el catálogo de la
   * app (los planes dependen del proveedor elegido, por eso va en ese orden). Delega en `Form.elegirDelCatalogo`.
   * @param {() => string} siguienteProveedor  p. ej. `() => datos.resolver('seguro.proveedor')`
   * @param {() => string} siguientePlan        p. ej. `() => datos.resolver('seguro.plan')`
   * @returns {Promise<{ proveedor: string, plan: string }>} los textos REALES elegidos
   */
  async elegirProveedorYPlan(siguienteProveedor, siguientePlan) {
    const proveedor = await this.form.elegirDelCatalogo('Proveedor de seguros', siguienteProveedor);
    await this.form.seleccionar('Proveedor de seguros', proveedor);
    await this.esperarSinLoader().catch(() => {});
    const plan = await this.form.elegirDelCatalogo('Plan de seguro', siguientePlan);
    return { proveedor, plan };
  }

  /** Llena el form desde `valores` (`{ label: valor }`); los campos calculados por la app nunca se escriben. */
  async completar(valores = {}, { autofill = false } = {}) {
    await this.form.validarControlesDeclarados(ESTRATEGIAS, { etiqueta: 'Agregar Seguro', estricta: true });
    return this.form.completarDesde(ESTRATEGIAS, valores, { autofill, excepto: CAMPOS_CALCULADOS });
  }

  /** Datos de referencia para el flujo: el comentario (único) del seguro al guardar. */
  async _datosFlujo() {
    const comentario = String(await this.form.getValor('Comentario').catch(() => '')).trim();
    return comentario ? { comentario } : null;
  }

  /**
   * Click en "Guardar" y clasificación del resultado: éxito = la pantalla se cerró (vuelve a "Seguros") y no hay notify de error.
   * Devuelve `{ exito, invalido, notify, cerrado }`; el test decide el assert.
   */
  async guardar() {
    await this.esperarSinLoader().catch(() => {});
    let notify = '';
    let cerrado = false;
    for (let intento = 1; intento <= 2 && !cerrado && !notify; intento += 1) {
      const btn = await this.waitVisible(this.btnGuardar);
      await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"});arguments[0].click()', btn);
      cerrado = await this.driver
        .wait(async () => {
          if (!(await this._abierta())) return true;
          notify = await this.notify.esperarTexto(500).catch(() => '');
          return !!notify;
        }, intento === 1 ? 10000 : 15000)
        .then(() => true)
        .catch(() => false);
      if (!cerrado && !notify) logger.info(`SeguroFormPage: "Guardar" sin efecto (intento ${intento}/2), reintentando`);
    }
    if (!notify) notify = await this.notify.esperarTexto(3000).catch(() => '');
    const formCerrado = !(await this._abierta());
    if (notify) return { ...Notify.clasificar(notify), cerrado: formCerrado };
    return { notify: '', exito: formCerrado, invalido: !formCerrado, errorSistema: false, cerrado: formCerrado };
  }
}

module.exports = SeguroFormPage;
