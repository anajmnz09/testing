const { By } = require('selenium-webdriver');
const { BasePage, Form, Notify, Popup } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const config = require('@triple/core/config');

/**
 * Page Object del formulario "Crear Empleado" (Empleados > listado > botón
 * "Crear"). Pantalla PROPIA, distinta del panel lateral de consulta
 * (`EmpleadoDetallePage`): navega a una URL nueva (confirmado con Selenium
 * real: cambia la URL) con un sidemenu de SECCIONES (mismo patrón visual que
 * el sidemenu de Configuración, pero es un formulario de creación, no una
 * lista de entidades):
 *
 *   Datos básicos (activa por defecto) — 2 grupos: "Datos de Empleado" +
 *     "Acerca del puesto de trabajo", más una foto (Cargar Imagen, con su
 *     PROPIO Guardar/Descartar interno — fuera de alcance acá, se cubre en
 *     un test aparte, igual criterio que Usuario/Solicitud).
 *   Datos personales
 *   Herramientas — es un GRID de herramientas asignadas (Agregar/Eliminar),
 *     no un formulario — fuera de alcance acá (no lo mencionó el usuario).
 *   Recursos humanos (acordeón — hay que EXPANDIRLO antes de que sus
 *     sub-secciones sean clickeables) > "Datos básicos RH", "Paquete
 *     salarial", "Beneficios" (esta última fuera de alcance, no mencionada).
 *
 * Navegación entre secciones: click directo en el texto del sidemenu (nodo
 * de texto plano, sin clase distintiva) — NO hay que guardar antes de
 * cambiar de sección, los datos quedan en el formulario en memoria hasta el
 * "Guardar" final.
 *
 * DOS cascadas confirmadas con Selenium real — Caso B: el campo hijo está
 * AUSENTE del DOM (no solo deshabilitado) hasta que se elige su "padre"
 * (confirmado real, 2026-09-04: buscando "Ciudad" en el DOM de un empleado
 * nuevo sin "País" elegido, el `<label>` correspondiente no existe todavía):
 *   - "Datos básicos": "Identificación" (texto) aparece recién al elegir
 *     "Tipo ID" (selectbox).
 *   - "Datos personales": "Ciudad" aparece recién al elegir "País"
 *     (Dirección); "Sector" al elegir "Ciudad"; "Calle" (texto) al elegir
 *     "Sector". Siguen declaradas en `ESTRATEGIAS_DATOS_PERSONALES` (SÍ
 *     pertenecen al formulario) y se llenan aparte vía `cascadaDireccion()`.
 *
 * Otros campos deshabilitados (Caso A: presentes en el DOM, con `<input
 * name="...">` real, solo el control queda inoperable hoy) — declarados en
 * ESTRATEGIAS igual, porque `disabled` nunca decide pertenencia al
 * formulario: "Indicador Nomina" (checkbox). Verdaderos calculados/
 * autogenerados (sin control dirigible real, en NINGÚN estado — se excluyen
 * de ESTRATEGIAS Y se listan en `CAMPOS_CALCULADOS`, más abajo, para que
 * `validarControlesDeclarados({ estricta: true })` no falle por ellos):
 * "Código de empleado." (autogenerado, aunque tiene `name` real, es
 * inmutable una vez creado), "Edad" (derivada de "Fecha de nacimiento", sin
 * `name` propio), "Antigüedad en puesto/compañía/acumulada" (su `<input>`
 * tiene literalmente `name="N/A"`, sentinela explícito de la propia app de
 * "sin dato real"). "Fecha finalización"/"Fecha de salida"/"Banco"/"Tipo de
 * cuenta"/"No. cuenta" son campos reales condicionados a otras elecciones,
 * no calculados — ver su declaración en `ESTRATEGIAS_RH_DATOS_BASICOS`.
 *
 * "Supervisor multicompañía" (switch) y "Indicador Comision"/"Indicador
 * Nomina" (checkbox) están declaradas con `soloSiDirigido: true`: pertenecen
 * al formulario (cobertura los exige), pero `completarSeccion` solo las
 * opera cuando el Panel dirige un valor explícito, para no autofillear un
 * control booleano en cada corrida sin pedirlo.
 */

