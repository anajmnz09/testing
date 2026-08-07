const { By } = require('selenium-webdriver');
const { BasePage } = require('@triple/core');
const Form = require('@triple/core/components/Form');
const Notify = require('@triple/core/components/Notify');
const FormsHeader = require('@triple/core/components/FormsHeader');
const CommentEditor = require('@triple/core/components/CommentEditor');

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
 */

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
  }

  // Métodos de interacción (abrir, editar, leer estado/etapa, documentos,
  // preguntas personalizadas, etc.) pendientes de codificar cuando se arme
  // el test — este archivo por ahora solo deja fijado el mapeo verificado.
}

module.exports = SolicitudEmpleoDetallePage;
