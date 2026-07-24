const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const FormsHeader = require('@triple/core/components/FormsHeader');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

// Patrón del botón "Pausar" del header. Se busca por NOMBRE ACCESIBLE
// (title/aria-label/alt del ícono), nunca por el base64 de la imagen.
const PATRON_PAUSAR = 'pausar|pausa';

// Switch "Publicada" del header. La etiqueta real es "Publicada:" (con dos
// puntos) y su contenedor propio es `group-field-3 grupo-publicada` — ambos
// verificados en el DOM real. El contenedor es la vía más estable y evita
// confundirlo con el switch "Rotativo:" del mismo header.
const PATRON_PUBLICADA = '^\\s*publicada\\s*:?\\s*$';
const OPCIONES_SWITCH_PUBLICADA = {
  contenedor: '[class*="grupo-publicada"]',
  dataQa: 'switch-publicada',
};

// Compartir (botón `CompartirButton_*` del header). Se localiza por su CLASE
// estable y distintiva —no por nombre accesible—: el tooltip del botón cambia
// según el estado (publicada: "Copiar enlace…"; no publicada: "Habilite la
// opción 'Publicada'…"), así que un match por nombre sería frágil. Todos los
// selectores están verificados contra el DOM real de la app.
const SEL_COMPARTIR = {
  boton: '[class*="CompartirButton"]',
  clickable: '[class*="documentoButton"]',
  tooltip: '[class*="compartir_btn_tooltip_text"]',
  popup: '[class*="compartir_modal"]',
  titulo: 'Compartir enlace público de la vacante',
  enlace: '[class*="link_input_field"]',
  copiar: '[class*="copy_badge_btn"]',
};

/**
 * Vista de detalle de una requisición (se abre con doble-click en la fila del
 * grid). Usa la misma estructura group-field que el formulario de creación, así
 * que reutiliza el componente Form del core para leer los valores.
 */
class RequisicionDetallePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    // header de la pantalla de requisición (contiene el switch "Publicada")
    this.header = By.css('[class*="requisicion-header"], [class*="forms-header"]');
    // mismo header, como COMPONENTE del core: expone sus acciones (botones
    // Pausar/Editar/Cerrar y el switch "Publicada") sin duplicar acá la mecánica
    // de localizarlos. Usa el selector por defecto de FormsHeader, que ya cubre
    // `forms-header` y `requisicion-header`.
    this.acciones = new FormsHeader(driver);
  }

  async estaCargado() {
    await this.waitVisible(By.xpath("//label[contains(normalize-space(.),'Nombre de requisición')]"));
    return this;
  }

  /**
   * Espera a que el detalle esté COMPLETAMENTE cargado: formulario presente, sin
   * overlay de carga, header de acciones visible y el campo "Nombre de
   * requisición" ya con su valor (la app pinta el formulario antes de traer los
   * datos). Todo con esperas explícitas del framework, sin sleeps.
   */
  async esperarCargaCompleta(timeout = config.timeouts.explicitWaitMs) {
    await this.estaCargado();
    await this.esperarSinLoader(timeout);
    await this.acciones.listo(timeout);
    await this.driver
      .wait(async () => !!(await this.getNombre()), timeout)
      .catch(() => {});
    logger.info('RequisicionDetallePage: detalle cargado por completo');
    return this;
  }

  getNombre() {
    return this.form.getValor('Nombre de requisición');
  }
  getRequisitos() {
    return this.form.getValor('Requisitos');
  }
  getResponsabilidades() {
    return this.form.getValor('Responsabilidades');
  }
  getDescripcion() {
    return this.form.getValor('Descripción');
  }
  getComentario() {
    return this.form.getValor('Comentario');
  }
  getEstado() {
    return this.form.getValor('Estado');
  }

  // -------------------------------------------------------------------------
  // Publicación (switch "Publicada" del header `forms-header requisicion-header`)
  // -------------------------------------------------------------------------

  /**
   * Ubica el switch asociado al label "Publicada" y lo marca con data-qa.
   *
   * La mecánica (contenedor propio → etiqueta → subir hasta el `.dx-switch` más
   * cercano) se consolidó en el componente `FormsHeader` del core, porque los
   * switches de header se repiten en toda la app. Acá solo queda lo ESPECÍFICO
   * de esta pantalla: qué etiqueta buscar y cuál es su contenedor propio
   * (verificado en el DOM real: `<div class="group-field-3 grupo-publicada">`,
   * que además evita confundirlo con el switch "Rotativo:").
   *
   * @returns {Promise<{encontrado:boolean, encendido:boolean|null, deshabilitado:boolean|null}>}
   */
  async _ubicarSwitchPublicada() {
    return this.acciones.ubicarSwitch(PATRON_PUBLICADA, OPCIONES_SWITCH_PUBLICADA);
  }

  /**
   * Espera a que el switch "Publicada" exista en el header.
   * `obligatorio: true` mantiene el comportamiento anterior: si no aparece, se
   * lanza (la ausencia del switch en el detalle es un fallo, no un dato).
   */
  async esperarSwitchPublicada(timeout = config.timeouts.explicitWaitMs) {
    return this.acciones.esperarSwitch(PATRON_PUBLICADA, {
      ...OPCIONES_SWITCH_PUBLICADA,
      timeout,
      obligatorio: true,
    });
  }

  /** True si la requisición ya está publicada (switch encendido). */
  async estaPublicada() {
    const info = await this.esperarSwitchPublicada();
    return info.encendido === true;
  }

  /**
   * Activa el switch "Publicada" y devuelve el resultado del notify.
   * No hace nada si ya estaba encendido.
   *
   * El click por JS (el header es sticky y el navbar puede interceptar el click
   * nativo) y la espera del notify viven ahora en `FormsHeader.encenderSwitch`.
   * @returns {Promise<{yaEstaba:boolean, notify:string, exito:boolean, invalido:boolean, errorSistema:boolean}>}
   */
  async publicar() {
    // Se conserva la espera OBLIGATORIA previa: si el switch no está, se lanza.
    await this.esperarSwitchPublicada();
    logger.info('RequisicionDetallePage: activando switch "Publicada"');
    return this.acciones.encenderSwitch(PATRON_PUBLICADA, {
      ...OPCIONES_SWITCH_PUBLICADA,
      etiqueta: 'Publicada',
    });
  }

  /**
   * True si el switch quedó encendido. Se re-consulta el DOM (no se cachea) para
   * validar el estado REAL tras publicar.
   */
  async publicadaConfirmada(timeout = config.timeouts.explicitWaitMs) {
    return this.acciones.esperarEstadoSwitch(PATRON_PUBLICADA, true, {
      ...OPCIONES_SWITCH_PUBLICADA,
      timeout,
    });
  }

  // -------------------------------------------------------------------------
  // Pausar (botón del header `forms-header requisicion-header`)
  // -------------------------------------------------------------------------

  /**
   * Diagnóstico del botón "Pausar": si existe, cómo se localizó y si está
   * habilitado. No lanza: el test decide el assert y el mensaje.
   */
  async buscarBotonPausar(timeout = config.timeouts.explicitWaitMs) {
    return this.acciones.esperarBoton(PATRON_PAUSAR, { timeout, dataQa: 'boton-pausar' });
  }

  /** True si el botón "Pausar" está disponible en el header. */
  async puedePausar(timeout = config.timeouts.explicitWaitMs) {
    const info = await this.buscarBotonPausar(timeout);
    return info.encontrado === true && info.deshabilitado !== true;
  }

  /**
   * Pausa la requisición y devuelve el resultado del notify de la app.
   * @returns {Promise<{encontrado:boolean, via?:string, nombre?:string, deshabilitado?:boolean,
   *                    notify:string, exito:boolean, invalido:boolean, errorSistema:boolean, botones:Array}>}
   */
  async pausar(timeout = config.timeouts.explicitWaitMs) {
    logger.info('RequisicionDetallePage: pausando la requisición');
    return this.acciones.accionar(PATRON_PAUSAR, {
      etiqueta: 'Pausar',
      timeout,
      dataQa: 'boton-pausar',
    });
  }

  /** Acciones que ofrece el header (para adjuntar como evidencia si algo falla). */
  async accionesDelHeader() {
    return this.acciones.acciones();
  }

  // -------------------------------------------------------------------------
  // Compartir — enlace público de la vacante (botón `CompartirButton_*`)
  // -------------------------------------------------------------------------

  /**
   * Estado del botón "Compartir". El tooltip refleja el estado REAL de la app:
   *  - publicada    -> "Copiar enlace al formulario de solicitud externa."
   *  - no publicada -> "Habilite la opción 'Publicada' para poder compartir…"
   * No lanza: devuelve diagnóstico { encontrado, habilitado, tooltip }.
   */
  async estadoCompartir() {
    return this.driver.executeScript((sel) => {
      const txt = (e) => ((e && e.textContent) || '').replace(/\s+/g, ' ').trim();
      const cont = document.querySelector(sel.boton);
      if (!cont) return { encontrado: false, habilitado: false, tooltip: null };
      const btn = cont.querySelector(sel.clickable) || cont;
      const cls = `${cont.className || ''} ${btn.className || ''}`;
      const tip = document.querySelector(sel.tooltip);
      return {
        encontrado: true,
        habilitado: !/disabled|state-disabled/i.test(cls),
        tooltip: tip ? txt(tip) : null,
      };
    }, SEL_COMPARTIR);
  }

  /** True si el popup "Compartir enlace público de la vacante" está visible. */
  async popupCompartirVisible() {
    return this.driver.executeScript((sel) => {
      const vis = (e) => e && e.offsetWidth > 0 && e.offsetHeight > 0;
      const modal = document.querySelector(sel.popup);
      if (modal && vis(modal)) return true;
      return Array.from(document.querySelectorAll('*')).some(
        (e) => vis(e) && new RegExp(sel.titulo, 'i').test((e.textContent || '').trim())
      );
    }, SEL_COMPARTIR);
  }

  /**
   * Clickea "Compartir" y espera (acotado) a que aparezca el popup. NO lanza:
   * devuelve si el popup se abrió. Un botón deshabilitado (requisición no
   * publicada) no lo abre — ese es el bloqueo esperado.
   */
  async abrirCompartir(timeout = config.timeouts.explicitWaitMs) {
    logger.info('RequisicionDetallePage: intentando abrir Compartir');
    await this.driver.executeScript((sel) => {
      const cont = document.querySelector(sel.boton);
      if (!cont) return;
      const btn = cont.querySelector(sel.clickable) || cont;
      btn.scrollIntoView({ block: 'center' });
      btn.click();
    }, SEL_COMPARTIR);

    let abierto = false;
    await this.driver
      .wait(async () => {
        abierto = await this.popupCompartirVisible();
        return abierto;
      }, timeout)
      .catch(() => {});
    return abierto;
  }

  /** Enlace público mostrado en el popup de Compartir (texto del campo). */
  async getEnlaceCompartido() {
    return this.driver.executeScript((sel) => {
      const f = document.querySelector(sel.enlace);
      return f ? (f.textContent || f.value || '').trim() : null;
    }, SEL_COMPARTIR);
  }

  /**
   * Clickea "Copiar" en el popup y devuelve el resultado del notify de la app.
   * El texto de éxito real es "Enlace copiado al portapapeles".
   */
  async copiarEnlace(timeout = config.timeouts.explicitWaitMs) {
    logger.info('RequisicionDetallePage: copiar enlace público');
    await this.driver.executeScript((sel) => {
      const b = document.querySelector(sel.copiar);
      if (b) b.click();
    }, SEL_COMPARTIR);
    return this.notify.esperarResultado(timeout);
  }

  /**
   * True si la vista de detalle contiene `texto` en la sección de preguntas
   * personalizadas. El grid de preguntas está debajo del fold, así que primero
   * se scrollea al fondo para asegurar que esté renderizado.
   */
  async tienePreguntaPersonalizada(texto) {
    await this.driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
    return this.driver.wait(async () => {
      return this.driver.executeScript(
        (t) => (document.body.innerText || '').includes(t),
        texto
      );
    }, 6000).catch(() => false);
  }
}

module.exports = RequisicionDetallePage;
