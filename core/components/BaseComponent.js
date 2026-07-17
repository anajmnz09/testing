const UiContext = require('../utils/UiContext');

/**
 * Base de todos los Componentes reutilizables (widgets que se repiten en muchas
 * pantallas: NavBar, DataGrid, DropDown, NotifyToast, etc.).
 *
 * A diferencia de un Page Object (que representa una pantalla), un componente
 * representa un widget y suele estar acotado a un elemento raíz — por eso acepta
 * un `root` opcional. Los componentes concretos se agregan en la Fase 3; esta
 * base ya deja el patrón listo para que los compongan las páginas.
 */
class BaseComponent extends UiContext {
  /**
   * @param driver WebDriver activo.
   * @param root   (opcional) WebElement raíz al que está acotado el componente
   *               (por ejemplo, una fila de un grid). Puede quedar null cuando el
   *               componente es único en la página (ej. el NavBar).
   */
  constructor(driver, root = null) {
    super(driver);
    this.root = root;
  }
}

module.exports = BaseComponent;
