const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const FormsHeader = require('@triple/core/components/FormsHeader');
const CommentEditor = require('@triple/core/components/CommentEditor');
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
 *  - dropdown junto al badge -> selector de ETAPA. Muestra el valor actual
 *                   TRUNCADO y en gris/atenuado (estilo placeholder, no
 *                   confirmado como `value` real del input — al leer
 *                   `.dx-texteditor-input.value` tras cerrarlo dio vacío).
 *                   Es el ÚNICO `.dx-selectbox` real dentro de
 *                   `forms-header` (los de "Estado laboral"/etc. viven en el
 *                   cuerpo, no en el header) — así se debe localizar, NO por
 *                   texto (el texto visible es truncado con "...").
 *                   Opciones verificadas al abrirlo desde "Crear Solicitud
 *                   de Empleo" (sin seleccionar ninguna): "Primera
 *                   entrevista", "Segunda entrevista", "Tercera entrevista",
 *                   "Oferta de Empleo". La etapa actual NO aparece en su
 *                   propia lista.
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
  }

  /** Espera a que el detalle esté cargado (header visible, sin loader). */
  async estaCargado() {
    await this.waitVisible(this.header);
    await this.esperarSinLoader();
    return this;
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

  /** Guarda el formulario en edición (botón "Guardar" del header). */
  async guardar() {
    logger.info('SolicitudEmpleoDetalle: Guardar');
    const btn = await this.waitVisible(this.btnGuardar);
    await this.driver.executeScript('arguments[0].click()', btn);
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
}

module.exports = SolicitudEmpleoDetallePage;
