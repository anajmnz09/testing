const { By } = require('selenium-webdriver');
const { BasePage, DataGrid } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Popup = require('@triple/core/components/Popup');
const Notify = require('@triple/core/components/Notify');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Page Object de la pantalla PRINCIPAL del módulo Nómina (se llega por la
 * card "Nómina" del dashboard o por el dropdown de módulos del navbar —
 * `navigationFlow.abrirModulo`/`SRHHNavBar.irAModulo`, ambos del core, no
 * reimplementados acá).
 *
 * Selectores verificados por inspección real (Selenium Headed) contra
 * `https://test.triple.com.do/`:
 *  - Título de pantalla: `[class*="SrhhGenericBar_title"]` = "Nóminas" (NO
 *    `SRHHNavBar.tituloSeccion`: ese XPath absoluto da `null` en esta
 *    pantalla, igual que ya le pasa a `ConfiguracionesPage`).
 *  - Primer grid (arriba): listado genérico en CardView por defecto, con
 *    toggle a "Modo lista" (`DataGrid.asegurarModoLista`, sin tocar). NO
 *    interviene en este Page Object porque el caso de uso actual (asignar
 *    empleados a nómina) solo necesita el segundo grid.
 *  - Segundo grid: "Empleados de Nuevo Ingreso" — contenedor con id REAL
 *    `#EmpleadosNuevoIngresoDataGrid`. Columnas confirmadas: "" (checkbox de
 *    selección), "Código", "Empleado", "Departamento", "Puesto",
 *    "Sueldo Base", "Tipo de contrato", "Forma de pago", "Fecha de ingreso".
 *    Tiene fila de filtros por columna (`DataGrid.filtrarPorColumna`).
 *  - Botón "Asignar a Nómina": id REAL `#BtnANomina`, hermano del título
 *    `<h2>Empleados de Nuevo Ingreso</h2>` (pertenece al HEADER de la
 *    sección, no a una fila del grid).
 *  - Modal de asignación: "Asignar Empleados a Nómina" — NO es un overlay
 *    DevExtreme estándar (`.dx-popup-wrapper`/`.dx-overlay-wrapper`), es un
 *    componente propio de la app (clase CSS-modules `ModalAssignEmpleado_*`,
 *    identificado por su PREFIJO estable, mismo criterio que
 *    `[class*="SrhhGenericBar_title"]`/`[class*="documentoButton"]` en el
 *    resto del framework — nunca el hash completo). Contenido confirmado:
 *    "Empleado(s) seleccionado(s): <nombre(s)>", un selectbox "Seleccionar
 *    Nómina" (SIN label propio, se opera por locator) y los botones
 *    "Guardar"/"Descartar".
 *  - Tras "Guardar" aparece una SEGUNDA confirmación — esta sí un overlay
 *    DevExtreme ESTÁNDAR (`.dx-popup-wrapper.confirmPopup`, clase semántica
 *    estable, no hasheada): "¿Está seguro de que desea realizar esta
 *    operación?" con botones "Aceptar"/"Cancelar". Confirmado con Selenium
 *    real (y por el usuario, probándolo a mano) que hay que aceptarla para
 *    que la asignación se complete.
 *
 * ESTA pantalla tiene MÁS DE UN `.dx-datagrid` visible a la vez (el de
 * arriba + "Empleados de Nuevo Ingreso"), por eso `DataGrid` se instancia
 * acá SIEMPRE con `contenedor` (soporte agregado al componente del core
 * para este caso, retrocompatible — ver `core/components/DataGrid.js`).
 */
const SEL = {
  titulo: '[class*="SrhhGenericBar_title"]',
  gridNuevoIngreso: '#EmpleadosNuevoIngresoDataGrid',
  botonAsignar: '#BtnANomina',
  modalAsignar: '[class*="ModalAssignEmpleado"]',
  selectboxNomina: '[class*="ModalAssignEmpleado"] .dx-selectbox',
  confirmacionGuardar: '.dx-popup-wrapper.confirmPopup',
};

class NominaPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    this.gridNuevoIngreso = new DataGrid(driver, { contenedor: SEL.gridNuevoIngreso });
    // El modal de asignación reutiliza el componente `Popup` del core (ya
    // sabe esperar visible/cerrado y ubicar un botón por nombre accesible
    // sin adivinar), solo con SU PROPIO selector de overlay en vez del
    // default `.dx-popup-wrapper`/`.dx-overlay-wrapper`.
    this.popupAsignar = new Popup(driver, { selector: SEL.modalAsignar });
    // Confirmación posterior a "Guardar": overlay DevExtreme ESTÁNDAR, así
    // que acá sí alcanza con el `Popup` genérico (sin selector propio).
    this.popupConfirmarGuardar = new Popup(driver, { selector: SEL.confirmacionGuardar });
  }

  /** Espera a que la pantalla principal de Nómina esté cargada. Encadenable. */
  async estaCargado(timeout = config.timeouts.explicitWaitMs) {
    await this.waitVisible(By.css(SEL.titulo), timeout);
    await this.waitVisible(By.css(SEL.gridNuevoIngreso), timeout);
    await this.esperarSinLoader(timeout);
    logger.info('NominaPage: cargada');
    return this;
  }

  /** Texto real del título de la pantalla ("Nóminas"). */
  async getTitulo() {
    return (await this.getText(By.css(SEL.titulo))).trim();
  }

  /** Dentro de la pantalla ya cargada: deja listo el listado "Empleados de Nuevo Ingreso". */
  async irAEmpleadosNuevoIngreso() {
    await this.gridNuevoIngreso.listo();
    logger.info('NominaPage: "Empleados de Nuevo Ingreso" listo');
    return this.gridNuevoIngreso;
  }

  /**
   * Selecciona (checkbox) el empleado con `codigo` en "Empleados de Nuevo
   * Ingreso": filtra por la columna "Código" (`DataGrid.filtrarPorColumna`,
   * genérico del core) y marca esa fila (`DataGrid.seleccionarFila`,
   * genérico del core: "fila por texto, o la primera si no se pasa
   * ninguno"). No reimplementa ninguna mecánica nueva de grid/checkbox.
   * Devuelve también el "Empleado" (nombre completo) de esa fila, para que
   * el test pueda verificar después la asignación desde el propio registro
   * del empleado en el módulo Empleados (`EmpleadoDetallePage.
   * esperarNominaAsignada`), sin tener que volver a este listado.
   * @returns {Promise<{codigo:string, nombre:string|null}>}
   */
  async seleccionarEmpleadoPorCodigo(codigo) {
    logger.info(`NominaPage: seleccionar empleado "${codigo}" en Empleados de Nuevo Ingreso`);
    await this.gridNuevoIngreso.filtrarPorColumna('Código', codigo);
    const filas = await this.gridNuevoIngreso.filasPorColumnas();
    const nombre = (filas.find((f) => f['Código'] === codigo) || {})['Empleado'] || null;

    const seleccionado = await this.gridNuevoIngreso.seleccionarFila(codigo);
    if (!seleccionado) {
      throw new Error(
        `NominaPage: no se pudo seleccionar el empleado "${codigo}" ` +
          '(no se encontró su fila/checkbox en "Empleados de Nuevo Ingreso" tras filtrar por Código).'
      );
    }
    return { codigo, nombre };
  }

  /**
   * Selecciona el PRIMER empleado disponible (modo automático, sin código
   * dirigido). Devuelve su "Código" y "Empleado" (nombre), leídos del propio
   * grid (`DataGrid.filasPorColumnas`), para que el test pueda verificar
   * después que quedó asignado — nunca se hardcodea ni se asume cuál es.
   * @returns {Promise<{codigo:string|null, nombre:string|null}>}
   */
  async seleccionarPrimerEmpleado() {
    logger.info('NominaPage: seleccionar el primer empleado disponible de Empleados de Nuevo Ingreso');
    const filas = await this.gridNuevoIngreso.filasPorColumnas();
    const codigo = filas.length ? filas[0]['Código'] || null : null;
    const nombre = filas.length ? filas[0]['Empleado'] || null : null;

    const seleccionado = await this.gridNuevoIngreso.seleccionarFila();
    if (!seleccionado) {
      throw new Error(
        'NominaPage: no se pudo seleccionar ningún empleado (el listado "Empleados de Nuevo Ingreso" ' +
          'está vacío, o no tiene checkbox de selección).'
      );
    }
    return { codigo, nombre };
  }

  /**
   * Espera (poll, re-filtrando por "Código" en cada intento — mismo criterio
   * que `DataGrid.esperarFila`) a que `codigo` YA NO figure en "Empleados de
   * Nuevo Ingreso": evidencia de PERSISTENCIA de que la asignación se aplicó
   * (el listado solo muestra empleados pendientes de asignar a una nómina).
   *
   * Timeout por defecto 60s (no los 30s de `explicitWaitMs`): confirmado con
   * evidencia real que esta propagación —backend procesando la asignación
   * antes de que el empleado salga del listado de pendientes— puede tardar
   * más de 30s; mismo criterio ya establecido en `DataGrid.esperarFila` para
   * datos que cruzan de una acción a su reflejo en un listado.
   * @returns {Promise<boolean>} true si desapareció dentro del timeout.
   */
  async esperarEmpleadoAsignado(codigo, timeout = 60000, intervalo = 2000) {
    const fin = Date.now() + timeout;
    do {
      await this.gridNuevoIngreso.filtrarPorColumna('Código', codigo);
      const cantidad = await this.gridNuevoIngreso.contarFilas(1000);
      if (cantidad === 0) return true;
      await this.driver.sleep(intervalo);
    } while (Date.now() < fin);
    return false;
  }

  /**
   * Abre el modal "Asignar Empleados a Nómina" (botón del header de la
   * sección). Click por JS, no nativo: confirmado con Selenium real que
   * `#BtnANomina` tiene una caja de click con tamaño cero para WebDriver
   * (`element not interactable: element has zero size`) pese a ser visible
   * en pantalla — mismo criterio ya establecido en el framework para botones
   * de header equivalentes (`FormsHeader.clickBoton`, `RequisicionFormPage.
   * guardar()`, etc.).
   */
  async abrirAsignacionNomina(timeout = config.timeouts.explicitWaitMs) {
    logger.info('NominaPage: abrir "Asignar a Nómina"');
    const btn = await this.waitVisible(By.css(SEL.botonAsignar), timeout);
    await this.driver.executeScript('arguments[0].click()', btn);
    await this.popupAsignar.esperarVisible(timeout);
    return this.popupAsignar;
  }

  /**
   * Elige la nómina en el selectbox del modal. Selectbox SIN label propio
   * (`group-field`/`<label>`) — se opera por LOCATOR, mismo criterio que
   * `DocumentosRequisicionPage` con la clasificación del popup "Importar
   * Documentos" (`Form.elegirEnSelectbox`, genérico del core: sin valor,
   * toma la primera opción; con valor, filtra y elige esa opción exacta).
   * @returns {Promise<string>} el texto REAL de la nómina elegida.
   */
  async seleccionarNomina(nombreNomina) {
    return this.form.elegirEnSelectbox(By.css(SEL.selectboxNomina), nombreNomina);
  }

  /**
   * Confirma la asignación: "Guardar" del modal + la SEGUNDA confirmación
   * que la app pide después ("¿Está seguro de que desea realizar esta
   * operación?" → "Aceptar"), confirmado con Selenium real (el usuario lo
   * probó a mano) que hace falta para que la asignación se complete.
   *
   * El click de "Guardar" es NATIVO a propósito (no por JS como
   * `Popup.accionar`): confirmado con Selenium real que este modal
   * —componente propio de la app, NO un overlay DevExtreme— no reacciona de
   * forma confiable a un `element.click()` sintético (mismo tipo de caso ya
   * documentado en `DataGrid.filtrarPorColumna`, que por eso usa la API de
   * Acciones en vez de un click por JS para su selectbox de filtro).
   * Reutiliza `Popup.ubicarBoton` para LOCALIZAR el botón por su nombre
   * accesible (sin duplicar esa búsqueda); solo cambia el click final.
   *
   * La confirmación posterior SÍ es un overlay DevExtreme estándar, así que
   * ahí se reutiliza `Popup.accionar` completo (localizar + click por JS,
   * que en ESE overlay sí funciona).
   */
  async confirmarAsignacion(timeout = config.timeouts.explicitWaitMs) {
    logger.info('NominaPage: confirmar asignación ("Guardar")');
    const info = await this.popupAsignar.ubicarBoton(/guardar/i);
    if (!info.encontrado || info.deshabilitado) {
      throw new Error(
        'NominaPage: no se pudo accionar "Guardar" en el modal de asignación ' +
          `(encontrado=${info.encontrado}, deshabilitado=${info.deshabilitado}). Botones: ${JSON.stringify(info.botones)}`
      );
    }
    const btn = await this.driver.findElement(By.css('[data-qa="popup-accion"]'));
    await btn.click();

    await this.popupConfirmarGuardar.esperarVisible(timeout);
    const confirmacion = await this.popupConfirmarGuardar.accionar(/aceptar/i, { etiqueta: 'Aceptar', timeout });
    if (!confirmacion.encontrado || confirmacion.deshabilitado) {
      throw new Error(
        'NominaPage: no se pudo accionar "Aceptar" en la confirmación posterior a "Guardar" ' +
          `(encontrado=${confirmacion.encontrado}, deshabilitado=${confirmacion.deshabilitado}).`
      );
    }
    return { guardar: info, confirmacion };
  }

  /**
   * Resultado de la asignación tras `confirmarAsignacion()`. Confirmado con
   * Selenium real que esta acción NO dispara ningún notify de la app (ambos
   * popups simplemente cierran) — a diferencia de la mayoría de los
   * "Guardar" del resto del framework, acá el CIERRE de los dos popups
   * (confirmación + modal de asignación) es la evidencia de éxito, no un
   * toast. Por eso se espera el cierre de ambos y recién DESPUÉS se lee el
   * notify de forma INSTANTÁNEA (sin poll): si alguna vez apareciera uno,
   * queda disponible para diagnóstico, pero el test nunca debe bloquearse
   * esperando un toast que esta pantalla no muestra.
   *
   * `Popup.esperarCerrado` NUNCA lanza (atrapa su propio timeout) — por eso
   * acá se confirma el cierre REAL con `estaVisible()` después de esperar,
   * en vez de asumir éxito solo porque la espera no tiró una excepción.
   *
   * SOLO se espera el cierre de `popupConfirmarGuardar` (overlay DevExtreme
   * ESTÁNDAR, que sí deja de reportar tamaño > 0 al cerrar). `popupAsignar`
   * —el modal custom de la app— NO se espera acá: confirmado con Selenium
   * real que su contenedor puede seguir reportando `offsetWidth/
   * offsetHeight > 0` AUN tras una asignación exitosa (transición/backdrop
   * propios del componente, no un overlay DevExtreme) — esperar su cierre
   * agotaba SIEMPRE el timeout completo (hasta 30s) aunque visualmente ya
   * hubiera desaparecido de inmediato. Su estado se sigue LEYENDO (una sola
   * vez, sin esperar) para el diagnóstico, nunca como bloqueo.
   * @returns {Promise<{notify:string, exito:boolean, invalido:boolean, errorSistema:boolean, modalCerrado:boolean}>}
   */
  async resultadoAsignacion(timeout = config.timeouts.explicitWaitMs) {
    await this.popupConfirmarGuardar.esperarCerrado(timeout);
    const modalCerrado =
      !(await this.popupConfirmarGuardar.estaVisible()) && !(await this.popupAsignar.estaVisible());
    const textoNotify = await this.notify.getTexto();
    return { ...Notify.clasificar(textoNotify), modalCerrado };
  }
}

module.exports = NominaPage;
