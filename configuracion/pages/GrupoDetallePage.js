const { By, Key, until } = require('selenium-webdriver');
const { ConfiguracionEntidadDetallePage } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const { textoIgual } = require('@triple/core/utils/assert');

/**
 * Pantalla de UN registro de "Grupos" (Configuración > Usuarios y permisos >
 * Grupos). Header `.forms-header` estándar (Crear/Consultar/acceso a Editar
 * — CERO quirks ahí, a diferencia de Usuario) — pero CREAR y EDITAR usan DOS
 * convenciones de campo DISTINTAS para "Nombre" (confirmado con Selenium
 * real, no supuesto por similitud):
 *
 *  - CREAR (`ESTRATEGIAS`, vía `GruposPage.crear()`): "Nombre" es el ÚNICO
 *    control, con un `<label>Nombre:</label>` real dentro de un
 *    `.group-field` — la convención estándar que `Form._campo()` ya soporta,
 *    así que se declara y usa como cualquier otra entidad.
 *
 *  - EDITAR (tras `editar()`): el formulario muestra "Nombre" Y "Descripción"
 *    (esta última NO existe en Crear, solo se puebla acá o llega de otra
 *    fuente), pero NINGUNO de los dos tiene un `<label>` real en su
 *    contenedor — confirmado con Selenium real que `Form._campo()`/
 *    `_campoGenerico()` (ambos buscan `.//label`) no encuentran nada. El
 *    "label" visual es un floating label DevExtreme, expuesto solo como el
 *    atributo `data-dx_placeholder` de un `div.dx-placeholder` hermano del
 *    input/textarea real — sigue presente en el DOM (aunque visualmente
 *    oculto, `dx-state-invisible`) incluso con el campo ya lleno, así que es
 *    un localizador estable. Por eso Editar usa un mecanismo PROPIO
 *    (`setCampoEditar`/`getValorEditar`/`esperarValorEditar`), no las
 *    `ESTRATEGIAS`/`Form` genéricas — igual criterio de "no asumir que Crear
 *    y Editar comparten mecanismo" ya visto en `UsuarioDetallePage`.
 *
 * Dentro de Editar hay 2 secciones en acordeón, cada una con su PROPIO botón
 * "Agregar" y su PROPIO popup independiente: "Miembros del grupo" y
 * "Permisos del grupo" — ver mapeo detallado de cada una más abajo.
 *
 * NOTIFY DE ÉXITO AL EDITAR: confirmado con evidencia real (2 corridas
 * completas, monitoreando el DOM cada 500ms durante 8s) que, a diferencia de
 * Crear (sí muestra "Operación Exitosa"), el nodo `notify_record` de Editar
 * queda SIEMPRE VACÍO — no es una carrera de timing (ya se probaron 8s, muy
 * por encima del timeout normal), la pantalla simplemente no puebla ningún
 * texto ahí para esta acción. El guardado SÍ aplica los cambios de verdad
 * (confirmado leyendo la fila del grid después, dos veces). Por eso los
 * tests de Editar de esta entidad NO deben afirmar sobre
 * `resultadoGuardado()`/`res.exito` — la evidencia real de éxito es releer
 * el valor final (grid para "Descripción", que ni Consulta ni Editar
 * exponen fuera del formulario; header/`getNombre()` para "Nombre", con
 * cuidado: el título puede truncarse con "…" si el nombre es largo, así que
 * conviene preferir también el grid para verificar "Nombre" exacto).
 *
 * "Nombre" en la vista de Editar: el `<h2 class="record-name">` de esa
 * pantalla muestra el título ESTÁTICO "Editar Grupo", NO el nombre del
 * registro (a diferencia de Consulta, donde sí muestra el nombre real) — no
 * usar `getNombre()`/`esperarNombre()` (heredados, leen `.record-name`)
 * mientras se está en modo Editar.
 *
 * "MIEMBROS DEL GRUPO" (agregar): dentro de Editar, sección en acordeón
 * (`dx-accordion-item`, título "Miembros del grupo") con su PROPIO botón
 * "Agregar" — SOLO existe una vez que se entró a Editar (confirmado con
 * Selenium real: 0 matches en Consulta). Abre un popup independiente
 * ("Agregar Usuario") con 3 selectbox — "Usuario", "Compañías permitidas",
 * "Sucursal" — NINGUNO con `<label>` real: el label visual es un `<p>` DENTRO
 * de un `<div>` hermano del propio widget (`.group-field p-0` > `<p>Usuario:
 * </p>` + `<div class="...dx-selectbox...">`), tercera convención de campo
 * distinta a las dos de arriba. En vez de reinventar la interacción con el
 * dropdown, se localiza el CONTENEDOR por XPath (`_localizadorCampoPopup`)
 * y se reutiliza `Form.elegirEnSelectbox(locator, valor)` (ya del core,
 * pensado exactamente para "selectbox dentro de un popup, sin label") — abre
 * el dropdown, elige por texto o la primera opción si no se pasa valor, y
 * cierra el overlay.
 *
 * CASCADA confirmada con Selenium real: "Compañías permitidas" y "Sucursal"
 * arrancan DESHABILITADOS (`dx-state-disabled`) y solo se habilitan uno
 * después del otro — "Compañías permitidas" tras elegir "Usuario", "Sucursal"
 * tras elegir "Compañías permitidas" — por eso `agregarMiembro` los completa
 * en ese orden estricto, esperando que cada uno se habilite antes de tocarlo.
 *
 * El popup tiene su PROPIO "Guardar" (deshabilitado hasta elegir "Usuario"),
 * independiente del "Guardar" del formulario de Grupo — confirmado con
 * Selenium real que el miembro queda agregado de INMEDIATO (persistencia
 * verificada reabriendo el registro fresco, sin pasar por el Guardar
 * general) y que el popup se CIERRA SOLO ~2.5s después de su propio Guardar
 * (no hace falta cerrarlo a mano). El notify de este Guardar SÍ funciona
 * ("Operación Exitosa") — a diferencia del Guardar general de Editar (ver
 * nota de arriba), así que acá conviene seguir usando `resultadoGuardado()`
 * para la verificación.
 *
 * "PERMISOS DEL GRUPO" (agregar): mismo patrón general que "Miembros del
 * grupo" (acordeón propio, botón "Agregar" propio, popup independiente con
 * Guardar propio que persiste de inmediato y cierra solo) — el grid de esta
 * sección muestra "Módulos"/"Roles". El popup ("Agregar Permiso") tiene 2
 * campos, "Módulo" y "Roles", con la MISMA cascada (2 campos, no 3: "Roles"
 * arranca deshabilitado y se habilita recién tras elegir "Módulo") — pero
 * usa un wrapper de label DISTINTO al de "Agregar Miembro" (`.textoGrupo`,
 * no `.group-field`) — confirmado con Selenium real que
 * `_localizadorCampoPopup` igual sirve para ambos: es puramente estructural
 * (el `<p>` seguido de un `<div>` hermano), no depende del nombre de clase
 * del wrapper. Diferencia real importante: "Roles" es un TAGBOX
 * (multi-select), no un selectbox simple como los 3 campos de "Agregar
 * Miembro" — por eso se resuelve con `Form.elegirEnTagbox` (agregado al
 * core junto con este mapeo, simétrico a `elegirEnSelectbox` pero para
 * tagbox por locator, acepta un array de valores).
 */
