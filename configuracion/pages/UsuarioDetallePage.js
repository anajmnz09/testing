const { By } = require('selenium-webdriver');
const { ConfiguracionEntidadDetallePage } = require('@triple/core');
const FileUploader = require('@triple/core/components/FileUploader');
const logger = require('@triple/core/utils/logger');

/**
 * Pantalla de UN registro de "Usuarios" (Configuración > Usuarios y permisos
 * > Usuarios). A diferencia del resto de entidades de Configuración que
 * extienden `ConfiguracionEntidadDetallePage`, ACÁ Crear y Editar muestran
 * conjuntos de campos DISTINTOS (verificado con Selenium real,
 * `screenInspector`, no supuesto) y el acceso a Editar es un mecanismo
 * propio — por eso esta clase declara DOS mapas de ESTRATEGIAS y sobreescribe
 * `editar()`; el resto (`form`, `getValor`, `setCampo`, `completarConContexto`,
 * `guardar`, `resultadoGuardado`, `estaCargado`) se hereda tal cual.
 *
 * CREAR (`ESTRATEGIAS_CREAR`, ir a través de `UsuariosPage.crear()`):
 *  - "Nombre Completo": texto libre REQUERIDO.
 *  - "Compañía": selectbox CON buscador (`search-icon` en la metadata)
 *    OPCIONAL — catálogo de compañías (Cia_001, Cia_002…) — `searchAndSelect`.
 *  - "Código de usuario": texto libre REQUERIDO. Placeholder real de la app:
 *    "e.g: johnsmith" — confirma que debe ir SIN espacios.
 *  - "Correo": texto libre OPCIONAL en Crear (a diferencia de Editar, donde
 *    es requerido — ver abajo).
 *  - "Idioma": selectbox CON buscador OPCIONAL, llega PRESELECCIONADO
 *    ("Español") — `searchAndSelect`.
 *  - "Es administrador"/"Tiene acceso a RRHH": switches, APAGADOS por
 *    defecto. `crear-usuario` los enciende SOLO si el Panel dirige `true`
 *    explícito para alguno (autofill genérico sin dirección los deja en
 *    `false`, igual que el default de la app). También existen tests
 *    DEDICADOS idempotentes para activarlos sobre un Usuario ya existente
 *    (`marcar-usuario-administrador`, `dar-acceso-rrhh-usuario`).
 *
 * EDITAR (`ESTRATEGIAS_EDITAR`, tras `editar()`):
 *  - "Nombre Completo"/"Código de usuario": igual que en Crear.
 *  - "Correo": REQUERIDO acá (a diferencia de Crear).
 *  - "Compañías permitidas" (PLURAL — no confundir con "Compañía" de Crear):
 *    tagbox CON buscador REQUERIDO, multi-select — `{ estrategia:
 *    'searchAndSelect', multiple: true }`. Verificado con Selenium real que
 *    agregar un valor NO reemplaza los ya seleccionados (confirmado
 *    agregando "Cia_003" a un usuario que ya tenía "Cia_001"/"Cia_002": las
 *    3 quedan). El Panel dirige varios valores separados por "|" (ver
 *    `core/strategies/builtinStrategies.js#parsearValoresMultiples`).
 *  - "Es administrador"/"Tiene acceso a RRHH": switches — `editar-usuario`
 *    los toca SOLO si el Panel dirige `true` explícito para alguno (sin
 *    autofill: si no se dirigen, quedan intactos en su estado actual); se
 *    verifican aparte con `esperarInterruptor` (ver tests dedicados arriba).
 *  - Sección "Grupos" (grid debajo del form): a pedido explícito del
 *    usuario, se IGNORA por completo — no se declara, no se lee, no se toca.
 *
 * ACCESO A EDITAR: distinto del resto de Configuración (que usa un botón
 * "Editar" en el header estándar, ver `FormsHeader`). Acá hay que clickear el
 * div `#usuario-form-dropdown-acciones` (arriba a la derecha, ícono "⋮") y
 * elegir "Editar" del menú desplegado (confirmado con Selenium real que el
 * click debe ser NATIVO — `element.click()| — un click por JS no dispara el
 * handler de React y el menú nunca abre).
 *
 * FOTO: mismo componente compartido que "Solicitud de Empleo"
 * (`reclutamiento/pages/SolicitudEmpleoDetallePage.js`) — MISMA clase CSS
 * confirmada con Selenium real (`UserImage_user_image_component__R8CsV`,
 * `input#file-upload` oculto dentro de un `<label>`). Requiere modo Editar
 * activo (mismo criterio que Solicitudes: la foto no se sube desde Crear en
 * estos tests, a pedido explícito del usuario).
 */
