const { By, Key } = require('selenium-webdriver');
const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Tipo Nómina" (Configuración > Nómina > Tipo
 * Nómina). Toda la mecánica genérica vive en `ConfiguracionEntidadDetallePage`
 * (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (metadata real, `screenInspector`):
 *  - "Nombre": texto libre REQUERIDO — identificador de la fila.
 *  - "Código nómina": texto libre REQUERIDO.
 *  - "Forma Cálculo"/"Frecuencia salarial"/"Tipo Empleados": selectbox con
 *    buscador REQUERIDOS — `searchAndSelect`.
 *  - "Intervalo de pago": numberbox REQUERIDO. Llega con "0" por defecto,
 *    que la app rechaza como si estuviera vacío (mismo hallazgo ya
 *    documentado para "Tarifa" de Planes de seguro) — el test SIEMPRE lo
 *    completa explícito, nunca vía autofill.
 *  - "TSS Tipo nómina": numberbox OPCIONAL (a pesar del nombre "Tipo", el
 *    control real es numérico, no un selectbox — confirmado en la metadata:
 *    el `<label>` aparece duplicado por un contenedor ANIDADO que también
 *    matchea, mismo problema ya resuelto en `Form._campo` quedándose con el
 *    control más interno/específico; el válido es el numberbox).
 *  - "Moneda": selectbox con buscador OPCIONAL — `searchAndSelect`.
 *  - "Permite reapertura": switch OPCIONAL.
 *  - "Estado": selectbox REQUERIDO, llega con un valor preseleccionado
 *    (`directSelect`).
 *  - "Distribución de Pago": a diferencia de otras secciones ignorables
 *    (ej. "Distribución Centro Costo" de Departamentos), esta es
 *    OBLIGATORIA para poder Guardar (confirmado con evidencia real: "Debes
 *    definir una distribución de pago") — por eso NO se declara en
 *    ESTRATEGIAS (no es un control simple de Form/Selection Strategy) pero
 *    sí se completa siempre, vía `completarDistribucionPago()`. El widget de
 *    alta ("Número de intervalos"/"Nombre"/"Porciento" + botón "Agregar")
 *    recién aparece cuando "Intervalo de pago" (campo del form principal) es
 *    mayor a 0 — con "0" la grilla no expone ningún control de alta. Hay que
 *    agregar EXACTAMENTE tantos intervalos como indique "Intervalo de pago",
 *    y sus "Porciento" deben sumar 100 — indicaciones confirmadas por el
 *    usuario, no inferidas del DOM. Los inputs del widget se localizan por
 *    `name` (`nombreIntervalo`/`valorPorcentualIntervalo`), no por label:
 *    "Nombre" ahí colisiona con el campo "Nombre" del formulario principal
 *    (mismo label, control distinto) — igual criterio que los popups de
 *    "agregar" ya documentados (`SolicitudEmpleoDetallePage.
 *    agregarOtroBeneficio`).
 *  - BUG DE APP (confirmado con evidencia real, 2026-08-19, reproducido 2/2
 *    veces): entrar en modo "Editar" sobre un Tipo Nómina EXISTENTE dispara
 *    un `TimeoutError` — la sección "Distribución de Pago" queda con su
 *    spinner de carga girando indefinidamente (nunca termina de cargar) y
 *    `_esperarCamposHabilitados()` nunca se estabiliza. Reproducido en modo
 *    automático (primera fila del listado, "Nomina Quincenal - 004") en 2
 *    corridas Headless seguidas. NO es un problema del test —
 *    `editar-tipo-nomina.test.js` queda escrito correctamente y DEBE seguir
 *    fallando hasta que se corrija del lado de la app (mismo criterio que
 *    el bug de Editar ya documentado en `CuentaContableDetallePage`).
 */
const ESTRATEGIAS = {
  Nombre: 'text',
  'Código nómina': 'text',
  'Forma Cálculo': 'searchAndSelect',
  'Frecuencia salarial': 'searchAndSelect',
  'Tipo Empleados': 'searchAndSelect',
  'Intervalo de pago': 'text',
  'TSS Tipo nómina': 'text',
  Moneda: 'searchAndSelect',
  'Permite reapertura': 'switch',
  Estado: 'directSelect',
};

class TipoNominaDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'tipo-nomina';
  }

  /**
   * Agrega UNA fila a "Distribución de Pago" (ver mapeo arriba). "Número de
   * intervalos" se autocompleta solo (secuencial) — se completan "Nombre" y
   * "Porciento" del intervalo y se clickea "Agregar"
   * (`.distribucion-tipo-nomina-guardar-btn`, clase propia del botón).
   */
  async agregarIntervaloDistribucionPago(nombreIntervalo, porciento) {
    // Cada input del widget tiene DOS representaciones en el DOM (patrón ya
    // visto en otros formularios dxForm: un proxy oculto con `name`, y el
    // input VISIBLE real con `id` terminado en el mismo nombre de campo, sin
    // `name`) — confirmado con evidencia real: `input[name="..."]` matcheaba
    // el proxy oculto y tiraba "element not interactable". Se localiza por
    // el `id$=` (sufijo), que siempre cae en el visible.
    // `.clear()` además tira "invalid element state" en estos numberbox
    // (mismo motivo que otros editores enmascarados del framework) — se
    // selecciona todo con CTRL+A antes de tipear, no se usa `.clear()`.
    const inputNombre = await this.driver.findElement(By.css('input[id$="_nombreIntervalo"]'));
    await inputNombre.sendKeys(Key.chord(Key.CONTROL, 'a'), nombreIntervalo);

    const inputPorciento = await this.driver.findElement(By.css('input[id$="_valorPorcentualIntervalo"]'));
    await inputPorciento.sendKeys(Key.chord(Key.CONTROL, 'a'), String(porciento), Key.TAB);

    // `.distribucion-tipo-nomina-guardar-btn` es un WRAPPER enorme (ocupa
    // casi todo el ancho de la fila, confirmado con evidencia real:
    // `getBoundingClientRect()` daba ~1560px de ancho) — un click nativo cae
    // en su CENTRO, lejos del texto "Agregar" (a la derecha), así que nunca
    // llegaba a disparar el alta. Se clickea el `<span class="dx-button-text">`
    // interno con el texto exacto, que sí tiene el tamaño real del botón.
    const btnAgregar = await this.driver.findElement(
      By.xpath(
        "//*[contains(@class,'distribucion-tipo-nomina-guardar-btn')]//span[contains(@class,'dx-button-text') and normalize-space(.)='Agregar']"
      )
    );
    await btnAgregar.click();
  }

  /**
   * Completa TODA la "Distribución de Pago": un intervalo por cada valor de
   * `porcientos` (deben sumar 100 — validación de la app). La cantidad de
   * valores debe coincidir con "Intervalo de pago" del formulario principal.
   * Nombres autogenerados ("Intervalo 1", "Intervalo 2", …) — no son el foco
   * de la prueba, solo hace falta que la suma cierre en 100.
   */
  async completarDistribucionPago(porcientos) {
    for (let i = 0; i < porcientos.length; i++) {
      await this.agregarIntervaloDistribucionPago(`Intervalo ${i + 1}`, porcientos[i]);
    }
  }
}

module.exports = TipoNominaDetallePage;
