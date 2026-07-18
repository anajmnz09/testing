const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');

/**
 * Vista de detalle de una requisición (se abre con doble-click en la fila del
 * grid). Usa la misma estructura group-field que el formulario de creación, así
 * que reutiliza el componente Form del core para leer los valores.
 */
class RequisicionDetallePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
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