const ESTRATEGIAS_CREAR = {
  'Nombre Completo': 'text',
  Compañía: 'searchAndSelect',
  'Código de usuario': 'text',
  Correo: 'text',
  Idioma: 'searchAndSelect',
  'Es administrador': 'switch',
  'Tiene acceso a RRHH': 'switch',
};

const ESTRATEGIAS_EDITAR = {
  'Nombre Completo': 'text',
  Correo: 'text',
  'Código de usuario': 'text',
  'Compañías permitidas': { estrategia: 'searchAndSelect', multiple: true },
  'Es administrador': 'switch',
  'Tiene acceso a RRHH': 'switch',
};

const SEL_FOTO = {
  imagen: '.UserImage_user_image_component__R8CsV img',
  botonGuardarOverlay: "//div[contains(@class,'ImgViewer_img_viewer_overlay')]//*[@aria-label='Guardar']",
};

const SEL_DROPDOWN_ACCIONES = By.id('usuario-form-dropdown-acciones');
const SEL_OPCION_EDITAR = By.xpath("//*[normalize-space(.)='Editar'][not(.//*)]");

class UsuarioDetallePage extends ConfiguracionEntidadDetallePage {
  /**
   * Acciones que, por DECISIÓN DE NEGOCIO, no crean ni transforman una entidad de flujo (ver GUIDELINES §12).
   */
  static get ACCIONES_FLUJO() {
    return [
      { metodo: 'subirFoto', clase: 'atributo' },
    ];
  }

  constructor(driver) {
    super(driver);
    // Por defecto asume el mapa de CREAR: es lo correcto para
    // `UsuariosPage.crear()`. `abrirDetalle()`/`abrirPrimero()` (consulta)
    // no necesitan ESTRATEGIAS para LEER (`getValor` no la usa) — si el test
    // llama `editar()`, ahí cambia a `ESTRATEGIAS_EDITAR`.
    this._estrategiasActuales = ESTRATEGIAS_CREAR;
    this.uploader = new FileUploader(driver, { selector: 'input#file-upload' });
    // Overrides del core (`ConfiguracionEntidadDetallePage`): confirmado con
    // Selenium real que la vista de CONSULTA de Usuario no usa `forms-header`
    // ni `.record-name` (0 elementos, ambos) — layout propio
    // `UsuariosConsultPage_*`. `estaCargado()` acepta forms-header (Crear,
    // ya confirmado en corridas reales) O el dropdown de acciones (Consulta,
    // único en esa pantalla — mismo criterio que
    // `UsuariosPage._localizadorDetalleCargado`).
    this.header = By.css('[class*="forms-header"], #usuario-form-dropdown-acciones');
    // El nombre del registro sale del único `<h1>` DENTRO de ese contenedor
    // — acotado para no colisionar con los ~13 `<h1>` del menú lateral (sin
    // clase distintiva propia). OJO: hay DOS `<h1>` que matchean este mismo
    // selector — un "esqueleto" vacío/oculto que carga primero, y el real
    // (confirmado con Selenium real: `getText()` de Selenium reporta "" para
    // el oculto — la app lo puebla y/o oculta de forma no trivial, así que
    // filtrar por XPath `!=''` NO alcanza). `getNombre()` (abajo) evalúa
    // TODOS los candidatos y usa el primero VISIBLE con texto — mismo
    // criterio que `Form._mejorCandidato`/`_itemVisiblePorTexto` del core:
    // nunca confiar en "el primero en orden del DOM".
    this.nombreRegistro = By.css('[class*="UsuariosConsultPage"] h1');
  }

