const { By } = require('selenium-webdriver');
const { BasePage, Form, Notify } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Pantalla "Crear Beneficio" de la sección "Beneficios" (Recursos humanos) del detalle de Empleado (botón "Agregar" de la barra).
 *
 * Confirmado con Selenium real (2026-10-13): "Agregar" NAVEGA a una pantalla propia (`.beneficio-empleado-create`, título
 * `h2.record-name` = "Crear Beneficio") con "Guardar" / "Descartar" en la cabecera y un form (`.beneficio-empleado-form`) cuyos
 * campos viven en `.beneficio-form-input` (`<label>` + editor, sin clase de campo reconocida: `Form` los ubica con su convención
 * genérica, `soloGenerica`; por eso `controlesVisibles()` no los inventaría y no se llama `validarControlesDeclarados`):
 *   Beneficio *       directSelect (dx-selectbox de solo lectura) — catálogo de Configuración > Beneficios
 *   Monto *           text (dx-numberbox, mínimo 1)
 *   Estado            dx-textbox DESHABILITADO ("Activo"): lo fija la app, nunca se escribe
 *   Comentario        text (dx-textarea)
 *   Fecha Inicial *   datePicker (dx-datebox, vacía)
 *   Fecha Final       datePicker (dx-datebox, opcional)
 */
const ESTRATEGIAS = {
  // Elige del catálogo de Configuración > Beneficios sin necesitar que un test del flujo lo cree (este mismo test crea la ASIGNACIÓN
  // `beneficio-empleado`): `sinRequires` evita que el label "Beneficio" lo convierta en `requires beneficio`.
  Beneficio: { estrategia: 'directSelect', sinRequires: true },
  Monto: 'text',
  Estado: 'text',
  // Texto libre con fuente declarada (mecanismo común `core/utils/datos`). Única por corrida: identifica la fila en el grid.
  Comentario: { estrategia: 'text', dato: { fuente: 'beneficio.comentario', unico: true } },
  'Fecha Inicial': 'datePicker',
  'Fecha Final': 'datePicker',
};

// Estado lo fija la app (deshabilitado, "Activo"): nunca se escribe, igual que los campos calculados de otros formularios.
const CAMPOS_FIJOS = ['Estado'];

class BeneficioFormPage extends BasePage {
  /**
   * Contrato de entidad para FLUJOS (ver GUIDELINES §12). Su guardado confirmado publica el beneficio del empleado con su comentario
   * (único por corrida: lo que el grid de "Beneficios" muestra para ubicar la fila). Distinto de la entidad `beneficio` (catálogo de
   * Configuración): este es la asignación de un beneficio a un empleado.
   */
  static get ENTIDAD_FLUJO() {
    return { tipo: 'beneficio-empleado', referencia: 'comentario', metodos: [], confirmadores: [{ metodo: 'guardar', leer: 'antes' }] };
  }

  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.form.soloGenerica = true; // campos `<label>` + editor sin clase de campo reconocida: ver `Form._elemCampo`
    this.notify = new Notify(driver);
    this.pagina = By.css('.beneficio-empleado-create');
    this.btnGuardar = By.xpath("//*[contains(@class,'beneficio-empleado-create')]//*[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(this.pagina, timeout);
    await this.waitVisible(By.css('.beneficio-empleado-form textarea'), timeout);
    await this.esperarSinLoader().catch(() => {});
    return this;
  }

  /** True si la pantalla "Crear Beneficio" sigue abierta. */
  async _abierta() {
    const els = await this.driver.findElements(this.pagina);
    for (const e of els) if (await e.isDisplayed().catch(() => false)) return true;
    return false;
  }

  /**
   * Elige el tipo de beneficio del alta: el PRIMER candidato de `siguienteCandidato()` que EXISTA en el catálogo de la app (el
   * Beneficio se administra en Configuración: un candidato del banco que no esté ahí se salta). Delega en `Form.elegirDelCatalogo`.
   * @param {() => string} siguienteCandidato  p. ej. `() => datos.resolver('beneficio.tipo')`
   * @returns {Promise<string>} el texto REAL de la opción elegida en el catálogo
   */
  async elegirBeneficioDelCatalogo(siguienteCandidato, intentos = 30) {
    return this.form.elegirDelCatalogo('Beneficio', siguienteCandidato, { intentos });
  }

  /** Llena el form desde `valores` (`{ label: valor }`); "Estado" nunca se escribe. */
  async completar(valores = {}, { autofill = false } = {}) {
    return this.form.completarDesde(ESTRATEGIAS, valores, { autofill, excepto: CAMPOS_FIJOS });
  }

  /** Datos de referencia para el flujo: el comentario (único) del beneficio al guardar. */
  async _datosFlujo() {
    const comentario = String(await this.form.getValor('Comentario').catch(() => '')).trim();
    return comentario ? { comentario } : null;
  }

  /**
   * Click en "Guardar" y clasificación del resultado: éxito = la pantalla se cerró (vuelve a "Beneficios") y no hay notify de error.
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
      if (!cerrado && !notify) logger.info(`BeneficioFormPage: "Guardar" sin efecto (intento ${intento}/2), reintentando`);
    }
    if (!notify) notify = await this.notify.esperarTexto(3000).catch(() => '');
    const formCerrado = !(await this._abierta());
    if (notify) return { ...Notify.clasificar(notify), cerrado: formCerrado };
    return { notify: '', exito: formCerrado, invalido: !formCerrado, errorSistema: false, cerrado: formCerrado };
  }
}

module.exports = BeneficioFormPage;