/**
 * Campos VISIBLES y estructuralmente reales (no wrappers, no tooltips) que a
 * propósito NO se declaran en su `ESTRATEGIAS_*` porque no son un campo
 * dirigible del formulario — son calculados/autogenerados por la app, sin
 * forma de operarlos en NINGÚN estado (no "disabled ahora", sino "nunca fue
 * ni será un input"). Confirmado con Selenium real, no supuesto:
 *
 *  - "Edad" (Datos personales): derivada de "Fecha de nacimiento", sin
 *    atributo `name` propio (2026-09-04).
 *
 * Se pasa a `validarControlesDeclarados({ excluir })` vía `completarSeccion`/
 * `aplicarCambios` (ver más abajo) para que la cobertura estricta no falle
 * por estos campos — sin esto, CUALQUIER sección con un campo calculado
 * volvería imposible usar `estricta`. Mapa por REFERENCIA del objeto
 * `ESTRATEGIAS_*` (no por nombre de sección en string, para no duplicar esa
 * información en dos lugares distintos).
 */
const CAMPOS_CALCULADOS = new Map();

const ESTRATEGIAS_DATOS_BASICOS = {
  'Tipo ID': 'directSelect',
  // "Identificación" depende de "Tipo ID" (deshabilitado hasta elegirlo) —
  // declarado acá para `validarControlesDeclarados`/el Panel, pero se llena
  // aparte vía `cascadaIdentificacion()` (excluido con `excepto` de
  // `completarSeccion`).
  Identificación: 'text',
  'Primer Nombre': 'text',
  'Segundo Nombre': 'text',
  'Primer Apellido': 'text',
  'Segundo Apellido': 'text',
  'Dimensión empleado': 'text',
  Sucursal: 'searchAndSelect',
  Modalidad: 'searchAndSelect',
  'Puesto de trabajo': 'searchAndSelect',
  Departamento: 'searchAndSelect',
  Supervisor: 'searchAndSelect',
  Referencia: 'text',
  // "Código de empleado." (con punto final, texto real del label —
  // confirmado con Selenium real): sin este, `validarControlesDeclarados`
  // lo reporta como faltante — es un campo VISIBLE real, pero autogenerado
  // e inmutable (ver `CAMPOS_CALCULADOS`, arriba), nunca un input dirigible.
  // Switch, apagado por defecto (confirmado real). Estaba EXCLUIDO por
  // completo de este mapa — el anti-patrón que el propio skill marca como
  // incorrecto (incidente "Es administrador"/"Tiene acceso a RRHH",
  // 2026-08-26): excluir un control entero lo hace invisible para
  // `registrarCasoDesdeFormulario`, así que nunca llegaba al Panel. El
  // criterio correcto es declararlo con `soloSiDirigido: true` — el Panel lo
  // muestra como switch dirigible, pero el autofill de `completarSeccion`
  // (usado por `crear-empleado`) lo deja INTACTO si nadie lo dirige, cero
  // cambio de comportamiento para lo que ya pasaba.
  'Supervisor multicompañía': { estrategia: 'switch', soloSiDirigido: true },
};
CAMPOS_CALCULADOS.set(ESTRATEGIAS_DATOS_BASICOS, ['Código de empleado.']);