  /**
   * Espera a que la pantalla esté cargada. SOBREESCRIBE el `estaCargado()`
   * genérico (que solo espera `this.header`): en modo Consulta, el `<h1>`
   * real del nombre puebla un instante DESPUÉS de que el botón "⋮" ya esté
   * visible (confirmado con evidencia real) — sin esta espera extra,
   * `getNombre()` llamado justo después podía leer el `<h1>` "esqueleto"
   * (vacío) en vez del real. No aplica en modo Crear (no hay
   * `UsuariosConsultPage` ni dropdown de acciones ahí), así que la espera
   * extra se salta por completo en ese caso — no agrega demora al flujo de
   * Crear, que no la necesita.
   */
  async estaCargado(timeout = 30000) {
    await this.waitVisible(this.header, timeout);
    await this.esperarSinLoader(timeout);
    const enConsulta = (await this.driver.findElements(SEL_DROPDOWN_ACCIONES)).length > 0;
    if (enConsulta) {
      await this.driver
        .wait(async () => {
          const candidatos = await this.driver.findElements(this.nombreRegistro);
          for (const el of candidatos) {
            try {
              if ((await el.isDisplayed()) && (await el.getText()).trim()) return true;
            } catch (e) {
              /* stale */
            }
          }
          return false;
        }, timeout)
        .catch(() => {});
    }
    return this;
  }

  /**
   * Nombre del registro mostrado en el header. SOBREESCRIBE el `getNombre()`
   * genérico (que toma el PRIMER elemento localizado, sin filtrar): acá hay
   * 2 candidatos por el `<h1>` "esqueleto" (ver comentario del constructor)
   * — evalúa todos y devuelve el primero VISIBLE con texto no vacío.
   */
  async getNombre() {
    const candidatos = await this.driver.findElements(this.nombreRegistro);
    for (const el of candidatos) {
      try {
        if (await el.isDisplayed()) {
          const texto = (await el.getText()).trim();
          if (texto) return texto;
        }
      } catch (e) {
        /* stale */
      }
    }
    return '';
  }

  static get ESTRATEGIAS() {
    return ESTRATEGIAS_CREAR;
  }

  static get ESTRATEGIAS_EDITAR() {
    return ESTRATEGIAS_EDITAR;
  }

  /** Control que identifica al registro (referencia de la entidad en un flujo; ver `ConfiguracionEntidadDetallePage`). */
  static get CAMPO_IDENTIFICADOR() {
    return 'Nombre Completo';
  }

  static get NOMBRE_ENTIDAD() {
    return 'usuario';
  }

  get _estrategias() {
    return this._estrategiasActuales;
  }

  /**
   * Entra en modo edición. SOBREESCRIBE el `editar()` genérico del core (que
   * busca un botón "Editar" en el header estándar): acá hay que abrir
   * `#usuario-form-dropdown-acciones` y elegir "Editar" del menú.
   */
  async editar(timeout = 10000) {
    logger.info('UsuarioDetallePage: entrar en modo edición (dropdown-acciones > Editar)');
    const dropdown = await this.waitVisible(SEL_DROPDOWN_ACCIONES, timeout);
    await dropdown.click();
    const opcionEditar = await this.waitVisible(SEL_OPCION_EDITAR, timeout);
    await opcionEditar.click();
    await this.esperarSinLoader(timeout);
    await this.waitVisible(this.btnGuardar, timeout).catch(() => {});
    await this._esperarCamposHabilitados();
    this._estrategiasActuales = ESTRATEGIAS_EDITAR;
    return { accionado: true };
  }

