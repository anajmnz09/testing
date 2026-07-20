const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

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
  }

  async estaCargado() {
    await this.waitVisible(By.xpath("//label[contains(normalize-space(.),'Nombre de requisición')]"));
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
   * Ubica el switch asociado al label "Publicada" y lo marca con data-qa para
   * poder operarlo después. La búsqueda es ESTRUCTURA-AGNÓSTICA: parte del label
   * y sube hasta encontrar el `.dx-switch` más cercano, así no se rompe si
   * cambia el anidamiento interno del header.
   * @returns {Promise<{encontrado:boolean, encendido:boolean|null}>}
   */
  async _ubicarSwitchPublicada() {
    return this.driver.executeScript(() => {
      const prev = document.querySelector('[data-qa="switch-publicada"]');
      if (prev) prev.removeAttribute('data-qa');

      const marcar = (sw) => {
        if (!sw) return null;
        sw.setAttribute('data-qa', 'switch-publicada');
        const cls = sw.className || '';
        return {
          encontrado: true,
          // DevExtreme expone el estado por aria-pressed y por clase: se leen ambos
          encendido: sw.getAttribute('aria-pressed') === 'true' || /dx-switch-on-value/.test(cls),
          deshabilitado: /dx-state-disabled/.test(cls),
        };
      };

      // 1) Vía primaria: contenedor propio del switch de publicación.
      //    Verificado en el DOM real: <div class="group-field-3 grupo-publicada">.
      //    Es el locator más estable y evita confundirlo con el switch "Rotativo:".
      const porContenedor = document.querySelector('[class*="grupo-publicada"] .dx-switch');
      if (porContenedor) return marcar(porContenedor);

      // 2) Fallback: partir del label y subir hasta el .dx-switch más cercano.
      //    El label real es "Publicada:" (con dos puntos), por eso se normaliza.
      const esLabelPublicada = (e) => /^publicada\s*:?\s*$/i.test((e.textContent || '').trim());
      const candidatos = Array.from(document.querySelectorAll('label, span, div')).filter(esLabelPublicada);
      for (let i = candidatos.length - 1; i >= 0; i--) {
        let cont = candidatos[i].parentElement;
        let sw = null;
        for (let k = 0; k < 6 && cont && !sw; k++) {
          sw = cont.querySelector('.dx-switch');
          if (!sw) cont = cont.parentElement;
        }
        if (sw) return marcar(sw);
      }
      return { encontrado: false, encendido: null, deshabilitado: null };
    });
  }

  /** Espera a que el switch "Publicada" exista en el header. */
  async esperarSwitchPublicada(timeout = config.timeouts.explicitWaitMs) {
    let info = { encontrado: false, encendido: null };
    await this.driver.wait(async () => {
      info = await this._ubicarSwitchPublicada();
      return info.encontrado;
    }, timeout);
    return info;
  }

  /** True si la requisición ya está publicada (switch encendido). */
  async estaPublicada() {
    const info = await this.esperarSwitchPublicada();
    return info.encendido === true;
  }

  /**
   * Activa el switch "Publicada" (click por JS: el header es sticky y el navbar
   * puede interceptar el click nativo) y devuelve el resultado del notify.
   * No hace nada si ya estaba encendido.
   * @returns {Promise<{yaEstaba:boolean, notify:string, exito:boolean, invalido:boolean, errorSistema:boolean}>}
   */
  async publicar() {
    const info = await this.esperarSwitchPublicada();
    if (info.encendido) {
      logger.info('RequisicionDetallePage: la requisición ya estaba publicada');
      return { yaEstaba: true, ...Notify.clasificar('') };
    }
    logger.info('RequisicionDetallePage: activando switch "Publicada"');
    const sw = await this.driver.findElement(By.css('[data-qa="switch-publicada"]'));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', sw);
    await this.driver.executeScript('arguments[0].click()', sw);
    const resultado = await this.notify.esperarResultado();
    return { yaEstaba: false, ...resultado };
  }

  /**
   * True si el switch quedó encendido. Se re-consulta el DOM (no se cachea) para
   * validar el estado REAL tras publicar.
   */
  async publicadaConfirmada(timeout = config.timeouts.explicitWaitMs) {
    let encendido = false;
    await this.driver
      .wait(async () => {
        const info = await this._ubicarSwitchPublicada();
        encendido = info.encendido === true;
        return encendido;
      }, timeout)
      .catch(() => {});
    return encendido;
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
