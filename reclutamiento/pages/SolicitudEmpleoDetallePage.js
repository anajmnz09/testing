const { By, Key, until } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const FormsHeader = require('@triple/core/components/FormsHeader');
const CommentEditor = require('@triple/core/components/CommentEditor');
const FileUploader = require('@triple/core/components/FileUploader');
const { parsearValoresMultiples } = require('@triple/core/strategies');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * MAPEO VERIFICADO — vista de CONSULTA de una Solicitud de Empleo en etapa
 * "Crear Solicitud de Empleo" / estado "Iniciada" (investigado con Selenium
 * Headed sobre la solicitud real #1815, código 1815). Documenta lo
 * encontrado para implementar los tests más adelante — NO agrega
 * interacciones ni supuestos no verificados; eso queda pendiente de
 * codificar cuando se arme el test.
 *
 * Se abre con doble-click en la fila del listado de Solicitudes de Empleo,
 * o clickeando el nombre en la columna "Nombre" (mismo criterio que
 * `RequisicionesPage.abrirDetalle`, no verificado todavía para este listado).
 *
 * HEADER (`forms-header`) — botones confirmados en esta etapa/estado:
 *  - "Crear"     -> abre el formulario de creación (igual que en el listado).
 *  - "Editar"    -> habilita edición del detalle (mismo patrón que
 *                   `RequisicionDetallePage.editar`, no probado acá todavía).
 *  - "Documentos"-> `dx-dropdownbutton` real (NO el `documentoButton` custom
 *                   de Requisición). Al clickearlo abre un POPUP flotante
 *                   anclado al botón: título "Documentos" + ícono de clip
 *                   (adjuntar, sin probar) arriba a la derecha, y debajo la
 *                   lista de archivos — vacía en #1815: "No se encontraron
 *                   archivos". Se cierra con ESC.
 *  - "Iniciada"  -> badge de ESTADO, SOLO LECTURA (no es un selector).
 *  - dropdown junto al badge -> selector de ETAPA (`getEtapa`/`cambiarEtapa`,
 *                   ver esos métodos). Es el ÚNICO `.dx-selectbox` real
 *                   dentro de `forms-header` (los de "Estado laboral"/etc.
 *                   viven en el cuerpo, no en el header) — así se localiza,
 *                   NO por texto (el texto visible llega truncado con "...").
 *                   CONFIRMADO con un cambio de etapa real: el texto NO vive
 *                   en el `value` del input (ese tiene el ID interno del
 *                   registro, ej. "1269") sino en el atributo
 *                   `data-dx_placeholder` de un `.dx-placeholder`
 *                   (DevExtreme lo renderiza como placeholder estilizado).
 *                   CONFIRMADO también: seleccionar una opción NO requiere
 *                   "Editar" ni "Guardar" — guarda sola y dispara su propio
 *                   notify (acción de header, mismo criterio que
 *                   Pausar/Publicar en Requisición).
 *                   Opciones verificadas al abrirlo desde "Crear Solicitud
 *                   de Empleo" (sin seleccionar ninguna): "Primera
 *                   entrevista", "Segunda entrevista", "Tercera entrevista",
 *                   "Oferta de Empleo". La etapa actual NO aparece en su
 *                   propia lista.
 *                   CONFIRMADO además (solicitud real #1816, etapa "oferta de
 *                   empleo" + estado "Autorizada"): en esa combinación
 *                   puntual el dropdown agrega una 5ta opción, "Crear
 *                   Empleado" — NO aparece en ninguna otra etapa/estado. Es
 *                   el último paso de la solicitud (contrata y crea el
 *                   perfil en el módulo Empleados); requiere primero llenar
 *                   "Salario" en "Propuesta económica" (ver más abajo), si
 *                   no la app bloquea el cambio con un warning.
 *  - "Rechazar"  -> NUNCA clickeado (acción real/destructiva). Pendiente de
 *                   mapear cuando el usuario lo autorice explícitamente.
 *
 * TIRA DE RESUMEN DEL SOLICITANTE (debajo del header, encima de las dos
 * columnas): cambió de layout respecto al form de creación — YA NO son
 * `.dx-field-item`/`group-field` (que sí lee `Form`), son `<label>` de solo
 * texto en una fila horizontal. `Form.getValor()` no los puede leer todavía
 * tal cual está. Contiene: foto (placeholder circular, sin lógica probada),
 * 5 estrellas de rating (sin label asociado en el DOM), nombre completo del
 * candidato, link a la Requisición vinculada (navega, destino no
 * confirmado), y la fila de pares label:valor: "Tipo ID", "Identificación",
 * "Grado académico", "Origen Solicitante", "Correo", "Celular".
 *
 * COLUMNA "Acerca del puesto de trabajo" (grupo dxForm, ya conocida del form
 * de creación, confirmada en modo consulta = solo lectura):
 *   Requisición* / Departamento / Etiquetas / Supervisor / Fecha de ingreso /
 *   Valoración Inicial.
 *   OJO: "Valoración Inicial:" es el campo "Comentario" del form de crear,
 *   RENOMBRADO en esta vista (confirmado: su `<label for="...">` apunta a un
 *   id que contiene "comentario"; widget real = `dx-textarea`). NO es lo
 *   mismo que el componente "Comentarios" (`CommentEditor`) de más abajo —
 *   son dos cosas distintas, no confundir.
 *
 * COLUMNA NUEVA "Paquete actual de beneficios" (grupo dxForm), debajo de la
 * anterior, dos columnas completas de ancho combinado con la primera:
 *   - "Estado laboral:" -> `dx-selectbox`, solo lectura en consulta (sus 2
 *     opciones reales no se enumeraron todavía — requiere entrar a Editar).
 *   - "Último salario:" -> `dx-numberbox`, solo lectura en consulta.
 *   - "Beneficios:"     -> `dx-textarea`, solo lectura en consulta.
 *   Los 3 están VACÍOS en esta etapa/estado ("Iniciada"): se llenan más
 *   adelante en el flujo, no en la creación.
 *   CONFIRMADO: en etapa "Oferta de Empleo" esta columna YA NO aparece — la
 *   reemplaza "Propuesta económica" (mismo dxForm, un solo control real:
 *   "Salario", ver `ESTRATEGIAS_PROPUESTA_ECONOMICA`).
 *
 * Debajo de ambas columnas, ocupando el ancho completo:
 *  - "Pregunta(s) Personalizada(s)": mismo título que en Requisición; #1815
 *    no tiene preguntas cargadas visibles — estructura interna del grid sin
 *    mapear todavía.
 *  - "Comentarios": es LITERALMENTE el mismo componente `CommentEditor` del
 *    core (misma clase `CommentEditor_commentTitle__...` que
 *    `RequisicionDetallePage`), reutilizable tal cual, sin pasar por
 *    "Editar" primero.
 *
 * ESTRELLAS (valoración) — mapeo verificado con clicks reales (no supuesto):
 * NO es un widget DevExtreme (el único `.dx-slider` de la página pertenece al
 * zoom del recortador de foto, "Cargar Imagen" — mismo contenedor pero un
 * control totalmente distinto, sin relación). Las estrellas son 5 `<img
 * width="25">` simples, sin `alt` ni nombre accesible, dentro del contenedor
 * `.mb-40.pt-20.pb-20.border-top-1px.border-bottom-1px.border-gray.d-flex
 * .justify-between` (el mismo bloque que agrupa foto + nombre + estrellas +
 * la fila Tipo ID/Identificación/etc.). Estrella "llena" = `src` en
 * `data:image/png;base64,...`; "vacía" = `src` apuntando a un archivo
 * `/static/media/SRH-Estrella-Empty...png`. Clickear la estrella de índice
 * N-1 (0-based) llena las estrellas 1..N (confirmado clickeando la 5ta y
 * viendo las 5 pasar a "llena"); no se probó si permite bajar el valor
 * clickeando una ya llena. Requiere modo Editar (igual que el resto de los
 * campos); persiste al Guardar con el botón principal del form (confirmado
 * recargando la página tras guardar).
 */

// Estrellas: ver mapeo arriba. `imagen` filtra por `width="25"` porque el
// mismo contenedor tiene otra imagen (la foto) sin ese atributo.
const SEL_ESTRELLAS = {
  contenedor: '.mb-40.pt-20.pb-20.border-top-1px.border-bottom-1px.border-gray.d-flex.justify-between',
  imagen: 'img[width="25"]',
};

// Etapa — dropdown junto al badge de Estado, en el header. Ver mapeo arriba:
// único `.dx-selectbox` real dentro de `forms-header` (los de "Estado
// laboral"/etc. viven en el cuerpo, no ahí), por eso se localiza así y NO por
// texto (el texto visible llega truncado con "...").
const SEL_ETAPA = {
  selectbox: '[class*="forms-header"] .dx-selectbox',
};

// Foto — botón de carga YA MAPEADO (`UserImage_load_image_btn__dzaym`),
// envuelve el `<input id="file-upload" type="file" accept=".jpg,.jpeg,.png">`
// oculto. No se clickea el botón: se envía la ruta directo al input vía
// `FileUploader` del core (sin diálogo del SO). Eso abre el popup "Cargar
// Imagen" (`ImgViewer_img_viewer_overlay...`, mismo contenedor donde vive el
// slider de zoom del recorte — NO tocar) con su PROPIO botón "Guardar"
// (`aria-label="Guardar"`, distinto del Guardar del formulario principal)
// para confirmar sin recortar/mover/ajustar nada.
const SEL_FOTO = {
  imagen: '.UserImage_user_image_component__R8CsV img',
  botonGuardarOverlay: "//div[contains(@class,'ImgViewer_img_viewer_overlay')]//*[@aria-label='Guardar']",
  placeholderPorDefecto: 'SRH-PFP-Negro',
};

/**
 * Mapa CONTROL -> SELECTION STRATEGY de la columna "Paquete actual de
 * beneficios" (mismo dxForm que "Acerca del puesto de trabajo", ya conocido
 * — estos 3 controles se leen/escriben con los métodos genéricos de `Form`,
 * igual que Requisición/Departamento/etc.).
 *
 * "Estado laboral": selectbox con SOLO 2 opciones reales, verificadas
 * abriendo el dropdown de una solicitud real: "Empleado", "Desempleado".
 * `directSelect` (mismo criterio que "Tipo ID": lista corta, sin necesidad
 * de buscador).
 */
const ESTRATEGIAS_PAQUETE_BENEFICIOS = {
  'Estado laboral': 'directSelect',
  'Último salario': 'text',
  Beneficios: 'text',
};

/**
 * Columna "Propuesta económica" (reemplaza a "Paquete actual de beneficios"
 * cuando la solicitud llega a la etapa "Oferta de Empleo" — mismo dxForm,
 * mapeo verificado con Selenium Headed sobre la solicitud real #1816, etapa
 * "oferta de empleo", estado "Autorizada").
 *
 * "Salario": único control de la sección, REQUERIDO (label real "Salario: *",
 * `dx-numberbox` — solo acepta números). Si se intenta cambiar de etapa con
 * este campo vacío, la app bloquea el cambio con un warning (no lanza
 * excepción de Selenium; el notify de `cambiarEtapa` simplemente no llega a
 * "éxito" — hay que llenarlo ANTES de cambiar a "Crear Empleado").
 */
const ESTRATEGIAS_PROPUESTA_ECONOMICA = {
  Salario: 'text',
};

/**
 * "Otros beneficios" — sección debajo de "Propuesta económica" (mismo
 * dxForm), NO requerida (a diferencia de "Salario"). No es un control de
 * Form estándar: es una tabla (`.dx-datagrid` real) + un botón "add" que abre
 * un popup para cargar un beneficio del catálogo + su monto. Mapeo verificado
 * con Selenium Headed (solicitud real #1817, etapa "oferta de empleo",
 * estado "Autorizada"):
 *  - Botón agregar: único elemento con `aria-label="add"` bajo el label
 *    "Otros beneficios" (accesible, no frágil).
 *  - Popup ("Agregar otro beneficio"): "Beneficio" (selectbox de catálogo,
 *    REQUERIDO dentro del popup aunque la sección en sí no lo sea —
 *    verificado: COMPENSACION VEHICULO, PARQUEO, TRANSPORTE, BONO POR
 *    DESEMPEÑO ANUAL, INCENTIVO TRIMESTRAL, BONO DESEMPEÑO SEMESTRAL,
 *    INCENTIVO SEMESTRAL, SUPERMERCADO PRUEBA), "Monto" (numberbox,
 *    REQUERIDO — necesita TAB para confirmar el valor; sin eso queda en
 *    "0.00" pese a haber tipeado, confirmado con evidencia real), checkbox
 *    "Crear nuevo registro" (marcado: tras "Agregar" el popup NO se cierra y
 *    se puede cargar otro beneficio sin reabrirlo), botones
 *    "Agregar"/"Descartar".
 *  - Tabla resultante: columnas "Nombre" (nombre del beneficio) y "Monto". Se
 *    actualiza en vivo tras cada "Agregar", pero es estado LOCAL del form:
 *    solo persiste al Guardar el formulario (igual que "Propuesta
 *    económica"). CONFIRMADO: "Salario" es requerido en esta misma vista —
 *    sin llenarlo, Guardar falla con "Formulario Inválido" sin importar que
 *    los beneficios estén completos.
 */
const SEL_OTROS_BENEFICIOS = {
  botonAgregar: By.xpath("//p[normalize-space(.)='Otros beneficios']/following::div[@aria-label='add'][1]"),
  popupSelectBeneficio: By.xpath("//label[contains(.,'Beneficio')]/following::*[contains(@class,'dx-dropdowneditor')][1]"),
  popupInputMonto: By.xpath("//label[contains(.,'Monto')]/following::input[contains(@class,'dx-texteditor-input')][1]"),
  popupCheckboxCrearNuevo: By.xpath("//div[contains(@class,'dx-overlay-content')]//*[contains(@class,'dx-checkbox')]"),
  popupBtnAgregar: By.xpath(
    "//div[contains(@class,'dx-overlay-content')]//div[contains(@class,'dx-button')][.//span[normalize-space(.)='Agregar']]"
  ),
  popupBtnDescartar: By.xpath(
    "//div[contains(@class,'dx-overlay-content')]//div[contains(@class,'dx-button')][.//span[normalize-space(.)='Descartar']]"
  ),
  filaTabla: By.xpath("//p[normalize-space(.)='Otros beneficios']/following::tr[contains(@class,'dx-data-row')]"),
};

class SolicitudEmpleoDetallePage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    // header de la pantalla de solicitud (misma convención que Requisición).
    this.header = By.css('[class*="forms-header"]');
    this.acciones = new FormsHeader(driver);
    // Sección "Comentarios": mismo componente reutilizable que Requisición.
    this.commentEditor = new CommentEditor(driver);
    this.btnGuardar = By.xpath("//div[contains(@class,'dx-button')][normalize-space(.)='Guardar']");
    // Carga de foto: mismo componente FileUploader que usa Documentos (Requisición).
    this.uploader = new FileUploader(driver, { selector: 'input#file-upload' });
  }

  /** Espera a que el detalle esté cargado (header visible, sin loader). */
  async estaCargado() {
    await this.waitVisible(this.header);
    await this.esperarSinLoader();
    return this;
  }

  /**
   * Agrega un comentario mediante la sección "Comentarios" (widget
   * `CommentEditor` del core — mismo componente que
   * `RequisicionDetallePage.agregarComentario`, reutilizado tal cual). NO
   * requiere modo Editar (ver mapeo de la clase): funciona en cualquier
   * etapa/estado de la solicitud.
   */
  async agregarComentario(texto) {
    logger.info('SolicitudEmpleoDetalle: agregar comentario (sección Comentarios)');
    return this.commentEditor.agregar(texto);
  }

  /**
   * Entra en modo edición ("Editar" del header) — mismo patrón que
   * `RequisicionDetallePage.editar`: tolerante, no lanza si ya está editable.
   */
  async editar(timeout = config.timeouts.explicitWaitMs) {
    logger.info('SolicitudEmpleoDetalle: entrar en modo edición ("Editar")');
    const info = await this.acciones.clickBoton('editar', {
      etiqueta: 'Editar',
      timeout,
      dataQa: 'boton-editar',
    });
    if (info.accionado) {
      await this.esperarSinLoader(timeout);
      await this.waitVisible(this.btnGuardar, timeout).catch(() => {});
    }
    return info;
  }

  /**
   * Guarda el formulario en edición (botón "Guardar" del header). Reintenta
   * ante `StaleElementReferenceError` (confirmado con evidencia real: el
   * header puede re-renderizar justo entre ubicar el botón y clickearlo,
   * mismo tipo de carrera que en `cambiarEtapa`).
   */
  async guardar(intentos = 3) {
    logger.info('SolicitudEmpleoDetalle: Guardar');
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const btn = await this.waitVisible(this.btnGuardar);
        await this.driver.executeScript('arguments[0].click()', btn);
        return;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
        logger.info(`SolicitudEmpleoDetalle: botón "Guardar" "stale" (intento ${intento}/${intentos}), reintentando`);
      }
    }
  }

  /** Clasifica el resultado tras Guardar según el notify (mismo mecanismo que Requisición/Solicitud). */
  async resultadoGuardado(timeoutMs = config.timeouts.explicitWaitMs) {
    const texto = await this.notify.esperarTexto(timeoutMs);
    return Notify.clasificar(texto);
  }

  /** Cantidad de estrellas llenas actualmente (0-5), leídas por `src` (ver mapeo arriba). */
  async getValoracion() {
    return this.driver.executeScript((sel) => {
      const cont = document.querySelector(sel.contenedor);
      if (!cont) return 0;
      const imgs = Array.from(cont.querySelectorAll(sel.imagen));
      return imgs.filter((img) => (img.getAttribute('src') || '').startsWith('data:')).length;
    }, SEL_ESTRELLAS);
  }

  /**
   * Pone la valoración a `n` estrellas (1-5), clickeando la N-ésima (ver
   * mapeo arriba). Requiere modo Editar ya activo (no lo activa acá, para no
   * mezclar responsabilidades con `editar()`).
   */
  async setValoracion(n) {
    const cantidad = Math.max(1, Math.min(5, Math.round(Number(n))));
    logger.info(`SolicitudEmpleoDetalle: valoración -> ${cantidad} estrella(s)`);
    const imgs = await this.driver.findElements(By.css(`${SEL_ESTRELLAS.contenedor} ${SEL_ESTRELLAS.imagen}`));
    if (imgs.length !== 5) {
      throw new Error(`SolicitudEmpleoDetalle: no se encontraron las 5 estrellas (encontradas: ${imgs.length})`);
    }
    const estrella = imgs[cantidad - 1];
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', estrella);
    await this.driver.executeScript('arguments[0].click()', estrella);
    return cantidad;
  }

  /** `src` actual de la foto del candidato (para comparar antes/después de subir una). */
  async getFotoSrc() {
    const img = await this.driver.findElement(By.css(SEL_FOTO.imagen));
    return img.getAttribute('src');
  }

  /**
   * Sube una foto al candidato: envía `rutaArchivo` directo al input oculto
   * (sin diálogo del SO, ver mapeo arriba), espera el popup "Cargar Imagen" y
   * lo confirma con SU botón "Guardar" — sin recortar, mover ni ajustar
   * nada. Requiere modo Editar ya activo (no lo activa acá).
   */
  async subirFoto(rutaArchivo) {
    logger.info('SolicitudEmpleoDetalle: subir foto');
    await this.uploader.subir(rutaArchivo);
    const btnGuardarOverlay = await this.waitVisible(By.xpath(SEL_FOTO.botonGuardarOverlay));
    await this.driver.executeScript('arguments[0].click()', btnGuardarOverlay);
  }

  /**
   * Pone un valor en un control de "Paquete actual de beneficios" con su
   * estrategia declarada (ver `ESTRATEGIAS_PAQUETE_BENEFICIOS`). Requiere
   * modo Editar ya activo.
   */
  async setCampoPaqueteBeneficios(label, valor) {
    const estrategia = ESTRATEGIAS_PAQUETE_BENEFICIOS[label];
    if (!estrategia) {
      throw new Error(
        `SolicitudEmpleoDetalle: "${label}" no es un control de Paquete actual de beneficios. ` +
          `Declarados: ${Object.keys(ESTRATEGIAS_PAQUETE_BENEFICIOS).join(', ')}`
      );
    }
    return this.form.setValor(label, valor, { estrategia });
  }

  /**
   * Pone un valor en un control de "Propuesta económica" (ver
   * `ESTRATEGIAS_PROPUESTA_ECONOMICA`). Requiere modo Editar ya activo.
   */
  async setCampoPropuestaEconomica(label, valor) {
    const estrategia = ESTRATEGIAS_PROPUESTA_ECONOMICA[label];
    if (!estrategia) {
      throw new Error(
        `SolicitudEmpleoDetalle: "${label}" no es un control de Propuesta económica. ` +
          `Declarados: ${Object.keys(ESTRATEGIAS_PROPUESTA_ECONOMICA).join(', ')}`
      );
    }
    return this.form.setValor(label, valor, { estrategia });
  }

  /** Abre el popup "Agregar otro beneficio" (botón "add" de "Otros beneficios"). Requiere modo Editar ya activo. */
  async abrirPopupOtrosBeneficios() {
    logger.info('SolicitudEmpleoDetalle: abrir popup "Agregar otro beneficio"');
    const btn = await this.waitVisible(SEL_OTROS_BENEFICIOS.botonAgregar);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
    await this.driver.executeScript('arguments[0].click()', btn);
    await this.waitVisible(SEL_OTROS_BENEFICIOS.popupSelectBeneficio);
  }

  /**
   * Agrega UN beneficio dentro del popup YA ABIERTO: selecciona `beneficio`
   * del catálogo (tolerante — reutiliza `Form._itemVisiblePorTexto`, mismo
   * matcher case-insensitive/por similitud de siempre) y llena `monto`
   * (con TAB para confirmarlo, ver mapeo de la clase).
   *
   * Como la sección NO es requerida, un `beneficio` que no matchea ninguna
   * opción del catálogo NO es un error: se descarta (clic en "Descartar",
   * cierra el popup) y devuelve `false` — nunca lanza.
   *
   * `crearNuevoRegistro`: si es `true`, marca el checkbox y el popup queda
   * abierto tras "Agregar" (para encadenar otro beneficio sin reabrirlo); si
   * es `false` (default), lo deja desmarcado para que "Agregar" cierre el
   * popup.
   *
   * Reintenta ante `StaleElementReferenceError` al abrir el dropdown (misma
   * carrera ya vista tras "Editar"/"Guardar" en otros controles: el popup
   * puede quedar re-renderizando un instante justo después de abrirse).
   */
  async agregarOtroBeneficio(beneficio, monto, { crearNuevoRegistro = false } = {}, intentos = 3) {
    let abierto = false;
    for (let intento = 1; intento <= intentos && !abierto; intento++) {
      try {
        const selectbox = await this.waitVisible(SEL_OTROS_BENEFICIOS.popupSelectBeneficio);
        await this.form._abrirDropdownEn(selectbox);
        abierto = true;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
        logger.info(`SolicitudEmpleoDetalle: selectbox de "Beneficio" "stale" (intento ${intento}/${intentos}), reintentando`);
      }
    }

    let item;
    try {
      item = await this.form._itemVisiblePorTexto(beneficio);
    } catch (e) {
      logger.info(
        `SolicitudEmpleoDetalle: "${beneficio}" no coincide con ningún beneficio del catálogo, se descarta (sección no requerida)`
      );
      await this.driver.actions().sendKeys(Key.ESCAPE).perform();
      await this.form._esperarOverlayCerrado();
      const btnDescartar = await this.waitVisible(SEL_OTROS_BENEFICIOS.popupBtnDescartar);
      await this.driver.executeScript('arguments[0].click()', btnDescartar);
      return false;
    }
    const textoElegido = (await item.getText()).trim();
    await item.click();
    await this.form._esperarOverlayCerrado();

    const inputMonto = await this.waitVisible(SEL_OTROS_BENEFICIOS.popupInputMonto);
    await inputMonto.click();
    await inputMonto.sendKeys(String(monto), Key.TAB);

    const checkbox = await this.driver.findElement(SEL_OTROS_BENEFICIOS.popupCheckboxCrearNuevo);
    const clase = await checkbox.getAttribute('class');
    const marcado = clase.includes('dx-checkbox-checked');
    if (marcado !== crearNuevoRegistro) {
      await this.driver.executeScript('arguments[0].click()', checkbox);
    }

    const btnAgregar = await this.waitVisible(SEL_OTROS_BENEFICIOS.popupBtnAgregar);
    await this.driver.executeScript('arguments[0].click()', btnAgregar);
    logger.info(`SolicitudEmpleoDetalle: beneficio "${textoElegido}" agregado (monto=${monto})`);
    if (crearNuevoRegistro) {
      await this.waitVisible(SEL_OTROS_BENEFICIOS.popupSelectBeneficio);
    }
    return true;
  }

  /**
   * Agrega varios beneficios desde un string "|"-separado (misma convención
   * que el resto del framework — ver `parsearValoresMultiples`), emparejados
   * POR POSICIÓN con `montosTexto` (también "|"-separado); si faltan montos,
   * se reutiliza el ÚLTIMO dado. Beneficios sin match en el catálogo se
   * DESCARTAN silenciosamente (la sección no es requerida) — no hacen fallar
   * el caso. Requiere modo Editar ya activo.
   *
   * Devuelve la lista de beneficios EFECTIVAMENTE agregados (los que sí
   * matchearon), en el mismo orden.
   */
  async agregarBeneficios(beneficiosTexto, montosTexto) {
    const beneficios = parsearValoresMultiples(beneficiosTexto);
    const montos = parsearValoresMultiples(montosTexto);
    if (!beneficios.length) return [];

    await this.abrirPopupOtrosBeneficios();
    const agregados = [];
    for (let i = 0; i < beneficios.length; i++) {
      const monto = montos[i] || montos[montos.length - 1];
      if (monto === undefined) {
        logger.info(`SolicitudEmpleoDetalle: sin "monto" declarado para "${beneficios[i]}", se usa 0`);
      }
      const esUltimo = i === beneficios.length - 1;
      const ok = await this.agregarOtroBeneficio(beneficios[i], monto || '0', { crearNuevoRegistro: !esUltimo });
      if (ok) agregados.push(beneficios[i]);
      if (!ok && !esUltimo) {
        // el popup se cerró vía "Descartar": reabrir para seguir con el resto.
        await this.abrirPopupOtrosBeneficios();
      }
    }
    return agregados;
  }

  /** Filas de la tabla "Otros beneficios" (nombre + monto), leídas del DOM. */
  async leerOtrosBeneficios() {
    const filas = await this.driver.findElements(SEL_OTROS_BENEFICIOS.filaTabla);
    const resultado = [];
    for (const fila of filas) {
      const celdas = await fila.findElements(By.css('td'));
      const nombre = celdas[0] ? (await celdas[0].getText()).trim() : '';
      const monto = celdas[1] ? (await celdas[1].getText()).trim() : '';
      resultado.push({ nombre, monto });
    }
    return resultado;
  }

  /**
   * Texto de etapa actualmente mostrado en el header.
   *
   * NO vive en el `value` del input (ese es el `<input type="hidden">` con el
   * ID interno del registro, ej. "1269" — mismo patrón que "Estado laboral").
   * Se muestra vía el atributo `data-dx_placeholder` de un `.dx-placeholder`
   * (DevExtreme lo renderiza como placeholder estilizado, no como valor real)
   * — verificado en el DOM real tras un cambio de etapa confirmado.
   */
  async getEtapa() {
    return this.driver.executeScript((sel) => {
      const cont = document.querySelector(sel);
      if (!cont) return '';
      const placeholder = cont.querySelector('.dx-placeholder');
      return placeholder ? (placeholder.getAttribute('data-dx_placeholder') || '').trim() : '';
    }, SEL_ETAPA.selectbox);
  }

  /**
   * Espera hasta que `getEtapa()` refleje `valorEsperado` (comparación
   * case-insensitive, `includes`). El notify de éxito de `cambiarEtapa` puede
   * llegar un instante ANTES de que el header termine de re-renderizar el
   * badge con el nombre nuevo de la etapa — confirmado con evidencia real en
   * la transición a "Crear Empleado" (más pesada: crea el perfil en
   * Empleados). Leerlo con una sola lectura inmediata podía devolver la etapa
   * ANTERIOR todavía. Devuelve el texto final leído (éxito o no, para poder
   * incluirlo en el mensaje de assert del caso).
   */
  async esperarEtapa(valorEsperado, timeoutMs = config.timeouts.explicitWaitMs) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = await this.getEtapa();
        return actual.toLowerCase().includes(valorEsperado.toLowerCase());
      }, timeoutMs)
      .catch(() => {});
    return actual;
  }

  /**
   * Cambia la etapa de la solicitud clickeando la opción `valor` en el
   * dropdown del header (ver mapeo arriba). NO requiere modo Editar: es una
   * acción de header (como Pausar/Publicar en Requisición) — seleccionar la
   * opción guarda sola y dispara su propio notify, sin pasar por "Guardar"
   * del formulario. Reutiliza la mecánica de dropdown ya probada de `Form`
   * (`_abrirDropdownEn`/`_itemVisiblePorTexto`, ya tolerante a
   * acentos/mayúsculas/similitud), no la reimplementa.
   *
   * ALGUNAS etapas (confirmado en "Oferta de Empleo") disparan ADEMÁS un
   * popup de confirmación — "Aprobar solicitud inmediatamente: ¿Desea
   * autorizar inmediatamente esta aprobación?" con botones "Sí"/"No" — antes
   * de aplicar el cambio; sin confirmarlo, el cambio queda pendiente y el
   * notify nunca llega. Se confirma con "Sí" (lo que haría un usuario real
   * completando la acción) SI el popup aparece; las etapas que no lo
   * muestran (Primera/Segunda/Tercera entrevista, verificado) siguen igual
   * que antes — se tolera su ausencia con una espera corta, no bloquea.
   *
   * Si se llama justo después de un `guardar()` (ej. tras llenar "Propuesta
   * económica" antes de pasar a "Crear Empleado"), el header vuelve a modo
   * consulta y sigue re-renderizándose un instante más: `until.elementLocated`
   * evita el "no such element" inicial, pero el nodo ubicado puede quedar
   * `stale` igual si se re-renderiza de nuevo justo después (confirmado con
   * evidencia real: `StaleElementReferenceError` dentro de
   * `Form._abrirDropdownEn`). Por eso el intento completo (ubicar + abrir +
   * elegir) se reintenta ante ese error puntual — no cambia nada para el caso
   * normal, que resuelve en el primer intento.
   */
  async cambiarEtapa(valor, timeoutMs = config.timeouts.explicitWaitMs, intentos = 3) {
    logger.info(`SolicitudEmpleoDetalle: cambiar etapa -> "${valor}"`);
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const raiz = await this.driver.wait(until.elementLocated(By.css(SEL_ETAPA.selectbox)), timeoutMs);
        await this.form._abrirDropdownEn(raiz);
        const item = await this.form._itemVisiblePorTexto(valor);
        await item.click();
        await this.form._esperarOverlayCerrado();
        break;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
        logger.info(`SolicitudEmpleoDetalle: elemento de etapa "stale" (intento ${intento}/${intentos}), reintentando`);
      }
    }

    const btnSi = await this.driver
      .wait(
        until.elementLocated(
          By.xpath("//div[contains(@class,'dx-popup-content')]//div[contains(@class,'dx-button')][normalize-space(.)='Sí']")
        ),
        3000
      )
      .catch(() => null);
    if (btnSi) {
      logger.info('SolicitudEmpleoDetalle: confirmando popup de aprobación -> "Sí"');
      await this.driver.executeScript('arguments[0].click()', btnSi);
    }

    const texto = await this.notify.esperarTexto(timeoutMs);
    return Notify.clasificar(texto);
  }
}

module.exports = SolicitudEmpleoDetallePage;
