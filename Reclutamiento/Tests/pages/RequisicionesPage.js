const { BasePage, DataGrid } = require('@triple/core');
const logger = require('@triple/core/utils/logger');

/**
 * Page Object PROPIO del módulo Reclutamiento (pantalla de Requisiciones).
 *
 * Es la plantilla de cómo se construye una página de módulo:
 *  - Extiende BasePage del core (hereda los helpers de interacción).
 *  - COMPONE los componentes reutilizables del core (aquí, DataGrid). No
 *    reimplementa buscar/paginar/contar: los delega en el componente.
 *  - Expone métodos con LENGUAJE DE NEGOCIO (buscarRequisicion, existeRequisicion…)
 *    para que los tests describan el flujo, no la mecánica del grid.
 *
 * Los locators específicos del módulo (secciones del menú superior, campos del
 * formulario de creación, columnas particulares, etc.) se irán agregando acá a
 * medida que crezcan las pruebas de Reclutamiento.
 */
class RequisicionesPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.grid = new DataGrid(driver);
  }

  /** Espera a que el listado de requisiciones esté cargado. Encadenable. */
  async listo() {
    await this.grid.listo();
    logger.info('RequisicionesPage: listado cargado');
    return this;
  }

  /** Filtra el listado por un texto (código, nombre, departamento, etc.). */
  async buscarRequisicion(texto) {
    await this.grid.buscar(texto);
  }

  /** True si existe una requisición que contenga `texto` en el listado. */
  async existeRequisicion(texto) {
    return this.grid.existeFila(texto);
  }

  /** Cantidad de requisiciones visibles en la página actual. */
  async contarRequisiciones() {
    return this.grid.contarFilas();
  }

  /** Abre una requisición haciendo click en su fila. */
  async abrirRequisicion(texto) {
    await this.grid.clickFila(texto);
  }

  /** Abre el formulario para crear una nueva requisición. */
  async crearRequisicion() {
    await this.grid.crear();
  }

  /** Texto del pie de paginación del listado. */
  async getResumenPaginacion() {
    return this.grid.getInfoPaginacion();
  }
}

module.exports = RequisicionesPage;