  /**
   * Estado boolean de "Es administrador"/"Tiene acceso a RRHH", en CUALQUIERA
   * de sus dos representaciones reales según el modo de la pantalla —
   * verificado con Selenium real (NO es lo que parecía a simple vista en una
   * captura: son dos widgets DevExtreme distintos, ninguno un
   * `<input type="checkbox">` nativo):
   *  - Editar: `.dx-switch` — SÍ tiene un `<label>` hermano dentro de
   *    `.group-field`/`.dx-field-item` (confirmado con `screenInspector`).
   *    Se lee `aria-pressed`, mismo criterio que `Form.setSwitch`.
   *  - Consulta: `.dx-checkbox` (`role="checkbox"`) — NO tiene ningún
   *    `<label>`; su texto vive en un `<span class="dx-checkbox-text">`
   *    DENTRO del propio widget. Se lee `aria-checked`.
   * `Form.getValor()` no sirve para ninguno de los dos (lee `value`, no el
   * estado marcado/pulsado) — por eso este método propio, en vez del
   * genérico.
   */
  async estadoInterruptor(label) {
    return this.driver.executeScript((lbl) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const switches = Array.from(document.querySelectorAll('.dx-switch'));
      for (const sw of switches) {
        const cont = sw.closest('.group-field, .dx-field-item');
        const l = cont && cont.querySelector('label');
        if (l && norm(l.textContent).includes(lbl)) {
          return sw.getAttribute('aria-pressed') === 'true';
        }
      }
      const checkboxes = Array.from(document.querySelectorAll('.dx-checkbox[role="checkbox"]'));
      for (const chk of checkboxes) {
        const texto = chk.querySelector('.dx-checkbox-text');
        if (texto && norm(texto.textContent).includes(lbl)) {
          return chk.getAttribute('aria-checked') === 'true';
        }
      }
      return null;
    }, label);
  }

  /**
   * Espera (poll) a que `estadoInterruptor(label)` devuelva `esperado`.
   * Confirmado con evidencia real: justo después de Guardar, la pantalla
   * pasa de Editar a Consulta (re-render) — una lectura INMEDIATA de
   * `estadoInterruptor` podía caer en ese instante de transición (ni el
   * switch de Editar ni el checkbox de Consulta presentes todavía) y
   * devolver `null` en vez del valor real ya guardado. Mismo criterio que
   * `esperarValor`/`esperarNombre` del core (poll, no lectura única).
   */
  async esperarInterruptor(label, esperado, timeout = 10000) {
    let actual = null;
    await this.driver
      .wait(async () => {
        actual = await this.estadoInterruptor(label);
        return actual === esperado;
      }, timeout)
      .catch(() => {});
    return actual;
  }

  /**
   * `src` actual de la foto del usuario (para comparar antes/después de
   * subir una).
   *
   * OJO — confirmado con evidencia real (2026-08-21): tras Guardar, esta
   * pantalla NO refresca el `<img>` en el lugar — `getFotoSrc()` llamado
   * inmediatamente después de un guardado exitoso sigue devolviendo el
   * placeholder viejo, aunque la foto nueva ya haya quedado aplicada de
   * verdad en el servidor (confirmado navegando fuera del registro y
   * reabriéndolo, y también con `driver.navigate().refresh()`: ambos
   * muestran el `src` nuevo correcto). Para leer el estado POST-guardado hay
   * que recargar la pantalla antes de llamar acá — nunca leer en el lugar
   * justo después de `guardar()`.
   */
  async getFotoSrc() {
    const img = await this.driver.findElement(By.css(SEL_FOTO.imagen));
    return img.getAttribute('src');
  }

  /**
   * Sube una foto al usuario: envía `rutaArchivo` directo al input oculto
   * (sin diálogo del SO), espera el popup "Cargar Imagen" y lo confirma con
   * SU botón "Guardar" — sin recortar/mover/ajustar nada. Requiere modo
   * Editar ya activo (no lo activa acá) — mismo mecanismo base que Solicitud
   * de Empleo (`SolicitudEmpleoDetallePage.subirFoto`), CON una diferencia
   * importante confirmada con evidencia real: acá el popup procesa la imagen
   * en el SERVIDOR tras clickear su "Guardar" (hasta ~13s reales en algún
   * registro, confirmado con Selenium — su botón "Guardar" queda con
   * spinner y deshabilitado mientras tanto) antes de cerrarse solo. Sin
   * esperar ese cierre, el siguiente paso del test (el "Guardar" GENERAL del
   * formulario) se disparaba con la foto todavía procesándose. Por eso acá
   * se espera explícito a que el overlay del popup deje de estar visible
   * antes de devolver el control.
   *
   * La foto SÍ queda aplicada correctamente en el servidor tras esto
   * (confirmado con evidencia real, ver nota en `getFotoSrc()`) — lo único
   * que no refresca solo es el `<img>` en pantalla, así que quien llame a
   * este método debe recargar antes de leer el resultado con `getFotoSrc()`.
   */
  async subirFoto(rutaArchivo, timeout = 30000) {
    logger.info('UsuarioDetallePage: subir foto');
    await this.uploader.subir(rutaArchivo);
    const overlay = By.css('[class*="ImgViewer_img_viewer_overlay"]');
    const btnGuardarOverlay = await this.waitVisible(By.xpath(SEL_FOTO.botonGuardarOverlay));
    await this.driver.executeScript('arguments[0].click()', btnGuardarOverlay);
    logger.info('UsuarioDetallePage: esperando a que el popup "Cargar Imagen" termine de procesar y cierre');
    await this.driver.wait(async () => {
      const overlays = await this.driver.findElements(overlay);
      for (const o of overlays) {
        try {
          if (await o.isDisplayed()) return false;
        } catch (e) {
          /* stale = ya cerró */
        }
      }
      return true;
    }, timeout);
  }
}

module.exports = UsuarioDetallePage;
