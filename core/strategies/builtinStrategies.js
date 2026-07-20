const { Key } = require('selenium-webdriver');
const SelectionStrategy = require('./SelectionStrategy');
const logger = require('../utils/logger');

/**
 * Estrategias de selección incluidas de fábrica.
 *
 * Todas COMPONEN las primitivas ya verificadas del componente Form (abrir
 * dropdown, esperar item visible, cerrar overlay). No reimplementan nada: si
 * mañana cambia el DOM de la app, se arregla en Form y todas las estrategias
 * siguen andando.
 *
 * Para agregar una estrategia nueva: creá su archivo con una subclase de
 * SelectionStrategy y registrala en strategies/index.js (o en runtime con
 * `strategies.registrar(...)`). No hay que tocar Form ni ningún test.
 */

/**
 * Primera opción válida del dropdown. Es el COMPORTAMIENTO ACTUAL por defecto
 * cuando el Execution Context no define un valor.
 */
class FirstOptionStrategy extends SelectionStrategy {
  async aplicar(form, label) {
    return form.seleccionarPrimera(label);
  }
}

/**
 * Selección directa: abre el dropdown y clickea la opción por su texto, sin
 * escribir. Para listas cortas sin buscador.
 */
class DirectSelectStrategy extends SelectionStrategy {
  async aplicar(form, label, valor) {
    if (valor === undefined || valor === null || valor === '') return form.seleccionarPrimera(label);
    await form.seleccionar(label, valor);
    return valor;
  }
}

/**
 * SEARCH & SELECT — el caso importante de esta app.
 *
 * Muchos controles DevExtreme filtran al escribir, pero ESCRIBIR NO ALCANZA:
 * la app solo da por válido el valor cuando se selecciona explícitamente el
 * elemento del listado. Esta estrategia hace las 4 cosas:
 *   1. abre el dropdown
 *   2. escribe el texto para filtrar
 *   3. espera el filtrado (hasta que el item con ese texto esté visible)
 *   4. CLICKEA el item (paso que no se puede omitir)
 */
class SearchAndSelectStrategy extends SelectionStrategy {
  async aplicar(form, label, valor, opciones = {}) {
    if (valor === undefined || valor === null || valor === '') return form.seleccionarPrimera(label);

    logger.info(`SearchAndSelect: "${valor}" en "${label}"`);
    await form._abrirDropdown(label);

    // 2) escribir para filtrar (se limpia lo previo con Ctrl+A)
    const input = await form._inputBusqueda(label);
    await input.sendKeys(Key.chord(Key.CONTROL, 'a'), String(valor));

    // 3) esperar el filtrado + 4) seleccionar explícitamente el item
    const item = await form._itemVisiblePorTexto(opciones.textoEsperado || valor);
    const texto = (await item.getText()).trim();
    await item.click();

    if (opciones.multiple) {
      // un tagbox no cierra solo al elegir
      await form.driver.actions().sendKeys(Key.ESCAPE).perform();
    }
    await form._esperarOverlayCerrado();
    return texto;
  }
}

/**
 * Tagbox (multi-select): selecciona por texto y cierra con Escape. Sin valor,
 * toma el primero.
 */
class TagSelectStrategy extends SelectionStrategy {
  async aplicar(form, label, valor) {
    if (valor === undefined || valor === null || valor === '') return form.seleccionarPrimerTag(label);
    await form.seleccionarTagPorTexto(label, valor);
    return valor;
  }
}

/** Textbox / textarea. Delega en Form.escribir (que ya hace el blur con TAB). */
class TextInputStrategy extends SelectionStrategy {
  async aplicar(form, label, valor) {
    if (valor === undefined || valor === null) return undefined;
    await form.escribir(label, String(valor));
    return valor;
  }
}

/** Switch on/off. Acepta booleano o los strings 'true'/'si'/'1'. */
class SwitchStrategy extends SelectionStrategy {
  async aplicar(form, label, valor) {
    const encendido =
      valor === true || /^(true|s[ií]|1|on)$/i.test(String(valor === undefined ? '' : valor));
    await form.setSwitch(label, encendido);
    return encendido;
  }
}

/**
 * DateBox: escribe la fecha en el editor y confirma con TAB (los editores de
 * DevExtreme commitean en el blur). Si se prefiere el calendario, se puede
 * registrar otra estrategia sin tocar esta.
 */
class DatePickerStrategy extends SelectionStrategy {
  async aplicar(form, label, valor) {
    if (valor === undefined || valor === null || valor === '') return undefined;
    await form.escribir(label, String(valor));
    return valor;
  }
}

/**
 * Dropdown con árbol (dx-treeview): abre, escribe si el control filtra, y
 * clickea el NODO cuyo texto coincide.
 */
class TreeViewStrategy extends SelectionStrategy {
  async aplicar(form, label, valor) {
    if (valor === undefined || valor === null || valor === '') return form.seleccionarPrimera(label);
    await form._abrirDropdown(label);
    try {
      const input = await form._inputBusqueda(label);
      await input.sendKeys(Key.chord(Key.CONTROL, 'a'), String(valor));
    } catch (e) {
      /* el treeview puede no tener buscador: se sigue por texto */
    }
    const nodo = await form._itemVisiblePorTexto(valor, '.dx-treeview-item, .dx-list-item');
    const texto = (await nodo.getText()).trim();
    await nodo.click();
    await form._esperarOverlayCerrado();
    return texto;
  }
}

/**
 * Escape hatch: delega en una función provista por el Page Object.
 *   { estrategia: 'custom', fn: async (form, label, valor) => { ... } }
 * Permite cubrir un control raro sin crear una clase, y sin tocar los tests.
 */
class CustomStrategy extends SelectionStrategy {
  async aplicar(form, label, valor, opciones = {}) {
    if (typeof opciones.fn !== 'function') {
      throw new Error(`CustomStrategy para "${label}" requiere opciones.fn`);
    }
    return opciones.fn(form, label, valor, opciones);
  }
}

module.exports = {
  FirstOptionStrategy,
  DirectSelectStrategy,
  SearchAndSelectStrategy,
  TagSelectStrategy,
  TextInputStrategy,
  SwitchStrategy,
  DatePickerStrategy,
  TreeViewStrategy,
  CustomStrategy,
};