const ESTRATEGIAS = {
  Nombre: 'text',
};

const PLACEHOLDER_NOMBRE = 'Nombre';
const PLACEHOLDER_DESCRIPCION = 'Descripción';

class GrupoDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'grupo';
  }

  /** Contenedor del editor (Editar) cuyo floating label es `placeholder` — ver mapeo de clase. */
  _localizadorEditorEditar(placeholder) {
    return By.xpath(
      `//*[@data-dx_placeholder='${placeholder}']` +
        `/ancestor::*[contains(@class,'dx-texteditor-input-container')]//*[contains(@class,'dx-texteditor-input')]`
    );
  }

  async _inputEditar(placeholder, timeout = 10000) {
    return this.driver.wait(until.elementLocated(this._localizadorEditorEditar(placeholder)), timeout);
  }

  /**
   * Escribe en "Nombre"/"Descripción" DURANTE Editar (ver mapeo de clase —
   * no usa `setCampo`/`ESTRATEGIAS`). Reintenta ante
   * `StaleElementReferenceError` (confirmado con evidencia real: justo tras
   * entrar a "Editar", el campo puede re-renderizar entre ubicarlo y
   * escribirle — mismo motivo ya documentado en `Form.escribir`).
   */
  async setCampoEditar(placeholder, valor, intentos = 3) {
    logger.info(`GrupoDetallePage: escribir "${placeholder}" (editar)`);
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const input = await this._inputEditar(placeholder);
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input);
        await input.clear();
        await input.sendKeys(String(valor), Key.TAB);
        return;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
        logger.info(`GrupoDetallePage: "${placeholder}" "stale" (intento ${intento}/${intentos}), reintentando`);
      }
    }
  }

  /** Valor actual de "Nombre"/"Descripción" DURANTE Editar. Reintenta ante "stale" — mismo motivo que `setCampoEditar`. */
  async getValorEditar(placeholder, intentos = 3) {
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const input = await this._inputEditar(placeholder);
        return (await input.getAttribute('value')) || '';
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
      }
    }
  }

  /** Espera (poll) a que `getValorEditar(placeholder)` muestre `esperado` — mismo motivo que `esperarValor` del core. */
  async esperarValorEditar(placeholder, esperado, timeout = 10000) {
    let actual = '';
    await this.driver
      .wait(async () => {
        actual = (await this.getValorEditar(placeholder)).trim();
        return textoIgual(actual, String(esperado));
      }, timeout)
      .catch(() => {});
    return actual;
  }

  /** Azúcar: "Nombre" durante Editar (placeholder fijo). */
  setNombreEditar(valor) {
    return this.setCampoEditar(PLACEHOLDER_NOMBRE, valor);
  }

  /** Azúcar: "Descripción" durante Editar (placeholder fijo). */
  setDescripcionEditar(valor) {
    return this.setCampoEditar(PLACEHOLDER_DESCRIPCION, valor);
  }

  /** Contenedor del selectbox del popup "Agregar Miembro" cuyo label (un `<p>`, no `<label>`) es `label` — ver mapeo de clase. */
  _localizadorCampoPopup(label) {
    return By.xpath(
      `//div[contains(@class,'dx-popup-content')][.//p[normalize-space(.)='${label}:']]` +
        `//p[normalize-space(.)='${label}:']/parent::div/following-sibling::div[1]`
    );
  }

  /** Espera (poll) a que el selectbox `label` del popup deje de estar deshabilitado (ver cascada Usuario→Compañías→Sucursal). */
  async _esperarCampoPopupHabilitado(label, timeout = 10000) {
    await this.driver
      .wait(async () => {
        const els = await this.driver.findElements(this._localizadorCampoPopup(label));
        if (!els.length) return false;
        const clase = (await els[0].getAttribute('class')) || '';
        return !clase.includes('dx-state-disabled');
      }, timeout)
      .catch(() => {});
  }

  /** Abre el popup "Agregar" del acordeón `tituloAccordion` ("Miembros del grupo" / "Permisos del grupo"). Requiere modo Editar ya activo. */
  async _abrirPopupAgregar(tituloAccordion, timeout = 10000) {
    logger.info(`GrupoDetallePage: abrir "Agregar" (${tituloAccordion})`);
    const btn = await this.driver.wait(
      until.elementLocated(
        By.xpath(
          `//*[contains(@class,'dx-accordion-item')][.//*[contains(text(),'${tituloAccordion}')]]` +
            `//*[normalize-space(text())='Agregar']`
        )
      ),
      timeout
    );
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', btn);
    await this.driver.executeScript('arguments[0].click()', btn);
    await this.driver.wait(until.elementLocated(By.css('.dx-popup-content')), timeout);
  }

  /** Abre el popup "Agregar Miembro" (botón "Agregar" del acordeón "Miembros del grupo"). Requiere modo Editar ya activo. */
  async abrirAgregarMiembro(timeout = 10000) {
    return this._abrirPopupAgregar('Miembros del grupo', timeout);
  }

  /** Click en "Guardar" del popup abierto y espera (poll) a que cierre solo — ver mapeo de clase (persiste de inmediato, no depende del Guardar general). */
  async _guardarPopupYCerrar(timeout = 10000) {
    const btnGuardarPopup = await this.driver.wait(
      until.elementLocated(By.xpath("//div[contains(@class,'dx-popup-content')]//*[normalize-space(text())='Guardar']")),
      timeout
    );
    logger.info('GrupoDetallePage: Guardar (popup)');
    await this.driver.executeScript('arguments[0].click()', btnGuardarPopup);
    await this.driver
      .wait(async () => {
        const abiertos = await this.driver.findElements(By.css('.dx-popup-content'));
        for (const p of abiertos) {
          if (await p.isDisplayed().catch(() => false)) return false;
        }
        return true;
      }, timeout)
      .catch(() => {});
  }

  /**
   * Completa y guarda el popup "Agregar Miembro" (abriéndolo primero): elige
   * "Usuario" (siempre editable), luego "Compañías permitidas" (se habilita
   * tras "Usuario"), luego "Sucursal" (se habilita tras "Compañías
   * permitidas") — ver mapeo de clase para la cascada. Para cualquiera de
   * los 3, sin valor dirigido elige la PRIMERA opción disponible (mismo
   * criterio del framework para selectbox sin regla). Devuelve el texto
   * REAL elegido en cada uno.
   */
  async agregarMiembro({ usuario, companiaPermitida, sucursal } = {}) {
    await this.abrirAgregarMiembro();

    const usuarioElegido = await this.form.elegirEnSelectbox(this._localizadorCampoPopup('Usuario'), usuario);
    logger.info(`GrupoDetallePage: "Usuario" elegido -> "${usuarioElegido}"`);

    await this._esperarCampoPopupHabilitado('Compañías permitidas');
    const companiaElegida = await this.form.elegirEnSelectbox(
      this._localizadorCampoPopup('Compañías permitidas'),
      companiaPermitida
    );
    logger.info(`GrupoDetallePage: "Compañías permitidas" elegido -> "${companiaElegida}"`);

    await this._esperarCampoPopupHabilitado('Sucursal');
    const sucursalElegida = await this.form.elegirEnSelectbox(this._localizadorCampoPopup('Sucursal'), sucursal);
    logger.info(`GrupoDetallePage: "Sucursal" elegido -> "${sucursalElegida}"`);

    await this._guardarPopupYCerrar();

    return { usuario: usuarioElegido, companiaPermitida: companiaElegida, sucursal: sucursalElegida };
  }

  /** TODAS las filas (recorriendo TODAS las páginas) del grid "Miembros del grupo" (columna "Nombre de usuario"). Requiere modo Editar ya activo. */
  async filasMiembros() {
    return this._todasLasFilasAccordion('Miembros del grupo', 'miembros del grupo');
  }

  /** Elemento raíz del acordeón cuyo título matchea `tituloAccordion` (case-insensitive, substring). */
  async _elementoAccordion(tituloAccordion) {
    return this.driver.findElement(
      By.xpath(`//*[contains(@class,'dx-accordion-item')][.//*[contains(text(),'${tituloAccordion}')]]`)
    );
  }

  /**
   * TODAS las filas del acordeón `tituloAccordion`, recorriendo TODAS sus
   * páginas (clickea "Siguiente" hasta `.dx-button-disable`, igual criterio
   * que usa `DataGrid` del core para el grid principal). Ninguno de los 2
   * grids de esta pantalla ("Miembros del grupo"/"Permisos del grupo") tiene
   * buscador, así que sin recorrer todas las páginas no hay forma confiable
   * de confirmar que un cambio se aplicó.
   *
   * NO asume que lo recién agregado/editado termina en la ÚLTIMA página —
   * versión anterior de este método navegaba directo a la última página
   * antes de leer, asumiendo que un ítem recién tocado siempre aparece ahí.
   * Confirmado con Selenium real (incidente 2026-08-28, "Permisos del grupo"
   * de "qa-1") que esa asunción es FALSA cuando el módulo/usuario elegido
   * YA tenía un permiso/membresía existente: la app actualiza esa fila EN
   * SU LUGAR (le suma roles) en vez de crear una fila nueva al final — la
   * fila se queda en la página donde ya estaba (ej. página 1), no en la
   * última, y el conteo total de ítems ni se mueve. No fue una carrera de
   * refresco (el pager se midió estable durante 5s completos tras guardar);
   * es que "última página" nunca fue una posición confiable para empezar.
   * Por eso se juntan las filas de TODAS las páginas y se busca ahí.
   *
   * IMPORTANTE (confirmado real, incidente 2026-09-02): el botón "Siguiente"
   * pasa a `.dx-button-disable` MÁS RÁPIDO de lo que el cuerpo del grid
   * tarda en re-pintar la página nueva — leer las filas inmediatamente tras
   * el click (aunque ya se esperó `esperarSinLoader`, que acá no aplica: esta
   * paginación no muestra loader genérico) devolvía la página VIEJA
   * duplicada, nunca la nueva. Por eso se espera (poll) a que el contenido
   * de las filas cambie de verdad antes de darlo por leído.
   */
  async _todasLasFilasAccordion(tituloAccordion, regexTitulo, maxPaginas = 50) {
    const leerFilas = () =>
      this.driver.executeScript((patron) => {
        const acc = Array.from(document.querySelectorAll('.dx-accordion-item')).find((el) =>
          new RegExp(patron, 'i').test(el.querySelector('.dx-accordion-item-title-caption')?.textContent || '')
        );
        return acc ? Array.from(acc.querySelectorAll('.dx-data-row')).map((r) => r.textContent.trim()) : [];
      }, regexTitulo);

    let filasActuales = await leerFilas();
    const todas = [...filasActuales];

    for (let i = 0; i < maxPaginas; i++) {
      const acc = await this._elementoAccordion(tituloAccordion);
      const botones = await acc.findElements(By.css('.dx-next-button'));
      if (!botones.length) break;
      const clase = await botones[0].getAttribute('class');
      if (clase.includes('dx-button-disable')) break;

      await this.driver.executeScript('arguments[0].click()', botones[0]);
      await this.esperarSinLoader(5000).catch(() => {});

      const anteriorJSON = JSON.stringify(filasActuales);
      await this.driver
        .wait(async () => {
          const candidatas = await leerFilas();
          if (JSON.stringify(candidatas) !== anteriorJSON) {
            filasActuales = candidatas;
            return true;
          }
          return false;
        }, 5000)
        .catch(() => {});

      todas.push(...filasActuales);
    }
    return todas;
  }

  /** Abre el popup "Agregar Permiso" (botón "Agregar" del acordeón "Permisos del grupo"). Requiere modo Editar ya activo. */
  async abrirAgregarPermiso(timeout = 10000) {
    return this._abrirPopupAgregar('Permisos del grupo', timeout);
  }

  /**
   * Completa y guarda el popup "Agregar Permiso": elige "Módulo" (siempre
   * editable, selectbox simple) y luego "Roles" (tagbox multi-select, se
   * habilita recién tras elegir "Módulo" — misma cascada que "Agregar
   * Miembro"). `roles` acepta un string o un array de strings; sin valor,
   * elige solo el PRIMER rol disponible. Devuelve el "Módulo" y los "Roles"
   * REALES elegidos.
   */
  async agregarPermiso({ modulo, roles } = {}) {
    await this.abrirAgregarPermiso();

    const moduloElegido = await this.form.elegirEnSelectbox(this._localizadorCampoPopup('Módulo'), modulo);
    logger.info(`GrupoDetallePage: "Módulo" elegido -> "${moduloElegido}"`);

    await this._esperarCampoPopupHabilitado('Roles');
    const rolesElegidos = await this.form.elegirEnTagbox(this._localizadorCampoPopup('Roles'), roles);
    logger.info(`GrupoDetallePage: "Roles" elegidos -> ${JSON.stringify(rolesElegidos)}`);

    await this._guardarPopupYCerrar();

    return { modulo: moduloElegido, roles: rolesElegidos };
  }

  /** TODAS las filas (recorriendo TODAS las páginas) del grid "Permisos del grupo" (columnas "Módulos"/"Roles"). Requiere modo Editar ya activo. */
  async filasPermisos() {
    return this._todasLasFilasAccordion('Permisos del grupo', 'permisos del grupo');
  }
}

GrupoDetallePage.PLACEHOLDER_NOMBRE = PLACEHOLDER_NOMBRE;
GrupoDetallePage.PLACEHOLDER_DESCRIPCION = PLACEHOLDER_DESCRIPCION;

module.exports = GrupoDetallePage;
