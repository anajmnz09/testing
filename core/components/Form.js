const { By, Key, until } = require('selenium-webdriver');
const BaseComponent = require('./BaseComponent');
const logger = require('../utils/logger');
const config = require('../config');
const { containsTextoIgnoreCase } = require('../utils/xpath');
const { assertTextoIgual, normalizarTexto } = require('../utils/assert');

/** Normaliza el texto de un label para comparar EXACTO (recorta, saca ':'/'*' finales, minúscula). */
function _normalizarLabelTexto(s) {
  return String(s == null ? '' : s)
    .replace(/\*/g, '')
    .replace(/:\s*$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Componente reutilizable para los formularios de la app Triple. Los formularios
 * ubican cada campo en un contenedor `.group-field-*` con un `<label>` (el
 * asterisco requerido es un <span> rojo) y un editor DevExtreme. Este componente
 * permite operar los campos POR SU LABEL, sin acoplar los tests a la estructura
 * DOM interna de cada widget dx-*.
 *
 * Sigue el mismo patrón que DataGrid/NavBar: extiende BaseComponent, encapsula
 * los selectores dx-* en un solo lugar. Es aditivo (no modifica nada existente).
 */
class Form extends BaseComponent {
  _timeout() {
    return config.timeouts.explicitWaitMs;
  }

  /**
   * Contenedor de un campo por el texto de su label. Soporta TRES
   * convenciones de formulario verificadas en la app: `group-field` (markup
   * propio de la app, ej. Requisiciones), `dx-field-item` (widget nativo
   * `dxForm` de DevExtreme, ej. Crear Solicitud) y `dependiente-form-item`
   * (markup propio de "Dependientes" de Empleado — confirmado real,
   * 2026-09-10: `<div class="dependiente-form-item"><label>Parentesco:
   * <span>*</span></label><div class="dx-selectbox ...">`, mismo contenedor
   * label+editor que las otras dos). Es un OR aditivo: para una pantalla que
   * solo usa UNA convención, el DOM nunca contiene las otras, así que
   * agregar una rama no cambia ni un resultado existente — compatibilidad
   * hacia atrás garantizada por construcción, no por casualidad. `*` en vez de
   * `div`: los contenedores `dx-field-item` no siempre son `div`.
   *
   * `dx-field-item`/`dependiente-form-item` usan match EXACTO de clase
   * (padding con espacios), no `contains()` simple sobre el nombre de clase
   * (evita colisión con otros tokens que empiezan igual, ej.
   * `dx-field-item-content`).
   *
   * Por qué se agregó como convención NOMBRADA acá en vez de dejar que caiga
   * al fallback genérico (`_campoGenerico`, tercera vía en `_elemCampo`):
   * ese fallback solo se intenta DESPUÉS de que esta condición agote su
   * propio timeout completo (`config.timeouts.explicitWaitMs`, 10s default)
   * — pagar eso por CADA campo de un form de ~15 campos (como "Agregar
   * Dependiente") es demasiado costoso/lento para ser el camino normal.
   * Reconocerlo acá hace que el match sea inmediato, igual que las otras dos.
   *
   * CAUSA RAÍZ REAL confirmada por evidencia (no la del primer intento, que
   * era incorrecta): `dxForm` puede agrupar varios campos relacionados dentro
   * de UN `dx-field-item` contenedor marcado `dx-field-item-has-group` (ej.
   * "Tipo ID" envuelve a "Primer Nombre" como descendiente anidado en el
   * formulario de Solicitud de Empleo). Como `.//label` matchea CUALQUIER
   * label descendiente, el contenedor EXTERIOR del grupo también satisface
   * `.//label[contains(..., 'Primer Nombre')]` aunque su propio label visible
   * sea "Tipo ID" — y al ser el primero en orden de documento, `getValor()`/
   * `escribir()` operaban sobre el campo equivocado. Fix: excluir cualquier
   * match que tenga un DESCENDIENTE que también matchee (quedarse con el más
   * interno/específico). Para pantallas sin agrupamiento (ej. Requisiciones)
   * esta exclusión nunca se activa — no cambia ningún resultado existente.
   */
  _campo(label) {
    const condicion =
      `(contains(@class,'group-field') or ` +
      `contains(concat(' ', normalize-space(@class), ' '), ' dx-field-item ') or ` +
      `contains(concat(' ', normalize-space(@class), ' '), ' dependiente-form-item ')) ` +
      `and .//label[${containsTextoIgnoreCase(label)}]`;
    return By.xpath(`//*[${condicion} and not(.//*[${condicion}])]`);
  }

  /**
   * TERCERA convención de formulario (verificada en "Razones de Salidas",
   * Configuración > Empleados): ni `group-field` ni `dx-field-item` — un
   * `<label>` suelto (sin clase distintiva en su contenedor, ej.
   * `<div class="pt-15"><label>Razón: *</label>...`) seguido de su editor
   * como hermano. Se localiza por "el padre de un `<label>` cuyo texto
   * matchea", con la misma exclusión anti-colisión (quedarse con el más
   * interno) que `_campo`.
   */
  _campoGenerico(label) {
    const condicion = `label[${containsTextoIgnoreCase(label)}]`;
    return By.xpath(`//*[${condicion} and not(.//*[${condicion}])]`);
  }

  /**
   * Localiza el contenedor de un campo. Intenta primero las DOS
   * convenciones conocidas (`_campo`); si ninguna aparece dentro del
   * timeout, cae a `_campoGenerico` (tercera convención) como ÚLTIMO
   * recurso — así una pantalla que ya funciona con las dos primeras nunca
   * paga el costo ni el riesgo de la tercera (nunca llega a intentarla), y
   * solo una pantalla que realmente la necesita la usa.
   *
   * Opt-in `form.soloGenerica = true`: para una pantalla que SABE que solo usa la tercera convención (`<label>` + editor sin clase
   * propia, ej. "Crear asignación" de Herramientas) y no debe pagar el timeout completo de las dos primeras en cada campo. Por
   * defecto `false`: ningún formulario existente cambia.
   */
  async _elemCampo(label, timeoutMs) {
    if (this.soloGenerica) return this._mejorCandidato(this._campoGenerico(label), label, timeoutMs);
    try {
      return await this._mejorCandidato(this._campo(label), label, timeoutMs);
    } catch (e) {
      return this._mejorCandidato(this._campoGenerico(label), label, timeoutMs);
    }
  }

  /**
   * Espera a que `locator` matchee, y si matchea MÁS DE UN contenedor,
   * prefiere el que tiene una coincidencia EXACTA de label sobre uno que
   * solo la contiene como SUBSTRING. Sin esto, dos campos donde el label de
   * uno es substring literal del otro (ej. "Rate" dentro de "Usar Rate":
   * ambos son `dx-field-item` HERMANOS, ninguno anidado dentro del otro, así
   * que la exclusión anti-colisión de `_campo`/`_campoGenerico` — pensada
   * para el caso ANIDADO, ver su comentario — no descarta a ninguno de los
   * dos) hacen que `_campo('Rate')` matchee AMBOS contenedores, y
   * `until.elementLocated` se quedaba con el primero en orden de documento
   * ("Usar Rate", un switch sin `.dx-texteditor-input`) — confirmado con
   * evidencia real en Categoría Actividades: escribir en "Rate" fallaba
   * buscando el editor dentro del contenedor de OTRO campo. Sin ambigüedad
   * (el caso de siempre, un solo match), se comporta exactamente igual que
   * antes. Si hay ambigüedad y NINGÚN candidato matchea exacto, se conserva
   * el comportamiento previo (el primero) en vez de fallar.
   */
  async _mejorCandidato(locator, label, timeoutMs = this._timeout()) {
    await this.driver.wait(until.elementLocated(locator), timeoutMs);
    const candidatos = await this.driver.findElements(locator);
    if (candidatos.length <= 1) return candidatos[0];

    const objetivo = _normalizarLabelTexto(label);
    for (const candidato of candidatos) {
      try {
        const labels = await candidato.findElements(By.css('label'));
        for (const lbl of labels) {
          if (_normalizarLabelTexto(await lbl.getText()) === objetivo) return candidato;
        }
      } catch (e) {
        /* candidato "stale" entre el findElements y la lectura: se descarta, sigue con el resto */
      }
    }
    return candidatos[0];
  }

  /** CSS de `_opcionLocator()`, como STRING — para usar dentro de `executeScript` (ver esos métodos más abajo). */
  _opcionSelectorCss() {
    return '.dx-list-item, .dx-overlay-content .dx-data-row';
  }

  _opcionLocator() {
    return By.css(this._opcionSelectorCss());
  }

  /**
   * Espera y devuelve el primer item VISIBLE del dropdown abierto (evita
   * items pre-renderizados ocultos) — ver nota de rendimiento en
   * `_esperarOverlayCerrado`: un solo `executeScript` en vez de `isDisplayed()`
   * elemento por elemento (el elemento DOM devuelto por `executeScript` se
   * hidrata como WebElement normal, usable con `.click()`/`.getText()`).
   *
   * `omitirPlaceholder` (opt-in): salta el item que es solo un placeholder tipo "---Seleccionar---" (no es una opción real y
   * elegirlo no cambia nada); por defecto NO se omite, para no alterar los formularios que ya dependen de este comportamiento.
   */
  async _primerItemVisible({ omitirPlaceholder = false } = {}) {
    return this.driver.wait(async () => {
      const el = await this.driver.executeScript(
        (sel, omitir) =>
          Array.from(document.querySelectorAll(sel)).find(
            (e) => e.offsetParent !== null && !(omitir && /^s*-{2,}[^-]*-{2,}s*$/.test(e.innerText || ''))
          ) || null,
        this._opcionSelectorCss(),
        omitirPlaceholder
      );
      return el || false;
    }, this._timeout());
  }

  /**
   * Quita acentos/diacríticos, pasa a minúsculas, colapsa espacios múltiples y
   * recorta los bordes. Base de TODA comparación de texto contra opciones de
   * un dropdown/lista/treeview del framework — no un caso puntual.
   */
  _normalizarTexto(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Distancia de Levenshtein clásica (programación dinámica, O(m·n), sin
   * dependencias externas): mínimo de inserciones/borrados/sustituciones para
   * convertir `a` en `b`.
   */
  _levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const fila = new Array(n + 1);
    for (let j = 0; j <= n; j++) fila[j] = j;
    for (let i = 1; i <= m; i++) {
      let anterior = fila[0];
      fila[0] = i;
      for (let j = 1; j <= n; j++) {
        const temp = fila[j];
        fila[j] = a[i - 1] === b[j - 1] ? anterior : 1 + Math.min(anterior, fila[j], fila[j - 1]);
        anterior = temp;
      }
    }
    return fila[n];
  }

  /** Similitud 0..1 entre dos textos YA normalizados (1 = idénticos, 0 = nada en común). */
  _similitud(a, b) {
    if (!a.length && !b.length) return 1;
    return 1 - this._levenshtein(a, b) / Math.max(a.length, b.length);
  }

  /**
   * Espera y devuelve el item VISIBLE que mejor coincide con `texto`.
   * `selectorCss` es opcional: permite apuntar a otro tipo de item (ej. nodos
   * de un treeview) sin duplicar la lógica de espera.
   *
   * SELECTOR TOLERANTE — comportamiento ESTÁNDAR del framework para cualquier
   * dropdown/selectbox/lista que se elija por texto (no una solución puntual
   * para un solo caso). Verificado en la app real: exigir coincidencia casi
   * exacta rompía con diferencias mínimas ajenas al dato en sí — ej. "Selección
   * de una opcion" (sin el acento de "opción") jamás encontraba la opción real
   * de la app y agotaba el timeout, igual que antes pasó con "cedula" vs.
   * "Cedula".
   *
   * Orden de búsqueda:
   *  1. Coincidencia por SUBSTRING ya normalizado (sin acentos, minúsculas,
   *     espacios colapsados) — mismo criterio de siempre, ahora tolerante a
   *     acentos/espacios además de mayúsculas. Rápido, sin calcular similitud.
   *  2. Si ninguna coincide así, similitud por distancia de Levenshtein contra
   *     TODAS las opciones visibles; se elige la de mayor puntaje si supera
   *     `umbral` (default 0.85 = 85%, dentro del rango 80–90% razonable:
   *     tolera acentos sueltos y pequeños errores de tipeo, sin llegar a
   *     confundir opciones realmente distintas entre sí).
   *
   * Si NADA supera el umbral al agotar el timeout, no se adivina: se lanza un
   * error con las opciones REALMENTE visibles, para diagnóstico accionable
   * (mismo criterio que ya usa `FormsHeader` para sus botones).
   */
  /**
   * Intenta desplazar una lista virtualizada de DevExtreme (`dx-list` con
   * scroll "simulado", no nativo — `scrollTop` no le hace nada) usando el
   * scroll de RUEDA del mouse de Selenium (`actions().scroll`) con ORIGEN en
   * un item YA VISIBLE de la lista. Confirmado con evidencia real: el
   * contenedor scrolleable (`.dx-scrollable-container`) no tiene tamaño
   * medible para Selenium ("no size and location") y un `WheelEvent`
   * sintético por `dispatchEvent` no lo mueve — pero el scroll real de
   * Selenium con origen en un ítem SÍ dispara que DevExtreme renderice más
   * opciones. Si no hay nada scrolleable (lista corta) simplemente no pasa
   * nada; se ignora cualquier error.
   */
  async _intentarScrollLista(itemVisible, cantidadPx = 200) {
    try {
      await this.driver.actions().scroll(0, 0, 0, cantidadPx, itemVisible).perform();
    } catch (e) {
      /* lista no scrolleable, o el item dejó de ser interactuable — se ignora */
    }
  }

  async _itemVisiblePorTexto(texto, selectorCss, { umbral = 0.85 } = {}) {
    const selector = selectorCss || this._opcionSelectorCss();
    const buscado = this._normalizarTexto(texto);
    let disponibles = [];
    let ultimoConjuntoScrolleado = null;

    try {
      return await this.driver.wait(async () => {
        // UN solo `executeScript` en vez de `isDisplayed()`+`getText()` elemento
        // por elemento — ver nota de rendimiento en `_esperarOverlayCerrado`
        // (confirmado real: catálogo "Usuario" de Grupos con 1000+ opciones
        // volvía esto muy lento, varios round-trips de WebDriver por ítem, en
        // CADA vuelta de este `driver.wait`). El resto de la lógica de
        // matching (exacto/substring/similitud/scroll) queda IGUAL, solo
        // cambia cómo se recolectan `{el, texto}` de lo visible.
        const crudos = await this.driver.executeScript((sel) => {
          return Array.from(document.querySelectorAll(sel))
            .filter((el) => el.offsetParent !== null)
            .map((el) => ({ el, texto: (el.textContent || '').trim() }));
        }, selector);
        const visibles = crudos.map((v) => ({ el: v.el, texto: v.texto, normalizado: this._normalizarTexto(v.texto) }));
        disponibles = visibles.map((v) => v.texto);
        if (!visibles.length) return false;

        // Coincidencia EXACTA (tras normalizar) SIEMPRE gana antes que una
        // por substring: verificado un caso real donde una opción es
        // substring literal de otra ("Empleado" dentro de "Desempleado") —
        // buscar "Empleado" por substring podía coincidir con "Desempleado"
        // primero según el orden/momento de render, seleccionando la opción
        // equivocada (o una todavía animándose, con "stale element" o cuelgue
        // posterior). Sin esto se pierde la garantía que ya tenía el
        // matching exacto de siempre.
        const exactoIgual = visibles.find((v) => v.normalizado === buscado);
        if (exactoIgual) return exactoIgual.el;

        const exacto = visibles.find((v) => v.normalizado.includes(buscado));
        if (exacto) return exacto.el;

        let mejor = null;
        let mejorPuntaje = 0;
        for (const v of visibles) {
          const puntaje = this._similitud(buscado, v.normalizado);
          if (puntaje > mejorPuntaje) {
            mejorPuntaje = puntaje;
            mejor = v;
          }
        }
        if (mejor && mejorPuntaje >= umbral) {
          logger.info(
            `Form: "${texto}" no coincide exacto; se usa la opción más similar "${mejor.texto}" (${Math.round(mejorPuntaje * 100)}% similitud)`
          );
          return mejor.el;
        }

        // Nada coincidió entre lo VISIBLE ahora: si es una lista larga
        // virtualizada, la opción buscada puede estar más abajo, todavía sin
        // renderizar (confirmado real: "Tipo concepto" de Concepto de Nómina
        // solo renderiza ~11 de más de 40 opciones sin scroll). Se scrollea
        // un paso antes del siguiente poll — solo cuando el conjunto visible
        // cambió desde el último intento, para no scrollear sin sentido una
        // vez llegado al final de una lista corta o al fondo real.
        const conjuntoActual = disponibles.join('|');
        if (conjuntoActual !== ultimoConjuntoScrolleado) {
          ultimoConjuntoScrolleado = conjuntoActual;
          await this._intentarScrollLista(visibles[visibles.length - 1].el);
        }
        return false;
      }, this._timeout());
    } catch (e) {
      throw new Error(
        `Form: no se encontró ninguna opción suficientemente similar a "${texto}". ` +
          `Opciones disponibles: ${disponibles.length ? disponibles.join(', ') : '(ninguna visible)'}`
      );
    }
  }

  /**
   * Espera a que no quede ningún item de dropdown visible.
   *
   * Confirmado con evidencia real (Grupos, catálogo "Usuario" con 1000+
   * elementos reales): la versión anterior consultaba `isDisplayed()` de a
   * UN elemento por vez (round-trip de WebDriver cada uno) — para un
   * catálogo grande eso es lento en sí (varios segundos) Y se repetía en
   * CADA vuelta de este `driver.wait` mientras el overlay seguía abierto,
   * multiplicando el costo. Un único `executeScript` resuelve la visibilidad
   * de TODOS los elementos del lado del navegador, en una sola ida y vuelta,
   * sin cambiar el criterio (mismo `_opcionSelectorCss()`, mismo "visible" =
   * `offsetParent !== null`, equivalente práctico de `isDisplayed()` acá).
   */
  async _esperarOverlayCerrado() {
    await this.driver.wait(
      () =>
        this.driver.executeScript(
          (sel) => !Array.from(document.querySelectorAll(sel)).some((el) => el.offsetParent !== null),
          this._opcionSelectorCss()
        ),
      this._timeout()
    );
  }

  /** Textos de los items de dropdown visibles ahora (un solo round-trip). */
  async _textosItemsVisibles() {
    return this.driver.executeScript((sel) => {
      return Array.from(document.querySelectorAll(sel))
        .filter((el) => el.offsetParent !== null)
        .map((el) => (el.textContent || '').trim())
        .join('|');
    }, this._opcionSelectorCss());
  }

  /**
   * Espera a que el filtro de un dropdown YA se haya aplicado tras escribir:
   * primero a que la lista visible cambie respecto de `antes` (snapshot previo
   * a escribir; si el filtro no cambia nada, se sigue tras `cambioMs`), y luego
   * a que quede estable (dos lecturas iguales). Evita matchear/clickear items
   * de la lista SIN filtrar que el re-render deja ocultos (confirmado real:
   * `ElementNotInteractableError` en Requisición de Crear Solicitud).
   */
  async _esperarFiltroAplicado(antes, { cambioMs = 1500, estableMs = 3000 } = {}) {
    await this.driver.wait(async () => (await this._textosItemsVisibles()) !== antes, cambioMs).catch(() => {});
    let previo = null;
    await this.driver
      .wait(async () => {
        const actual = await this._textosItemsVisibles();
        const estable = actual === previo;
        previo = actual;
        return estable;
      }, estableMs)
      .catch(() => {});
  }

  /** True si hay algún item de dropdown visible en pantalla — ver nota de rendimiento en `_esperarOverlayCerrado`. */
  async _hayItemVisible() {
    return this.driver.executeScript(
      (sel) => Array.from(document.querySelectorAll(sel)).some((el) => el.offsetParent !== null),
      this._opcionSelectorCss()
    );
  }

  /**
   * Abre el dropdown de un selectbox/tagbox por label y espera (timeout completo,
   * tolerante a server lento) a que aparezca un item visible. Se mantiene simple
   * y seguro (un solo click, sin re-clicks que puedan cerrar por toggle); la rara
   * intermitencia en la que el click no dispara la apertura se cubre con el
   * reintento a nivel de test (TEST_RETRIES), estándar para E2E contra un server
   * externo variable.
   */
  async _abrirDropdown(label) {
    const campo = await this._elemCampo(label);
    await this._abrirDropdownEn(campo);
  }

  /**
   * Abre el dropdown de un selectbox/tagbox a partir de su ELEMENTO RAÍZ (no de
   * un label). Es la misma mecánica que `_abrirDropdown`, extraída para poder
   * operar dropdowns que NO viven en un `group-field` con label —por ejemplo, un
   * `.dx-selectbox` dentro de un popup—. `_abrirDropdown` ahora la reutiliza, así
   * que no hay lógica duplicada.
   *
   * `jsClick`: los selectbox dentro de un popup modal a veces no responden al
   * click nativo de Selenium (el overlay intercepta el evento); ahí se abre con
   * un click por JS —verificado en el popup "Importar Documentos"—. El camino por
   * label mantiene el click nativo de siempre (comportamiento sin cambios).
   */
  async _abrirDropdownEn(rootEl, { jsClick = false } = {}) {
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', rootEl);
    // Espera a que la posición de scroll se ESTABILICE antes de clickear: un
    // scroll que anima (suave) puede seguir en movimiento cuando el click ya
    // se disparó, sobre todo en campos que requieren desplazamiento largo —
    // verificado en "Estado laboral" (Solicitud de Empleo, más abajo en la
    // página tras Editar): el click nativo caía en una posición que ya había
    // cambiado, dejando el dropdown sin abrir (timeout) o el item recién
    // ubicado stale. Mismo criterio de estabilidad ya usado en
    // `identificarYEsperarAutollenado` (dos lecturas consecutivas iguales),
    // acotado a 2s para no penalizar el caso normal (sin scroll animado).
    let anterior = null;
    await this.driver
      .wait(async () => {
        const actual = await this.driver.executeScript((el) => {
          const r = el.getBoundingClientRect();
          return `${Math.round(r.x)},${Math.round(r.y)}`;
        }, rootEl);
        const estable = actual === anterior;
        anterior = actual;
        return estable;
      }, 2000)
      .catch(() => {});
    const boton = await rootEl.findElement(By.css('.dx-dropdowneditor-button, .dx-texteditor-input'));
    if (jsClick) {
      await this.driver.executeScript('arguments[0].click()', boton);
    } else {
      await boton.click();
    }
    await this.driver.wait(() => this._hayItemVisible(), this._timeout());
    await this._esperarSiSinDatos();
  }

  /**
   * True si el dropdown recién abierto muestra ÚNICAMENTE el placeholder "Sin
   * datos para mostrar" (ni cero items —eso es un error de selector, no aplica—
   * ni items reales) — ver nota de rendimiento en `_esperarOverlayCerrado`.
   */
  async _soloSinDatos() {
    return this.driver.executeScript((sel) => {
      const visibles = Array.from(document.querySelectorAll(sel)).filter((el) => el.offsetParent !== null);
      return visibles.length === 1 && visibles[0].textContent.trim() === 'Sin datos para mostrar';
    }, this._opcionSelectorCss());
  }

  /**
   * Regla "Sin datos para mostrar" (permanente, en la infraestructura común):
   * si el dropdown recién abierto muestra ÚNICAMENTE ese placeholder, espera
   * 5000ms FIJOS —una sola vez, sin bucles ni reintentos— y vuelve a consultar
   * la lista SIN cerrar el dropdown. Si ya hay opciones reales, no hace nada
   * (comportamiento normal). Si tras los 5s sigue sin datos, solo lo registra y
   * continúa: el comportamiento normal del framework decide qué pasa después
   * (fallar o seguir, según el campo) — no se agrega lógica especial.
   *
   * Vive en `_abrirDropdownEn`, el único punto de apertura de dropdown que usan
   * `_abrirDropdown` (por label) y `elegirEnSelectbox` (por locator, popups). Por
   * eso lo heredan automáticamente TODOS los controles basados en lista —
   * SelectBox, TagBox, SearchAndSelect, Lookup— de cualquier módulo, sin tocar
   * ningún Page Object ni duplicar código.
   */
  async _esperarSiSinDatos() {
    if (!(await this._soloSinDatos())) return;
    logger.info('Form: dropdown con únicamente "Sin datos para mostrar" — esperando 5000ms fijos (una sola vez)');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if (await this._soloSinDatos()) {
      logger.info('Form: el control continúa sin datos tras los 5s — se sigue con el comportamiento normal del framework');
    }
  }

  /**
   * Textos de las opciones de un selectbox por label (abre el dropdown, las lee y lo cierra SIN elegir). Excluye el placeholder tipo
   * "---Seleccionar---". Solo lee: no cambia el valor del campo.
   */
  async opcionesDe(label) {
    await this._abrirDropdown(label);
    const textos = (await this._textosItemsVisibles()).split('|').map((t) => t.trim()).filter((t) => t && !/^-{2,}[^-]*-{2,}$/.test(t));
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this._esperarOverlayCerrado().catch(() => {});
    return textos;
  }

  /**
   * Elige en un selectbox el PRIMER candidato de `siguienteCandidato()` que EXISTA entre sus opciones (sin distinguir mayúsculas ni
   * acentos). Para catálogos que se administran en otro lado (Configuración): un candidato del banco de datos que allí no existe no se
   * puede asignar, así que se salta (cada llamada avanza el cursor del banco, determinista por `DATOS_SEMILLA`) y queda en el log. Si
   * ninguno de `intentos` candidatos existe, elige la primera opción real del catálogo y lo avisa. Devuelve el texto REAL elegido.
   * @param {string} label
   * @param {() => string} siguienteCandidato  p. ej. `() => datos.resolver('beneficio.tipo')`
   */
  async elegirDelCatalogo(label, siguienteCandidato, { intentos = 30 } = {}) {
    const opciones = await this.opcionesDe(label);
    if (!opciones.length) throw new Error(`Form: el catálogo de "${label}" no tiene opciones.`);
    let elegido = null;
    const descartados = [];
    for (let i = 0; i < intentos && !elegido; i += 1) {
      const candidato = siguienteCandidato();
      elegido = opciones.find((o) => normalizarTexto(o) === normalizarTexto(candidato)) || null;
      if (!elegido) descartados.push(candidato);
    }
    if (!elegido) {
      elegido = opciones[0];
      logger.warn(`Form: ningún candidato del banco existe en el catálogo de "${label}" [${opciones.join(', ')}]: se usa "${elegido}"`);
    } else if (descartados.length) {
      logger.info(`Form: candidatos del banco que no están en el catálogo de "${label}" (omitidos): ${[...new Set(descartados)].join(', ')}`);
    }
    return elegido;
  }

  /**
   * Selecciona en un selectbox la primera opción válida y devuelve su texto.
   * (Cumple la regla: "para selectbox, primera opción válida si no hay regla".)
   *
   * Reintenta ante `StaleElementReferenceError` (mismo criterio que
   * `escribir()`/`seleccionar()`, que ya lo tenían): confirmado con
   * evidencia real (Crear Empleado, campo "País" recién tras cambiar de
   * sección del formulario) que `_abrirDropdown` puede toparse con el
   * contenedor del campo yéndose stale justo cuando la sección todavía está
   * re-renderizando — antes, esta era la ÚNICA operación de campo del
   * framework sin ese reintento, así que la carrera se colaba siempre por
   * acá primero.
   */
  async seleccionarPrimera(label, intentos = 3, { omitirPlaceholder = false } = {}) {
    logger.info(`Form: seleccionar primera opción de "${label}"`);
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        await this._abrirDropdown(label);
        const item = await this._primerItemVisible({ omitirPlaceholder });
        const texto = (await item.getText()).trim();
        try {
          await item.click();
        } catch (clickErr) {
          // Confirmado con evidencia real ("Puesto de trabajo" de Crear
          // Empleado): el primer item del catálogo puede renderizar detrás de
          // un botón sticky del header del formulario — el click NATIVO tira
          // "element click intercepted" (otro elemento recibiría el click en
          // ese punto) pese a que el item ubicado es el correcto. Fallback a
          // click por JS (mismo criterio ya establecido en el framework para
          // headers sticky, ej. `RequisicionFormPage.guardar()`), sin
          // reintentar desde cero: el item ya está correctamente ubicado.
          if (clickErr.name !== 'ElementClickInterceptedError') throw clickErr;
          logger.info(`Form: click interceptado al seleccionar primera opción de "${label}", reintentando por JS`);
          await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', item);
          await this.driver.executeScript('arguments[0].click()', item);
        }
        await this._esperarOverlayCerrado();
        return texto;
      } catch (e) {
        if (e.name !== 'StaleElementReferenceError' || intento === intentos) throw e;
        logger.info(`Form: "${label}" "stale" al seleccionar primera opción (intento ${intento}/${intentos}), reintentando`);
      }
    }
  }

  /**
   * Selecciona una opción por su texto exacto/contenido en un selectbox.
   *
   * Reintenta ante "stale element" (mismo criterio ya usado en
   * `elegirEnSelectbox`): el item ubicado por `_itemVisiblePorTexto` puede
   * quedar stale si el dropdown termina de asentarse/re-renderiza entre que
   * se lo localiza y se lo clickea — verificado en un campo recién habilitado
   * al entrar en modo Editar (el widget aún se está inicializando).
   */
  async seleccionar(label, opcionTexto, intentos = 2) {
    let ultimoError;
    for (let i = 0; i < intentos; i++) {
      try {
        logger.info(`Form: seleccionar "${opcionTexto}" en "${label}"`);
        await this._abrirDropdown(label);
        const item = await this._itemVisiblePorTexto(opcionTexto);
        await item.click();
        await this._esperarOverlayCerrado();
        return;
      } catch (err) {
        ultimoError = err;
        if (!/stale element/i.test(err.message) || i === intentos - 1) throw err;
        logger.info(`Form: reintentando seleccionar tras stale (intento ${i + 1}/${intentos})`);
      }
    }
    throw ultimoError;
  }

  /**
   * Selecciona una opción en un selectbox identificado por un LOCATOR (no por
   * label). Sirve para los dropdowns que no están en un `group-field` — típico de
   * popups/diálogos (ej. la clasificación en "Importar Documentos"). Reutiliza
   * TODA la mecánica de overlay ya verificada (`_itemVisiblePorTexto`,
   * `_primerItemVisible`, `_esperarOverlayCerrado`), así que no duplica nada.
   *
   * Con `valor` provisto, ESCRIBE en el propio editor para filtrar antes de
   * buscar la coincidencia — mismo criterio que `SearchAndSelectStrategy`
   * (equivalente "por locator" en vez de "por label"): sin este paso, un
   * catálogo grande dependía solo del scroll de respaldo de
   * `_itemVisiblePorTexto`, más lento y más frágil que filtrar. Se escribe en
   * el input DENTRO de `root` (el mismo que abrió el dropdown) — nunca
   * `_inputBusqueda(label)`, cuyo fallback busca CUALQUIER input visible
   * dentro de `.dx-popup-content`: con más de un selectbox en el mismo popup
   * (caso real: "Agregar Miembro" de Grupos, 3 campos) escribiría en el
   * campo equivocado.
   *
   * @param locator     By.* del `.dx-selectbox`/`.dx-dropdowneditor`
   * @param valor       texto de la opción; si es vacío/undefined, toma la primera
   * @returns {Promise<string>} el texto REAL de la opción elegida
   */
  async elegirEnSelectbox(locator, valor, intentos = 2) {
    logger.info(`Form: seleccionar ${valor ? `"${valor}"` : 'primera opción'} en selectbox por locator`);
    let ultimoError;
    for (let i = 0; i < intentos; i++) {
      try {
        // Se re-localiza el root en CADA intento: en un popup recién montado el
        // elemento puede quedar stale mientras el modal termina de renderizar.
        const root = await this.waitVisible(locator);
        await this._abrirDropdownEn(root, { jsClick: true });
        if (valor !== undefined && valor !== null && valor !== '') {
          const input = await root.findElement(By.css('.dx-texteditor-input'));
          await input.sendKeys(Key.chord(Key.CONTROL, 'a'), String(valor));
        }
        const item =
          valor === undefined || valor === null || valor === ''
            ? await this._primerItemVisible()
            : await this._itemVisiblePorTexto(valor);
        // `item.getText()` (Selenium) confirmado con evidencia real que
        // devuelve '' en headless para estos ítems (`display: table`, layout
        // de tabla de DevExtreme) — mismo tipo de inconsistencia headless que
        // el click nativo de más abajo. `textContent` vía `executeScript` es
        // consistente con cómo ya se leyó este mismo texto en
        // `_itemVisiblePorTexto`/`_primerItemVisible`.
        const texto = (await this.driver.executeScript('return arguments[0].textContent', item)).trim();
        // Click por JS, no nativo — mismo motivo que `jsClick` en
        // `_abrirDropdownEn` (el overlay del popup intercepta el click nativo):
        // confirmado con evidencia real (headless) que el ítem recién
        // encontrado por polling puede no ser interactable un instante después
        // (`ElementNotInteractableError`), incluso reintentando toda la
        // secuencia — un click nativo idéntico, hecho de una sola vez sin
        // pasar por el poll, sí funciona.
        await this.driver.executeScript('arguments[0].click()', item);
        await this._esperarOverlayCerrado();
        return texto;
      } catch (err) {
        ultimoError = err;
        // "not interactable" confirmado con evidencia real (headless, catálogo
        // "Usuario" filtrado por texto): mismo origen que el "stale element" ya
        // contemplado — el ítem recién encontrado se re-renderiza (DevExtreme
        // reemplaza el nodo, no lo muta) en el instante entre ubicarlo y
        // clickearlo, así que reintentar (re-ubicar todo desde cero) resuelve
        // igual que con "stale element".
        if (!/stale element|not interactable/i.test(err.message) || i === intentos - 1) throw err;
        logger.info(`Form: reintentando elegirEnSelectbox tras error transitorio (intento ${i + 1}/${intentos})`);
      }
    }
    throw ultimoError;
  }

  /**
   * Como `elegirEnSelectbox`, pero para un TAGBOX (multi-select) identificado
   * por un LOCATOR (no por label) — mismo caso de uso: un tagbox dentro de un
   * popup sin `group-field`/`<label>` (ej. "Roles" del popup "Agregar
   * Permiso" de Grupos). Acepta un string, un array de strings (varios tags,
   * en orden) o vacío (toma solo el PRIMERO disponible — mismo criterio
   * "primera opción si no hay regla" que el resto del framework). El
   * dropdown se abre UNA sola vez y los tags se clickean en secuencia sobre
   * la MISMA lista abierta (igual mecánica que `SearchAndSelectStrategy`
   * para tagbox: no hace falta reabrir entre uno y otro); un tagbox no
   * cierra solo al elegir, así que cierra con ESCAPE al final.
   *
   * A DIFERENCIA de `elegirEnSelectbox`, acá NO se escribe en el editor para
   * filtrar — a propósito, no un olvido: es el mismo criterio ya documentado
   * en `SearchAndSelectStrategy` para `opciones.multiple` (escribir en el
   * buscador de un TagBox reprodujo, en al menos un caso real, que el
   * overlay quedara reportándose "abierto" para Selenium aunque la UI ya
   * había cerrado — `_esperarOverlayCerrado()` nunca resolvía). Se depende
   * del scroll de respaldo de `_itemVisiblePorTexto` para catálogos largos.
   *
   * @param locator  By.* del `.dx-tagbox`
   * @param valores  string | string[] | undefined/null/'' (primera opción)
   * @returns {Promise<string[]>} los textos REALES elegidos, en orden
   */
  async elegirEnTagbox(locator, valores, intentos = 2) {
    const lista =
      valores === undefined || valores === null || valores === ''
        ? [undefined]
        : Array.isArray(valores)
          ? valores
          : [valores];
    logger.info(
      `Form: seleccionar ${lista[0] === undefined ? 'primera opción' : JSON.stringify(lista)} en tagbox por locator`
    );
    let ultimoError;
    for (let i = 0; i < intentos; i++) {
      const textos = [];
      try {
        // Se re-localiza el root en CADA intento: en un popup recién montado el
        // elemento puede quedar stale mientras el modal termina de renderizar.
        const root = await this.waitVisible(locator);
        await this._abrirDropdownEn(root, { jsClick: true });
        for (const valor of lista) {
          const item =
            valor === undefined ? await this._primerItemVisible() : await this._itemVisiblePorTexto(valor);
          // `textContent` en vez de `getText()` — ver comentario en `elegirEnSelectbox`.
          textos.push((await this.driver.executeScript('return arguments[0].textContent', item)).trim());
          // Click por JS — mismo motivo que en `elegirEnSelectbox` (ver su comentario).
          await this.driver.executeScript('arguments[0].click()', item);
        }
        await this.driver.actions().sendKeys(Key.ESCAPE).perform();
        await this._esperarOverlayCerrado();
        return textos;
      } catch (err) {
        ultimoError = err;
        // Mismo criterio que `elegirEnSelectbox`: "not interactable" es el
        // mismo tipo de carrera transitoria que "stale element" acá.
        if (!/stale element|not interactable/i.test(err.message) || i === intentos - 1) throw err;
        logger.info(`Form: reintentando elegirEnTagbox tras error transitorio (intento ${i + 1}/${intentos})`);
      }
    }
    throw ultimoError;
  }

  /**
   * Selecciona en un tagbox (multi-select) el item cuyo texto contiene `texto`
   * y cierra el dropdown con Escape (un tagbox no cierra solo al elegir).
   */
  async seleccionarTagPorTexto(label, texto) {
    logger.info(`Form: seleccionar tag "${texto}" en "${label}"`);
    await this._abrirDropdown(label);
    const item = await this._itemVisiblePorTexto(texto);
    await item.click();
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this._esperarOverlayCerrado();
  }

  /**
   * Selecciona el primer valor de un tagbox (multi-select) y lo cierra.
   * Devuelve el texto elegido.
   */
  async seleccionarPrimerTag(label) {
    logger.info(`Form: seleccionar primer tag de "${label}"`);
    await this._abrirDropdown(label);
    const item = await this._primerItemVisible();
    const texto = (await item.getText()).trim();
    await item.click();
    // el tagbox no cierra solo: cerrar con Escape
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this._esperarOverlayCerrado();
    return texto;
  }

  /**
   * Agrega un tag de TEXTO LIBRE a un tagbox (distinto de `seleccionarPrimerTag`/
   * `seleccionarTagPorTexto`, que eligen de un CATÁLOGO existente): click en el
   * editor, escribe `texto` y confirma con ENTER — verificado en la app real
   * (sección "Etiquetas" del formulario de Solicitud de Empleo). No abre
   * dropdown ni requiere que el texto exista de antemano.
   *
   * Sin `texto` (undefined/vacío) no hace nada — mismo criterio que el resto
   * de las estrategias ante un valor no provisto (no hay un tag "por defecto"
   * razonable para agregar).
   */
  async escribirTagLibre(label, texto) {
    if (texto === undefined || texto === null || texto === '') return undefined;
    logger.info(`Form: agregar tag libre "${texto}" en "${label}"`);
    const campo = await this._elemCampo(label);
    const input = await this._inputDeCampo(campo, label);
    await this._escribirTagsEnInput(input, [texto]);
  }

  /**
   * Igual que `escribirTagLibre`, pero agrega VARIOS tags (uno por cada valor
   * de `valores`, en orden): click + texto + ENTER por cada uno. Generaliza el
   * mismo mecanismo para cualquier control que necesite crear N tags desde un
   * solo campo del Execution Context (ver estrategia `tagsLibres` en
   * `core/strategies/builtinStrategies.js`, que parsea "Rojo | Azul | Verde"
   * antes de llamar acá). Valores vacíos se descartan; sin valores válidos no
   * hace nada — mismo criterio que `escribirTagLibre`.
   */
  async escribirTagsLibres(label, valores) {
    const lista = (Array.isArray(valores) ? valores : [valores]).filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== ''
    );
    if (!lista.length) return undefined;
    logger.info(`Form: agregar ${lista.length} tag(s) libre(s) en "${label}": ${lista.join(' | ')}`);
    const campo = await this._elemCampo(label);
    const input = await this._inputDeCampo(campo, label);
    await this._escribirTagsEnInput(input, lista);
    return lista;
  }

  /**
   * Mecánica de bajo nivel de `escribirTagLibre`/`escribirTagsLibres`: dado un
   * input YA LOCALIZADO, escribe cada valor de `valores` seguido de ENTER.
   * Separada de la localización del campo para que un Page Object con su
   * PROPIO mecanismo de búsqueda (ej. un campo dentro de un popup/modal, que
   * no vive en un `group-field`/`dx-field-item` normal y por eso no lo
   * encuentra `_elemCampo`) pueda reutilizar EXACTAMENTE esta misma mecánica
   * sin duplicarla (ver `RequisicionFormPage._modalTagbox` +
   * `agregarPreguntaPersonalizada`, campo "Opciones" del modal de Pregunta
   * Personalizada).
   */
  async _escribirTagsEnInput(input, valores) {
    for (const valor of valores) {
      await input.click();
      await input.sendKeys(String(valor), Key.ENTER);
    }
  }

  /**
   * Escribe en un textbox / textarea por label.
   * Los editores DevExtreme commitean su valor en el evento 'change' (al perder
   * foco): por eso se envía TAB al final, para forzar el blur y que el valor
   * quede registrado por el validador (si no, el último campo escrito aparece
   * como "requerido" aunque tenga texto).
   *
   * `clear`: por defecto `true` (comportamiento de siempre; `.clear()` además
   * enfoca el input como efecto colateral). Algunos editores DevExtreme (ej.
   * inputs con MÁSCARA dinámica, como "Identificación" en Solicitud de Empleo)
   * lanzan `invalid element state` ante `.clear()` — mismo problema ya
   * documentado en `agregarPreguntaPersonalizada()` para los campos del modal
   * de pregunta personalizada. Con `clear:false` se omite ese paso, pero se
   * mantiene un `.click()` explícito para enfocar (sin él, `sendKeys` puede
   * escribir con el cursor en una posición inesperada dentro de la máscara —
   * verificado: sin el click, el valor resultante queda corrupto).
   */
  /**
   * Reintenta ante `StaleElementReferenceError` (confirmado con evidencia
   * real: justo tras entrar a "Editar", el dxForm puede re-renderizar un
   * campo recién montado entre ubicarlo y escribirle — mismo tipo de carrera
   * ya visto en otras acciones de header/formulario de la app).
   */
  async escribir(label, texto, { clear = true } = {}, intentos = 3) {
    logger.info(`Form: escribir en "${label}"`);
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const campo = await this._elemCampo(label);
        await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', campo);
        const input = await this._inputDeCampo(campo, label);
        if (clear) {
          await input.clear();
        } else {
          // Evita el `.clear()` nativo (confirmado con evidencia real: tira
          // `invalid element state` en algunos campos puntuales, ej.
          // "Referencia MT" de Grados Académicos, "Identificación" de
          // Solicitud de Empleo) — pero el contenido previo SÍ debe
          // reemplazarse, nunca acumularse: sin esto, correr el mismo test
          // varias veces sobre el mismo registro va concatenando texto hasta
          // superar el límite del campo (confirmado con evidencia real,
          // "Referencia MT" terminó en "123456123456" e inválido tras 2
          // corridas). Selecciona todo (Ctrl+A) y borra por teclado — no
          // dispara el mismo `invalid element state` porque no es la llamada
          // nativa `.clear()` de Selenium.
          await input.click();
          await input.sendKeys(Key.chord(Key.CONTROL, 'a'));
          await input.sendKeys(Key.BACK_SPACE);
        }
        await input.sendKeys(texto, Key.TAB);
        return;
      } catch (e) {
        // Transitorios de un campo que se vuelve a montar (p. ej. justo tras "Editar"):
        // primero "stale" y, al reubicarlo, un instante "no interactuable" — confirmado
        // en vivo (Salario de Propuesta económica). Se reintenta con una pausa corta.
        const transitorio = ['StaleElementReferenceError', 'ElementNotInteractableError'].includes(e.name);
        if (!transitorio || intento === intentos) throw e;
        logger.info(`Form: campo "${label}" ${e.name === 'StaleElementReferenceError' ? '"stale"' : 'no interactuable'} (intento ${intento}/${intentos}), reintentando`);
        await this.driver.sleep(400); // deja terminar el re-render antes de relocalizar el campo
      }
    }
  }

  /**
   * Editor `.dx-texteditor-input` DENTRO de un contenedor de campo ya
   * localizado, con POLL (no una sola lectura) hasta `timeout`.
   *
   * Confirmado con evidencia real (Categoría Actividades, "Rate" tras
   * encender el switch "Usar Rate"): un campo condicional a otro control
   * (switch/selección previa) puede tardar un instante en montar su editor
   * real — el contenedor del campo (`campo`, ya localizado) no cambia de
   * identidad ni tira `StaleElementReferenceError`, pero
   * `campo.findElement('.dx-texteditor-input')` sin esperar revienta con
   * "Unable to locate element" si se lo llama en ese instante. Es un hueco
   * DISTINTO al de `_elemCampo` (que ya espera a que el CONTENEDOR exista) —
   * acá se espera a que el EDITOR DENTRO de un contenedor ya existente
   * termine de montarse. Reutilizable por cualquier método de `Form` que
   * escriba en un campo potencialmente condicional a otro.
   */
  async _inputDeCampo(campo, label, timeout = 5000) {
    let falloDelPoll = null;
    const input = await this.driver
      .wait(async () => {
        const els = await campo.findElements(By.css('.dx-texteditor-input'));
        return els.length ? els[0] : false;
      }, timeout)
      .catch((e) => {
        falloDelPoll = e;
        return null;
      });
    // Si el contenedor se volvió "stale" durante el poll (el formulario se re-renderizó, p. ej.
    // justo tras "Editar": el fallo ocurre en <1 s, no tras `timeout`), NO es "no expuso su editor":
    // se deja pasar tal cual para que el llamador relocalice el campo y reintente.
    if (!input && falloDelPoll && falloDelPoll.name === 'StaleElementReferenceError') throw falloDelPoll;
    if (!input) {
      throw new Error(`Form: "${label}" no expuso su editor (.dx-texteditor-input) tras esperar ${timeout}ms.`);
    }
    return input;
  }

  /** Activa (o desactiva) un switch por label. */
  /**
   * Confirmado con evidencia real (Categoría Actividades, "Usar Rate"): el
   * click NO actualiza `aria-pressed` de forma síncrona — leerlo
   * inmediatamente después del click puede devolver el valor VIEJO, aunque
   * el click en sí se disparó sin error. Sin esperar a que el atributo
   * refleje el nuevo estado, `setCampo`/`completarConContexto` seguían de
   * largo pensando que el switch ya quedó en `encendido`, y el registro se
   * guardaba con el switch en su valor original — un "fallo silencioso", sin
   * ninguna excepción que lo delatara.
   */
  async setSwitch(label, encendido = true) {
    const campo = await this._elemCampo(label);
    const sw = await campo.findElement(By.css('.dx-switch'));
    const estado = (await sw.getAttribute('aria-pressed')) === 'true';
    if (estado !== encendido) {
      logger.info(`Form: switch "${label}" -> ${encendido}`);
      await sw.click();
      await this.driver
        .wait(async () => (await sw.getAttribute('aria-pressed')) === String(encendido), this._timeout())
        .catch(() => {});
    }
  }

  /**
   * Marca/desmarca un DevExtreme CheckBox (`.dx-checkbox`) — WIDGET DISTINTO
   * de `.dx-switch` (confirmado real, "Indicador Comision" de Paquete
   * salarial): usa `role="checkbox"`/`aria-checked` (no `aria-pressed` como
   * el switch), y el elemento queda STALE tras el click (se re-renderiza) —
   * a diferencia del switch, que no lo hace — por eso se RE-UBICA antes de
   * confirmar el estado final, en vez de reusar la misma referencia.
   */
  async setCheckbox(label, marcado = true) {
    const campo = await this._elemCampo(label);
    const chk = await campo.findElement(By.css('.dx-checkbox'));
    const estado = (await chk.getAttribute('aria-checked')) === 'true';
    if (estado !== marcado) {
      logger.info(`Form: checkbox "${label}" -> ${marcado}`);
      await chk.click();
      await this.driver
        .wait(async () => {
          try {
            const campoFresco = await this._elemCampo(label);
            const chkFresco = await campoFresco.findElement(By.css('.dx-checkbox'));
            return (await chkFresco.getAttribute('aria-checked')) === String(marcado);
          } catch (e) {
            return false; // stale entre el click y esta lectura: reintenta
          }
        }, this._timeout())
        .catch(() => {});
    }
  }

  /** True si el campo está marcado como inválido (badge rojo). */
  async estaInvalido(label) {
    const campos = await this.driver.findElements(this._campo(label));
    if (!campos.length) return false;
    const inval = await campos[0].findElements(By.css('.dx-invalid'));
    return inval.length > 0;
  }

  /**
   * True si el editor del campo está vacío (clase dx-texteditor-empty de
   * DevExtreme).
   *
   * Excepción verificada: en editores enmascarados (`dx-texteditor-masked`,
   * ej. "Celular") esa clase NO se aplica aunque el valor sea solo el
   * esqueleto de la máscara (ej. "___-___-____", sin ningún dígito/letra
   * real) — confirmado inspeccionando el DOM real del formulario recién
   * abierto. Para ese caso puntual se revisa además el valor crudo del
   * input; el resto de editores (sin esa clase) usa exactamente el mismo
   * criterio que antes.
   */
  async estaVacio(label) {
    const campo = await this._elemCampo(label);
    const eds = await campo.findElements(By.css('.dx-texteditor'));
    if (!eds.length) return true;
    const cls = (await eds[0].getAttribute('class')) || '';
    if (/dx-texteditor-empty/.test(cls)) return true;
    if (/dx-texteditor-masked/.test(cls)) {
      const inputs = await eds[0].findElements(By.css('.dx-texteditor-input'));
      if (inputs.length) {
        const valor = (await inputs[0].getAttribute('value')) || '';
        if (!/[0-9A-Za-z]/.test(valor)) return true;
      }
    }
    return false;
  }

  /**
   * Input donde se escribe para FILTRAR un dropdown abierto. Puede ser un
   * buscador propio dentro del overlay (lookup / list con búsqueda) o el input
   * del propio campo (selectbox/tagbox con searchEnabled). Se prefiere el del
   * overlay si está visible.
   */
  async _inputBusqueda(label) {
    const enOverlay = await this.driver.findElements(
      By.css(
        '.dx-overlay-content .dx-list-search .dx-texteditor-input, ' +
          '.dx-overlay-content .dx-searchbox .dx-texteditor-input, ' +
          '.dx-popup-content input.dx-texteditor-input'
      )
    );
    for (const el of enOverlay) {
      try { if (await el.isDisplayed()) return el; } catch (e) { /* stale */ }
    }
    const campo = await this._elemCampo(label);
    return campo.findElement(By.css('.dx-texteditor-input'));
  }

  /**
   * Pone un valor en un control DELEGANDO en una Selection Strategy.
   *
   * Es el punto de entrada que usan los Page Objects: el test dice "quiero este
   * valor"; la estrategia sabe cómo interactuar con ese tipo de control. Si no
   * se indica estrategia, se usa la de por defecto (primera opción), que es el
   * comportamiento histórico.
   *
   * @param label     label del control
   * @param valor     valor deseado (undefined/'' => la estrategia decide, ej. primera opción)
   * @param opciones  { estrategia: 'searchAndSelect'|'text'|..., ...extras }
   */
  async setValor(label, valor, opciones = {}) {
    const strategies = require('../strategies');
    const estrategia = strategies.obtener(opciones.estrategia || strategies.POR_DEFECTO);
    return estrategia.aplicar(this, label, valor, opciones);
  }

  /**
   * Completa un formulario a partir de su mapa `control -> estrategia` y un objeto
   * de VALORES indexado por label. Genérico: sirve para cualquier formulario.
   *
   * Prioridad de llenado (la regla del framework):
   *   - `valores[label]` con valor NO vacío  → se usa ese valor con su estrategia.
   *   - `valores[label]` vacío y `autofill:true`  → se aplica la estrategia SIN
   *     valor (su comportamiento por defecto: firstOption elige la primera, text
   *     no toca el campo, etc.). Excepción: un control de texto que declara `dato`
   *     en `ESTRATEGIAS` ({ estrategia:'text', dato:'puesto.descripcion' }) recibe
   *     un valor de la fuente común (`utils/datos.js`), reproducible por semilla.
   *   - `valores[label]` vacío y `autofill:false` (default) → NO se toca el control.
   *
   * Con `autofill:false` esta rutina es NEUTRA para los campos que el usuario no
   * completó: sólo INYECTA los valores provistos. Por eso no reemplaza la
   * automatización curada de un formulario (dependencias entre campos, textos por
   * defecto): se compone con ella. `solo`/`excepto` acotan qué controles considerar.
   *
   * @param controles mapa `label -> 'estrategia' | { estrategia, ...opciones }`
   * @param valores   objeto `{ [label]: valor }` (típicamente del Execution Context)
   * @param opciones  { autofill=false, solo=[labels], excepto=[labels] }
   * @returns {Promise<Object>} `{ [label]: valorEfectivo }` de los controles operados
   */
  async completarDesde(controles, valores = {}, opciones = {}) {
    const formInputModel = require('../context/formInputModel');
    const { autofill = false, solo = null, excepto = null } = opciones;
    const modelo = formInputModel.desdeControles(controles);
    const usados = {};

    for (const { label, estrategia, opciones: extra } of modelo) {
      if (solo && !solo.includes(label)) continue;
      if (excepto && excepto.includes(label)) continue;

      const valor = (valores || {})[label];
      if (!formInputModel.esVacio(valor)) {
        logger.info(`Form: completar "${label}" con valor provisto`);
        usados[label] = await this.setValor(label, valor, { estrategia, ...extra });
      } else if (autofill) {
        logger.info(`Form: completar "${label}" automáticamente (sin valor)`);
        const generado = extra.dato !== undefined && estrategia === 'text' ? require('../utils/datos').resolver(extra.dato, { campo: label }) : undefined;
        usados[label] = await this.setValor(label, generado, { estrategia, ...extra });
      }
    }
    return usados;
  }

  /**
   * Labels de los controles VISIBLES del formulario en pantalla (estén o no
   * habilitados — ver más abajo). Soporta las MISMAS TRES convenciones que
   * `_campo()` — `.group-field*` (app propia), `.dx-field-item` (DevExtreme
   * nativo) y `.dependiente-form-item` ("Dependientes" de Empleado) — antes
   * solo reconocía la primera, y `dependiente-form-item` se agregó recién
   * (2026-09-10) DESPUÉS de que `_campo()` ya la reconocía, exactamente el
   * mismo tipo de desincronización documentada abajo. CAUSA RAÍZ real
   * confirmada (2026-09-04, "Editar paquete salarial", y reconfirmada
   * 2026-09-10 con "Dependientes"): `_campo()`/`escribir()`/`setValor()` (el
   * camino de LEER/ESCRIBIR) soportan una convención nueva ANTES de que este
   * método (el ÚNICO que alimenta `validarControlesDeclarados`, el camino de
   * VALIDAR cobertura) se actualice a la par — son DOS copias de la misma
   * lista de convenciones que hay que mantener sincronizadas a mano; si se
   * agrega una convención nueva a `_campo()` sin tocar acá, la validación de
   * cobertura queda silenciosamente inoperante (reporta "0 controles en
   * pantalla") para CUALQUIER pantalla que use solo esa convención, sin
   * lanzar ningún error que lo delate. Al tocar una, revisar SIEMPRE la otra.
   *
   * NO filtra por deshabilitado/`aria-disabled`: un control que pertenece
   * estructuralmente al formulario sigue perteneciendo aunque hoy esté
   * deshabilitado (ej. "Indicador Nomina" — `disabled` según la condición de
   * negocio vigente, pero con `<input name="indicadorNomina">` real). El
   * estado actual de un control NUNCA decide si pertenece al formulario —
   * regla explícita del proyecto (2026-09-04): sólo la ausencia estructural
   * en el DOM (Caso B, ej. "Ciudad" antes de elegir "País") legítimamente lo
   * saca de este inventario, y eso ya ocurre solo porque el nodo no existe
   * — no hace falta ni conviene un filtro adicional para eso.
   *
   * Normaliza el texto (sin asterisco de requerido ni ':' final) y descarta
   * duplicados/ocultos. Sólo LEE el DOM: no modifica nada.
   */
  async controlesVisibles() {
    return this.driver.executeScript(() => {
      const vistos = new Set();
      const out = [];
      const esTokenExacto = (el, token) =>
        (' ' + (el.className || '') + ' ').includes(` ${token} `);
      const candidatos = document.querySelectorAll(
        '.group-field, .group-field-2, .dx-field-item, .dependiente-form-item'
      );
      candidatos.forEach((g) => {
        // `.dx-field-item`/`.dependiente-form-item` matchean por token EXACTO
        // (evita falsos positivos como `.dx-field-item-content`) —
        // `.group-field*` sigue con substring, mismo criterio de siempre
        // para esa convención.
        const clase = g.className || '';
        if (clase.includes('dx-field-item') && !esTokenExacto(g, 'dx-field-item')) return;
        if (clase.includes('dependiente-form-item') && !esTokenExacto(g, 'dependiente-form-item')) return;
        if (g.offsetParent === null) return; // no visible
        // WRAPPER DE GRUPO, no un control propio (confirmado real: "Estatura"
        // de Datos personales — un `.dx-field-item` cuyo ÚNICO propósito es
        // agrupar visualmente otros `.dx-field-item` reales adentro, "Pies"/
        // "Pulgadas" — mismo criterio "has-group" que `_campo()` ya usa para
        // el camino de lectura/escritura, aplicado acá al de inventario: si
        // tiene un DESCENDIENTE que también matchea la condición de
        // contenedor, es el grupo, no una hoja — se excluye, sus hijos se
        // cuentan aparte por su cuenta).
        if (g.querySelector('.group-field, .group-field-2, .dx-field-item, .dependiente-form-item')) return;
        const label = g.querySelector('label');
        if (!label) return;
        // Tooltips/hints de ayuda EMBEBIDOS dentro del propio `<label>`
        // (confirmado real: "Días tomados"/"Días pendientes"/"Días
        // programados" de Datos básicos RH — un ícono de info con su texto
        // explicativo como hijo del `<label>`, ej. `<label>Días
        // tomados<div class="InfoIcon_IconHint__xxxxx"><span
        // class="InfoIcon_IconHintText__yyyyy">Total de días...</span></div>
        // </label>`) — sin excluirlo, `label.textContent` concatena el
        // nombre real del campo con la explicación completa, y ese texto
        // nunca matchea el label declarado en ESTRATEGIAS aunque el campo SÍ
        // esté bien declarado (falso positivo). Se excluye por substring
        // ESTABLE del nombre (`IconHint`), no por el hash de CSS-modules
        // (`__xxxxx`), que cambia entre builds.
        const labelClon = label.cloneNode(true);
        labelClon.querySelectorAll('[class*="IconHint"]').forEach((n) => n.remove());
        const t = (labelClon.textContent || '').replace(/\*/g, '').replace(/:\s*$/, '').trim();
        if (t && !vistos.has(t)) {
          vistos.add(t);
          out.push(t);
        }
      });
      return out;
    });
  }

  /**
   * Mecanismo PREVENTIVO de desincronización. Compara los controles realmente
   * visibles del formulario contra el mapa `control -> estrategia` declarado por el
   * Page Object y, si hay controles en pantalla que el mapa no declara, registra
   * una ADVERTENCIA clara en el log.
   *
   * Por defecto es puramente informativo y ADITIVO: NO rellena los controles no
   * declarados, NO interrumpe la ejecución y NO agrega comportamiento implícito.
   * ESTRATEGIAS sigue siendo la única fuente de verdad; esto sólo avisa cuando la UI
   * cambió.
   *
   * `opciones.estricta` (default `false`, preserva el comportamiento de siempre para
   * TODO llamador existente): si es `true`, además de loguear la advertencia, LANZA
   * un error cuando `faltantesEnEstrategias` tiene algo — convierte la omisión en un
   * fallo duro e imposible de pasar por alto, en vez de un log que puede no leerse
   * (incidente real, 2026-09-04: dos controles de "Editar paquete salarial" quedaron
   * fuera de `ESTRATEGIAS` y nadie lo notó porque nada obligaba a mirar el log).
   *
   * `opciones.excluir` (array de labels, default `[]`): controles VISIBLES real y
   * estructuralmente presentes que a propósito NO son un campo dirigible del
   * formulario (calculados/autogenerados por la app — ej. "Edad", derivada de
   * "Fecha de nacimiento", sin `name` propio ni forma de editarla en ningún
   * estado) — se sacan de la comparación ANTES de decidir warn/throw, así
   * `estricta` puede quedar activado en una sección con este tipo de campo sin
   * fallar por algo que nunca debió declararse. NO es una forma de esconder un
   * campo real: cada nombre acá debe estar documentado (por el caller) con la
   * evidencia de por qué es calculado, mismo criterio que ya distingue Caso A
   * (real, aunque disabled) de un elemento puramente calculado.
   *
   * @returns el diagnóstico de `formInputModel.comparar` (para inspección/evidencia).
   */
  async validarControlesDeclarados(controles, opciones = {}) {
    const formInputModel = require('../context/formInputModel');
    const etiqueta = opciones.etiqueta || 'formulario';
    const excluir = new Set(opciones.excluir || []);
    const enPantalla = await this.controlesVisibles();
    const diag = formInputModel.comparar(formInputModel.labels(controles), enPantalla);
    diag.faltantesEnEstrategias = diag.faltantesEnEstrategias.filter((c) => !excluir.has(c));

    logger.info(
      `Form[${etiqueta}]: sincronización — declarados=${diag.declarados.length}, en pantalla=${diag.enPantalla.length}`
    );
    if (diag.faltantesEnEstrategias.length) {
      logger.warn(
        `Form[${etiqueta}]: controles VISIBLES no declarados en ESTRATEGIAS: ` +
          `[${diag.faltantesEnEstrategias.join(', ')}]. No se rellenan (ESTRATEGIAS es la ` +
          `única fuente de verdad); revisar si el formulario cambió. ` +
          `En pantalla: [${diag.enPantalla.join(', ')}].`
      );
      if (opciones.estricta) {
        throw new Error(
          `Form[${etiqueta}]: cobertura incompleta — ${diag.faltantesEnEstrategias.length} control(es) ` +
            `visible(s) sin declarar en ESTRATEGIAS: [${diag.faltantesEnEstrategias.join(', ')}]. ` +
            `Agregarlos a ESTRATEGIAS (con la estrategia real) antes de continuar.`
        );
      }
    }
    if (diag.declaradosNoVistos.length) {
      logger.info(
        `Form[${etiqueta}]: declarados no visibles ahora (normal si dependen del contexto): ` +
          `[${diag.declaradosNoVistos.join(', ')}].`
      );
    }
    return diag;
  }

  /**
   * Textos de los tags SELECCIONADOS en un tagbox (multi-select). El valor de un
   * tagbox no vive en un input, sino en chips `.dx-tag-content`, así que
   * getValor() no sirve para verificarlo.
   */
  async getTags(label) {
    const campo = await this._elemCampo(label);
    const tags = await campo.findElements(By.css('.dx-tag-content'));
    const textos = [];
    for (const t of tags) {
      try { textos.push((await t.getText()).trim()); } catch (e) { /* stale */ }
    }
    return textos.filter(Boolean);
  }

  /**
   * Hace scroll hasta que un campo sea visible, sin interactuar con él.
   * Pensado para evidencia (screenshots): sin esto, una captura tomada tras
   * completar un campo lejos del tope de la página puede quedar desplazada a
   * otra sección y no mostrar lo que realmente se editó.
   */
  async scrollAlCampo(label) {
    const campo = await this._elemCampo(label);
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', campo);
    return campo;
  }

  /**
   * Valor actual MOSTRADO (texto visible) en el input del campo.
   *
   * Prioriza `.dx-texteditor-input` (el input VISIBLE que DevExtreme usa
   * para mostrar el texto) antes que cualquier `input` genérico. Un
   * selectbox atado a un catálogo (ej. "Estado laboral") renderiza además un
   * `<input type="hidden" value="1">` con el ID interno, ANTES en el DOM que
   * el input visible — verificado con un caso real: el selector combinado
   * `.dx-texteditor-input, input` tomaba ese oculto por aparecer primero, así
   * que `getValor()` devolvía el ID ("1") en vez del texto ("Empleado") aun
   * en modo consulta. Con `.dx-texteditor-input` priorizado, siempre gana el
   * visible; el `input` genérico queda solo de último recurso, para no
   * romper ningún campo que ya funcionaba sin esa clase.
   *
   * Reintenta ante "stale element" (mismo criterio que `seleccionar`/
   * `elegirEnSelectbox`): leer justo después de un Guardar puede toparse con
   * el formulario aún re-renderizando de modo edición a consulta —
   * verificado leyendo un campo inmediatamente después de
   * `resultadoGuardado()`.
   *
   * `timeoutMs` (opcional): cuánto espera `_elemCampo` a que el campo
   * aparezca en el DOM antes de tirar "not located". Sin especificar, usa el
   * timeout explícito normal del framework (`this._timeout()`) — mismo
   * comportamiento de siempre. `esperarValor()` pasa uno CORTO acá a
   * propósito, para poder reintentar varias veces dentro de su propio
   * presupuesto total en vez de agotarlo entero en un solo intento (ver su
   * comentario).
   */
  async getValor(label, { intentos = 2, timeoutMs } = {}) {
    let ultimoError;
    for (let i = 0; i < intentos; i++) {
      try {
        const campo = await this._elemCampo(label, timeoutMs);
        // Switch/checkbox: leer el estado REAL (`aria-pressed`/`aria-checked`
        // del widget), no el `<input>` de respaldo — confirmado real que ese
        // `<input>` es inconsistente para checkbox (a veces sin reflejar el
        // estado actual tras Guardar), a diferencia de un textbox/selectbox
        // donde SÍ es la fuente de verdad. Antes de este fix, un checkbox sin
        // `.dx-texteditor-input` caía al `<input>` genérico (o a `''` si no
        // había ninguno) — mismo tipo de dato poco confiable para un control
        // booleano, igual que ya se documentó para escribir (`setSwitch`/
        // `setCheckbox` nunca usan el `<input>`, solo el ARIA del widget).
        const sw = await campo.findElements(By.css('.dx-switch'));
        if (sw.length) return ((await sw[0].getAttribute('aria-pressed')) || 'false');
        const chk = await campo.findElements(By.css('.dx-checkbox'));
        if (chk.length) return ((await chk[0].getAttribute('aria-checked')) || 'false');
        let inputs = await campo.findElements(By.css('.dx-texteditor-input'));
        if (!inputs.length) inputs = await campo.findElements(By.css('input'));
        if (!inputs.length) return '';
        return (await inputs[0].getAttribute('value')) || '';
      } catch (err) {
        ultimoError = err;
        if (!/stale element/i.test(err.message) || i === intentos - 1) throw err;
        logger.info(`Form: reintentando getValor("${label}") tras stale (intento ${i + 1}/${intentos})`);
      }
    }
    throw ultimoError;
  }

  /**
   * Espera (poll) hasta que `getValor(label)` coincida con `valorEsperado`
   * (case-insensitive; `contains` por defecto, comparación exacta si se pasa
   * `contains: false`). El notify de éxito de una acción del header (ej.
   * cambiar Estado/Etapa desde un botón, sin pasar por "Guardar") puede
   * llegar un instante ANTES de que el campo termine de re-renderizar con el
   * valor nuevo — confirmado con evidencia real en más de un módulo (Estado
   * de Requisición al cerrarla, Etapa de Solicitud de Empleo). Una sola
   * lectura inmediata con `getValor` podía devolver el valor ANTERIOR
   * todavía. Devuelve el último valor leído (coincida o no, tras agotar el
   * timeout), para poder incluirlo en el mensaje de assert del caso que lo
   * use.
   *
   * El campo puede estar TRANSITORIAMENTE AUSENTE del DOM justo tras
   * "Guardar" (no solo con valor desactualizado) — confirmado con evidencia
   * real, 2026-09-04 ("Indicador Comision" de Paquete salarial: buscando su
   * `<label>` directo en el DOM inmediatamente después de Guardar no
   * aparecía; una lectura posterior, ya reasentado el formulario, sí lo
   * mostraba con el valor correcto — es decir, el dato SÍ se persistía, el
   * problema era leerlo en la mitad de un re-render/navegación). Antes de
   * este fix, `getValor` propagaba ese "not located" tal cual, y como
   * `driver.wait(fn, timeout)` NO reintenta cuando la función pasada tira
   * (aborta al primer error), un solo intento fallido consumía TODO el
   * `timeout` disponible sin dejar lugar a un segundo intento — el poll de
   * este método, pensado para reintentar, en la práctica solo llegaba a
   * probar una vez. Ahora cada intento usa un `timeoutMs` corto para
   * localizar el campo (no el completo) y los errores se tratan como "todavía
   * no" en vez de abortar, así el `driver.wait` externo sí alcanza a
   * reintentar varias veces dentro de su propio presupuesto total — sigue
   * siendo una espera atada a una condición real (el campo reapareciendo con
   * el valor correcto), no un `sleep` fijo.
   */
  async esperarValor(label, valorEsperado, { timeout = this._timeout(), contains = true, intentoTimeoutMs = 3000 } = {}) {
    let actual = '';
    await this.driver
      .wait(async () => {
        try {
          actual = await this.getValor(label, { timeoutMs: intentoTimeoutMs });
        } catch (e) {
          return false; // campo transitoriamente ausente/stale: no es "no coincide", es "todavía no" — se reintenta
        }
        const a = normalizarTexto(actual);
        const e = normalizarTexto(String(valorEsperado));
        return contains ? a.includes(e) : a === e;
      }, timeout)
      .catch(() => {});
    return actual;
  }

  /**
   * API recomendada para "¿este campo del form quedó en X?": funde
   * `esperarValor()` (poll, tolerante a un instante de render) + la
   * comparación final en UN solo call, siempre case-insensitive
   * (`assertTextoIgual`) — no hay dos pasos separados que un caller pueda
   * ejecutar a medias (ej. hacer el poll pero comparar el resultado con
   * `assert.strictEqual` a mano, que es exactamente el bug que esto
   * reemplaza — ver SKILL.md "Text comparisons must be case-insensitive" y
   * su incidente 2026-09-09).
   *
   * Lanza `AssertionError` si no coincide (case-insensitive, trim en ambos
   * lados) — igual semántica que `assertTextoIgual`. Devuelve el valor final
   * leído (por si el caller lo quiere loguear/mostrar en un screenshot).
   *
   * Para el flujo típico "cambios -> completar -> verificar", preferir esto
   * sobre `getValor()`/`esperarValor()` + una comparación manual.
   */
  async assertValor(label, valorEsperado, mensaje, { timeout = this._timeout(), intentoTimeoutMs = 3000 } = {}) {
    const actual = await this.esperarValor(label, valorEsperado, { timeout, contains: false, intentoTimeoutMs });
    assertTextoIgual(
      actual,
      String(valorEsperado),
      mensaje || `"${label}" no quedó en "${valorEsperado}" (quedó "${actual}").`
    );
    return actual;
  }
}

module.exports = Form;