const ESTRATEGIAS_DATOS_PERSONALES = {
  Nacionalidad: 'searchAndSelect',
  'País de nacimiento': 'searchAndSelect',
  'Fecha de nacimiento': 'datePicker',
  Género: 'searchAndSelect',
  'Estado civil': 'searchAndSelect',
  'Número de hijos': 'text',
  // "Estatura" NO es un control real — confirmado con Selenium real: es el
  // LABEL/caption del grupo que agrupa "Pies"+"Pulgadas" (`<label
  // class="dx-field-item-label">Estatura:</label>` envolviendo un
  // `dx-form-group` con esos dos campos adentro, sin ningún `<input>` propio
  // para "Estatura" en sí) — corregido 2026-09-03, estaba mal declarado como
  // `'text'` (le pedía a `Form` escribir en un control que no existe).
  //
  // "Pies" (min 0, max 8) y "Pulgadas" (min 0, max 11) SÍ son numberbox
  // reales — la app misma corrige silenciosamente cualquier valor fuera de
  // ese rango al valor límite más cercano al confirmar (confirmado real: un
  // valor dirigido de "11" en "Pies" terminó guardado como "8", el límite
  // real de la app, no un bug del test).
  Pies: 'text',
  Pulgadas: 'text',
  'Tipo de sangre': 'searchAndSelect',
  // Textareas: el `.clear()` nativo tira `InvalidElementStateError` cuando
  // YA tienen texto (confirmado con Selenium real al EDITAR — en Crear
  // arrancan vacíos, por eso no se vio ahí; mismo patrón que "Días
  // tomados"/"Teléfono" más abajo). `custom` con `clear:false`.
  'Condición médica': { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  Discapacidad: { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  Riesgo: 'searchAndSelect',
  Camisa: 'searchAndSelect',
  Pantalón: 'searchAndSelect',
  Zapatos: 'searchAndSelect',
  'Email corporativo': 'text',
  'Email personal': 'text',
  // Editores enmascarados: el `.clear()` nativo de `Form.escribir` pierde el
  // PRIMER carácter tipeado (confirmado con Selenium real, "Teléfono" de
  // Contacto de emergencia: "809-555-0102" quedó "(095) 550-102_" — mismo
  // tipo de falla ya documentado para "Identificación"/"Referencia MT",
  // pero silenciosa acá en vez de tirar `InvalidElementStateError`). `custom`
  // con `clear:false` para pasar por Ctrl+A/Backspace en vez de `.clear()`.
  'Teléfono de trabajo': { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  'Teléfono personal': { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  País: 'searchAndSelect',
  // "Ciudad"/"Sector"/"Calle" dependen en cascada de "País" (cada uno
  // deshabilitado hasta elegir el anterior) — declarados acá, pero se
  // llenan aparte vía `cascadaDireccion()` (excluidos con `excepto`).
  Ciudad: 'searchAndSelect',
  Sector: 'searchAndSelect',
  Calle: 'text',
  Nombre: 'text',
  Teléfono: { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  Parentesco: 'text',
};
CAMPOS_CALCULADOS.set(ESTRATEGIAS_DATOS_PERSONALES, ['Edad']);

const ESTRATEGIAS_RH_DATOS_BASICOS = {
  'Tipo de contrato': 'searchAndSelect',
  'Fecha de inicio': 'datePicker',
  // "Fecha finalización"/"Fecha de salida"/"Banco"/"Tipo de cuenta"/
  // "No. cuenta": controles REALES confirmados con Selenium real (editores
  // habilitados, no de solo lectura) que faltaban acá — `ESTRATEGIAS` debe
  // declarar TODO control real, no solo los que un test autofilla (incidente
  // ya documentado en el skill). Excluidos a propósito del `completarSeccion`
  // de `crear-empleado.test.js` (vía `excepto`): declararlos acá los hace
  // visibles/dirigibles desde el Panel para `editar-datos-basicos-rh`, pero
  // autofillearlos en cada Empleado nuevo (primera opción de Banco/Tipo de
  // cuenta, fechas sin sentido de negocio en un alta) sería un efecto
  // colateral no pedido — mismo criterio que el incidente de "Es
  // administrador" (declarar ≠ autofillear).
  'Fecha finalización': 'datePicker',
  'Fecha de salida': 'datePicker',
  'Razón de salida': 'searchAndSelect',
  'Tipo de salario': 'searchAndSelect',
  'Categoría de pago horas': 'searchAndSelect',
  Horario: 'searchAndSelect',
  'Forma de pago': 'searchAndSelect',
  Banco: 'searchAndSelect',
  'Tipo de cuenta': 'searchAndSelect',
  'No. cuenta': 'text',
  'Compañía ARS': 'searchAndSelect',
  'Compañía AFP': 'searchAndSelect',
  'Compañía de seguro de vida': 'searchAndSelect',
  'Agente de retencion': 'searchAndSelect',
  'Saldo a favor ISR': 'text',
  'Descuento AFP': 'searchAndSelect',
  'Descuento SFS': 'searchAndSelect',
  'Descuento ISR': 'searchAndSelect',
  // "Días tomados/pendientes/programados": el `.clear()` nativo de
  // `Form.escribir` tira `InvalidElementStateError` en estos editores
  // (confirmado con Selenium real, mismo tipo de falla ya documentado para
  // "Referencia MT"/"Identificación" — editor numérico/con máscara). Se usa
  // `custom` para pasar `clear:false` (el escape hatch estándar del
  // framework para esto), en vez de tocar `TextInputStrategy` global.
  'Días tomados': { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  'Días pendientes': { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  'Días programados': { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
};
CAMPOS_CALCULADOS.set(ESTRATEGIAS_RH_DATOS_BASICOS, [
  'Antigüedad en puesto',
  'Antigüedad en compañía',
  'Antigüedad acumulada',
]);

const ESTRATEGIAS_RH_PAQUETE_SALARIAL = {
  // `.clear()` nativo tira `InvalidElementStateError` cuando el campo YA
  // tiene datos (confirmado real, editando con un "Salario" dirigido desde
  // el Panel — no se veía en Crear porque ahí arranca vacío) — mismo patrón
  // ya documentado para "Saldo a favor ISR"/"Días tomados" y otros. NO es
  // parte del incidente de cobertura de ESTRATEGIAS (issue no relacionado,
  // encontrado validando el fix); mismo escape hatch `custom`+`clear:false`.
  Salario: { estrategia: 'custom', fn: (form, label, valor) => form.escribir(label, String(valor), { clear: false }) },
  'Monto tope de comisión': 'text',
  'Porciento Salario': 'text',
  // Checkbox DevExtreme real (`.dx-checkbox`/`role="checkbox"`, NO
  // `.dx-switch` — confirmado real, 2026-09-04) — encontrado por
  // `Form.validarControlesDeclarados({estricta:true})` tras corregir el
  // detector de cobertura (ver `controlesVisibles`, causa raíz real: el
  // detector solo reconocía `.group-field`, nunca `.dx-field-item`, así que
  // no podía ver NADA de Empleados, no solo este control). `soloSiDirigido`
  // mismo criterio que "Supervisor multicompañía": apagado por defecto, se
  // toca solo si el Panel lo dirige.
  'Indicador Comision': { estrategia: 'checkbox', soloSiDirigido: true },
  // Checkbox DevExtreme real, mismo widget/evidencia que "Indicador
  // Comision" (`<input name="indicadorNomina">` real). Está deshabilitado
  // hoy en las pantallas revisadas, pero `disabled` NUNCA decide pertenencia
  // al formulario (regla del proyecto, 2026-09-04) — sigue siendo un control
  // estructural real y debe estar declarado. No se conoce la condición de
  // negocio que lo habilita; `soloSiDirigido` solo controla si
  // `completarSeccion` lo autofillea por defecto (no afecta la cobertura).
  'Indicador Nomina': { estrategia: 'checkbox', soloSiDirigido: true },
  'Clasificación 1': 'searchAndSelect',
  'Clasificación 2': 'searchAndSelect',
  'Clasificación 3': 'searchAndSelect',
};

class EmpleadoFormPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.form = new Form(driver);
    this.notify = new Notify(driver);
    // Distinto del Guardar/Descartar propios del cropper de foto (clase
    // "dx-button-mode-contained", sin "main"): el del formulario tiene
    // "main" en su clase (verificado con Selenium real).
    this.btnGuardar = By.xpath("//div[contains(@class,'dx-button')][contains(@class,'main')][normalize-space(.)='Guardar']");
    // Popup de confirmación tras "Guardar" — mismo mecanismo genérico que
    // Configuración/Banco de candidatos (`.confirmPopupContent`), a
    // confirmar con evidencia real la primera vez que se llega hasta acá.
    this.popupConfirmar = new Popup(driver, { contiene: '.confirmPopupContent' });
  }

  static get ESTRATEGIAS_DATOS_BASICOS() {
    return ESTRATEGIAS_DATOS_BASICOS;
  }
  static get ESTRATEGIAS_DATOS_PERSONALES() {
    return ESTRATEGIAS_DATOS_PERSONALES;
  }
  static get ESTRATEGIAS_RH_DATOS_BASICOS() {
    return ESTRATEGIAS_RH_DATOS_BASICOS;
  }
  static get ESTRATEGIAS_RH_PAQUETE_SALARIAL() {
    return ESTRATEGIAS_RH_PAQUETE_SALARIAL;
  }

  /**
   * Espera a que la pantalla (Crear O Editar) esté cargada. Usa el botón
   * "Guardar" del header sticky (`this.btnGuardar`, presente en CUALQUIER
   * sección) — NUNCA un campo de una sección puntual (ej. "Primer Nombre",
   * de "Datos básicos"): confirmado con Selenium real que Editar puede
   * aterrizar en una sección DISTINTA a "Datos básicos" si se entró desde
   * ahí en modo consulta (`EmpleadoDetallePage.abrirSeccion()` +
   * `editar()`), y un locator específico de "Datos básicos" nunca aparece
   * en ese caso — timeout falso.
   */
  async estaCargado() {
    await this.waitVisible(this.btnGuardar);
    await this.esperarSinLoader();
    return this;
  }

  /**
   * Click en un nodo de texto plano ÚNICO en pantalla (labels del sidemenu,
   * sin clase distintiva). Tras cambiar de sección, espera además a que la
   * cantidad de `.dx-state-disabled` en pantalla se ESTABILICE (mismo
   * criterio que `_esperarCamposHabilitados` de Configuración) — confirmado
   * con evidencia real que `esperarSinLoader()` sola no alcanza: la nueva
   * sección puede seguir re-renderizando un instante más, dejando el primer
   * intento de interactuar con un campo (`Form.seleccionarPrimera`, sin
   * reintento propio ante stale) con `StaleElementReferenceError`.
   */
  async _clickTexto(texto) {
    const el = await this.waitVisible(By.xpath(`//*[not(*)][normalize-space(text())='${texto}']`));
    await this.driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el);
    await el.click();
    await this._confirmarCambioPaginaSiAparece();
    await this.esperarSinLoader().catch(() => {});
    await this._esperarEstabilizado();
  }

  /**
   * En modo EDITAR (a diferencia de Crear) navegar a otra sección del
   * sidemenu SIEMPRE dispara un popup "¿Desea cambiar la página? Los
   * cambios no guardados se perderán" (Sí/No) — confirmado con Selenium
   * real, incluso sin haber tocado ningún campo todavía. Se confirma "Sí"
   * (perder cambios no guardados de la sección ANTERIOR es lo esperado: los
   * tests de "editar-*" navegan a la sección objetivo ANTES de tocar
   * ningún campo, así que no hay nada que perder en la práctica). Mismo
   * componente `Popup` que el confirm de "Guardar" (`.confirmPopupContent`)
   * pero con botones/mensaje DISTINTOS — por eso se maneja aparte, con una
   * espera corta (no siempre aparece: en Crear, un registro nuevo, nunca
   * apareció).
   */
  async _confirmarCambioPaginaSiAparece(timeout = 1500) {
    const aparece = await this.popupConfirmar
      .esperarVisible(timeout)
      .then(() => true)
      .catch(() => false);
    if (!aparece) return;
    logger.info('EmpleadoFormPage: confirmando popup "¿Desea cambiar la página?" (Sí)');
    // Sin anclar ("^...$"): el nombre accesible real viene concatenado de
    // varias fuentes (ej. "Sí | Sí", confirmado con Selenium real) — un
    // regex anclado nunca matchea.
    const accion = await this.popupConfirmar.accionar(/s[ií]/i, { etiqueta: 'Cambiar de página' });
    if (!accion.encontrado || accion.deshabilitado) {
      throw new Error(`EmpleadoFormPage: no se pudo confirmar el popup "¿Desea cambiar la página?" (${JSON.stringify(accion)}).`);
    }
    await this.popupConfirmar.esperarCerrado();
  }

  /** Espera (poll, acotado, tolerante) a que la cantidad de `.dx-state-disabled` deje de cambiar. */
  async _esperarEstabilizado(timeout = 3000) {
    let anterior = null;
    await this.driver
      .wait(async () => {
        const actual = await this.driver.executeScript(() => document.querySelectorAll('.dx-state-disabled').length);
        const estable = actual === anterior;
        anterior = actual;
        return estable;
      }, timeout)
      .catch(() => {});
  }

  async irADatosBasicos() {
    await this._clickTexto('Datos básicos');
  }

  async irADatosPersonales() {
    await this._clickTexto('Datos personales');
  }

  /**
   * "Recursos humanos" es un acordeón: hay que expandirlo antes de que sus
   * sub-secciones sean clickeables. Si YA está expandido (ej. una segunda
   * sub-sección dentro del mismo acordeón), NO se re-clickea "Recursos
   * humanos" — confirmado con evidencia real que un segundo click lo
   * COLAPSA en vez de dejarlo abierto, rompiendo la navegación a la
   * sub-sección siguiente.
   */
  async irARecursosHumanos(subSeccion) {
    const els = await this.driver.findElements(By.xpath(`//*[not(*)][normalize-space(text())='${subSeccion}']`));
    let yaExpandido = false;
    for (const el of els) {
      if (await el.isDisplayed().catch(() => false)) {
        yaExpandido = true;
        break;
      }
    }
    if (!yaExpandido) {
      await this._clickTexto('Recursos humanos');
    }
    await this._clickTexto(subSeccion);
  }

  /** Pone un valor con la estrategia declarada en `estrategias` para ese control. */
  async setCampo(estrategias, label, valor, extras = {}) {
    const declarado = estrategias[label];
    const base = typeof declarado === 'string' ? { estrategia: declarado } : declarado || {};
    return this.form.setValor(label, valor, { ...base, ...extras });
  }

  /**
   * Espera (poll) a que el control `label` deje de estar deshabilitado —
   * mismo criterio que `_esperarCampoPopupHabilitado` de Grupo, adaptado a
   * la convención estándar de campo (`Form._campo`/`group-field`/
   * `dx-field-item`) en vez del `<p>` de un popup.
   *
   * Default alineado al timeout explícito estándar del framework (antes
   * 8000ms fijo): confirmado real, 2026-09-04, "Ciudad" tras elegir "País"
   * en "Datos personales" — la cascada de la app (traer las ciudades del
   * país elegido) puede tardar más de 8s, y como el caller ignora el
   * timeout de este método (`.catch(() => {})`, a propósito: no todo
   * caller de una cascada debe fallar duro acá), seguía de largo e
   * intentaba abrir "Ciudad" todavía deshabilitado — `ElementClickIntercepted`
   * reproducido 2/2 veces.
   *
   * CAUSA RAÍZ real del mismo incidente (no solo el timeout): la comparación
   * de label acá NUNCA normalizaba `*`/`:` finales, a diferencia de
   * `controlesVisibles()`/`_normalizarLabelTexto` — para un campo REQUERIDO
   * (asterisco, ej. "Ciudad: *") el `textContent` real nunca es igual al
   * `label` pedido ("Ciudad"), así que `cont` nunca se encontraba y este
   * método SIEMPRE agotaba el timeout completo sin importar cuánto durara —
   * confirmado con Selenium real dumping el label exacto. Aumentar el
   * timeout (arriba) no alcanzaba por esto: no era un problema de duración,
   * sino de que la condición nunca podía cumplirse.
   */
  async _esperarCampoHabilitado(label, timeout = config.timeouts.explicitWaitMs) {
    await this.driver
      .wait(async () => {
        return this.driver.executeScript((lbl) => {
          const normalizar = (t) => (t || '').replace(/\*/g, '').replace(/:\s*$/, '').trim();
          const esVisible = (el) => {
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
          };
          const esContenedorCampo = (el) => {
            const c = el.className && typeof el.className === 'string' ? el.className : '';
            return c.includes('group-field') || / dx-field-item /.test(' ' + c + ' ');
          };
          const candidatos = Array.from(document.querySelectorAll('*')).filter(
            (el) => esVisible(el) && esContenedorCampo(el) && el.querySelector('label')
          );
          const cont = candidatos.find((el) => {
            const labelEl = el.querySelector('label');
            const directo = Array.from(labelEl.childNodes)
              .filter((n) => n.nodeType === 3)
              .map((n) => n.textContent)
              .join('')
              .trim();
            return normalizar(directo || labelEl.textContent) === normalizar(lbl);
          });
          if (!cont) return false;
          const widget = cont.querySelector('.dx-widget');
          return !!widget && !widget.className.includes('dx-state-disabled');
        }, label);
      }, timeout)
      .catch(() => {});
  }

  /**
   * Cascada "Datos básicos": "Tipo ID" habilita "Identificación". Debe
   * llamarse ANTES de `completarSeccion(ESTRATEGIAS_DATOS_BASICOS, ..., {
   * excepto: ['Identificación'] })`.
   *
   * `forzar`: en Crear, "Identificación" arranca vacío — no sobreescribir si
   * ya se llenó por algún motivo (`estaVacio` gate). En Editar, el campo YA
   * tiene un valor existente (el del empleado real) — si se está cambiando
   * "Tipo ID" a propósito, hay que forzar la escritura de "Identificación"
   * igual, o el cambio de máscara queda con el valor viejo.
   */
  async cascadaIdentificacion(tipoId, identificacion, { forzar = false } = {}) {
    await this.setCampo(ESTRATEGIAS_DATOS_BASICOS, 'Tipo ID', tipoId);
    await this._esperarCampoHabilitado('Identificación');
    if (forzar || (await this.form.estaVacio('Identificación'))) {
      await this.setCampo(ESTRATEGIAS_DATOS_BASICOS, 'Identificación', identificacion);
    }
  }

  /**
   * Cascada "Datos personales": "País" (Dirección) habilita "Ciudad",
   * "Ciudad" habilita "Sector", "Sector" habilita "Calle". Debe llamarse
   * ANTES de `completarSeccion(ESTRATEGIAS_DATOS_PERSONALES, ..., {
   * excepto: ['Ciudad', 'Sector', 'Calle'] })` (que ya completa "País").
   */
  async cascadaDireccion({ pais, ciudad, sector, calle, forzar = false } = {}) {
    await this.setCampo(ESTRATEGIAS_DATOS_PERSONALES, 'País', pais);
    await this._esperarCampoHabilitado('Ciudad');
    await this.setCampo(ESTRATEGIAS_DATOS_PERSONALES, 'Ciudad', ciudad);
    await this._esperarCampoHabilitado('Sector');
    await this.setCampo(ESTRATEGIAS_DATOS_PERSONALES, 'Sector', sector);
    await this._esperarCampoHabilitado('Calle');
    if (forzar || (await this.form.estaVacio('Calle'))) {
      await this.setCampo(ESTRATEGIAS_DATOS_PERSONALES, 'Calle', calle);
    }
  }

  /**
   * Completa TODOS los controles de `estrategias` con los valores de
   * `valores` (típicamente Execution Context + defaults QA ya mezclados
   * ANTES de llamar acá — ver `crear-empleado.test.js`). Mismo criterio
   * "completar solo vacíos" que `ConfiguracionEntidadDetallePage`/
   * `SolicitudEmpleoFormPage`: si el control ya tiene datos, no se
   * sobreescribe. Un selectbox SIN valor provisto usa el comportamiento por
   * defecto de su estrategia (primera opción); un campo de texto SIN valor
   * provisto queda intacto (`TextInputStrategy` no toca nada sin valor).
   *
   * `excepto`: labels que este pase NO debe tocar (cascadas resueltas aparte
   * por el llamador, ANTES de invocar esto).
   */
  async completarSeccion(estrategias, valores = {}, { excepto = [], etiqueta = 'sección' } = {}) {
    // Cobertura OBLIGATORIA, no opcional: garantiza que ESTRATEGIAS declara
    // TODO control real de la sección actual antes de tocar nada — `estricta`
    // hace que un control visible sin declarar FALLE el test, en vez de solo
    // quedar en un log que nadie lee (causa raíz real del incidente de
    // "Editar paquete salarial", 2026-09-04: dos controles quedaron fuera de
    // ESTRATEGIAS y nada lo impidió). Como `completarSeccion`/`aplicarCambios`
    // son los ÚNICOS caminos por los que CUALQUIER `crear-*`/`editar-*` de
    // Empleados ya pasa (presente y futuro), esto corre SIEMPRE, sin que cada
    // test tenga que acordarse de llamarlo aparte.
    await this.form.validarControlesDeclarados(estrategias, {
      etiqueta,
      estricta: true,
      excluir: CAMPOS_CALCULADOS.get(estrategias),
    });
    const resultado = {};
    for (const label of Object.keys(estrategias)) {
      if (excepto.includes(label)) continue;
      if (!(await this.form.estaVacio(label))) {
        logger.info(`EmpleadoFormPage: "${label}" ya tiene datos, no se sobreescribe`);
        continue;
      }
      const provisto = valores[label];
      resultado[label] = await this.setCampo(estrategias, label, provisto);
    }
    return resultado;
  }

  /**
   * Aplica `cambios` (dict `{ campo: valor }`) SIEMPRE, sin importar si el
   * control ya tiene datos — a diferencia de `completarSeccion` (pensado
   * para Crear, donde el registro arranca vacío), en Editar TODOS los
   * campos ya tienen el valor actual del empleado real, así que "solo
   * completar vacíos" nunca aplicaría ningún cambio. Solo toca los campos
   * presentes en `cambios` (los demás quedan intactos).
   */
  async aplicarCambios(estrategias, cambios = {}, { etiqueta = 'sección' } = {}) {
    // Misma cobertura obligatoria que `completarSeccion` — ver su comentario.
    await this.form.validarControlesDeclarados(estrategias, {
      etiqueta,
      estricta: true,
      excluir: CAMPOS_CALCULADOS.get(estrategias),
    });
    // Devuelve lo que el CONTROL quedó mostrando tras escribir (releído con
    // `getValor`, no el valor pedido ni el retorno de `setCampo`): algunas
    // estrategias `custom` (ej. el escape hatch `clear:false` de "Condición
    // médica"/"Teléfono*") delegan en `Form.escribir`, que no retorna nada
    // (confirmado real: usar ese retorno como "aplicado" daba `undefined`);
    // y algunos editores enmascarados reformatean el valor pedido (ej.
    // teléfono), por lo que compararse contra el valor crudo pedido también
    // daría falso negativo. Mismo criterio ya usado en
    // `cascadaIdentificacion`/`cascadaDireccion`.
    const resultado = {};
    for (const [label, valor] of Object.entries(cambios)) {
      await this.setCampo(estrategias, label, valor);
      resultado[label] = await this.form.getValor(label);
    }
    return resultado;
  }

  /**
   * Guarda el formulario (botón "Guardar" del header sticky, click por JS) y
   * confirma el popup que aparece después (a pedido explícito del usuario) —
   * mismo mecanismo genérico ya usado en Configuración/Banco de candidatos.
   */
  async guardar() {
    logger.info('EmpleadoFormPage: Guardar');
    const btn = await this.waitVisible(this.btnGuardar);
    await this.driver.executeScript('arguments[0].click()', btn);

    const apareceConfirm = await this.popupConfirmar
      .esperarVisible(4000)
      .then(() => true)
      .catch(() => false);
    if (apareceConfirm) {
      logger.info('EmpleadoFormPage: confirmando popup de "Guardar"');
      const accion = await this.popupConfirmar.accionar(/guardar|aceptar|s[ií]/i, { etiqueta: 'Guardar/Aceptar' });
      if (!accion.encontrado || accion.deshabilitado) {
        throw new Error(`EmpleadoFormPage: no se pudo confirmar el popup de Guardar (${JSON.stringify(accion)}).`);
      }
      await this.popupConfirmar.esperarCerrado();
    }
    return { popupConfirmado: apareceConfirm };
  }

  /**
   * Clasifica el resultado tras Guardar. CONFIRMADO con Selenium real
   * (varias corridas): a diferencia de Configuración, esta pantalla NO
   * muestra NINGÚN notify de éxito — cuando la validación pasa, aparece (y
   * `guardar()` ya confirmó) el popup de confirmación y el notify queda
   * vacío durante los ~10s siguientes. Cuando la validación FALLA, el popup
   * NUNCA aparece y en cambio se muestra el notify "Operación Inválida...".
   * Por eso el criterio real es: `guardar()` confirmó el popup
   * (`popupConfirmado`) Y no apareció ningún notify en una espera corta (si
   * apareciera uno acá, solo puede ser el de error — el de éxito no existe
   * en esta pantalla).
   */
  async resultadoGuardado({ popupConfirmado } = {}, timeoutMs = 5000) {
    const texto = await this.notify.esperarTexto(timeoutMs);
    if (texto) return Notify.clasificar(texto);
    return { notify: '', exito: !!popupConfirmado, invalido: !popupConfirmado, errorSistema: false };
  }
}

module.exports = EmpleadoFormPage;
