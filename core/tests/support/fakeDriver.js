const { JSDOM } = require('jsdom');

/**
 * DRIVER SIMULADO para las pruebas unitarias del core.
 *
 * Los componentes del framework no dependen de Selenium: dependen de una
 * INTERFAZ muy chica del driver (`executeScript`, `wait`, `findElement`). Este
 * módulo implementa esa misma interfaz contra un DOM en memoria (jsdom), así
 * las pruebas ejercitan el código REAL del componente —el mismo que corre en
 * producción— sin abrir Chrome ni conectarse a ninguna aplicación.
 *
 * Qué se respeta del contrato de Selenium (para que la prueba sea honesta):
 *  - `executeScript(fn, ...args)` serializa y ejecuta la función en el contexto
 *    del documento; devuelve `null` cuando la función no retorna nada.
 *  - `executeScript('arguments[0].click()', el)` también acepta scripts como
 *    string, igual que WebDriver.
 *  - `wait(condicion, timeout)` poll-ea y **rechaza** al expirar (los
 *    componentes dependen de ese rechazo para sus `.catch(() => {})`).
 *  - `findElement` lanza si el elemento no existe.
 *
 * NO se simula nada más: si una prueba necesitara más superficie de Selenium,
 * es señal de que ese comportamiento pertenece a las pruebas E2E.
 */

class ErrorDeEspera extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'TimeoutError';
  }
}

class ElementoNoEncontrado extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'NoSuchElementError';
  }
}

function crearDom(html = '') {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  // jsdom no implementa scrollIntoView y los componentes lo llaman antes de
  // clickear (el header es sticky). Se stubea acá, en la infraestructura de
  // prueba, para no tocar el framework.
  dom.window.Element.prototype.scrollIntoView = function scrollIntoView() {};

  // jsdom no calcula layout: `offsetWidth`/`offsetHeight` siempre dan 0, así que
  // los componentes que filtran por VISIBILIDAD (ej. Popup) no podrían probarse.
  // Se define una visibilidad razonable para la infra de prueba: un elemento es
  // "visible" salvo que esté explícitamente oculto (display:none, visibility,
  // atributo hidden, o las clases utilitarias `d-none`/`h-0px` que usa la app).
  const oculto = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const st = n.style || {};
      const cls = n.className && n.className.toString ? n.className.toString() : '';
      if (st.display === 'none' || st.visibility === 'hidden' || n.hasAttribute('hidden')) return true;
      if (/\bd-none\b|\bh-0px\b/.test(cls)) return true;
    }
    return false;
  };
  const dim = { get() { return oculto(this) ? 0 : 10; }, configurable: true };
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', dim);
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', dim);
  return dom;
}

/**
 * @param {string} html  cuerpo del documento simulado
 * @returns driver simulado + utilidades de inspección para los asserts
 */
function crearDriver(html = '') {
  const dom = crearDom(html);
  const { document } = dom.window;

  // Traza de lo que hizo el componente: sirve para verificar COMPORTAMIENTO
  // (qué se clickeó) sin espiar la implementación interna.
  const traza = { scripts: 0, clicks: [], esperas: 0 };

  // Globals que el browser expone y que el código inyectado usa (`document`,
  // `location`, `window`). Se instalan solo mientras dura el script, igual que
  // el aislamiento que da el navegador.
  function conDocumentoGlobal(fn) {
    const previos = {
      document: global.document,
      window: global.window,
      location: global.location,
    };
    global.document = document;
    global.window = dom.window;
    global.location = dom.window.location;
    try {
      return fn();
    } finally {
      Object.entries(previos).forEach(([clave, valor]) => {
        if (valor === undefined) delete global[clave];
        else global[clave] = valor;
      });
    }
  }

  const driver = {
    dom,
    document,
    traza,

    async executeScript(script, ...args) {
      traza.scripts += 1;
      return conDocumentoGlobal(() => {
        let resultado;
        if (typeof script === 'function') {
          resultado = script.apply(null, args);
        } else {
          // Scripts como string ("arguments[0].click()"): `arguments` dentro de
          // la función creada son los argumentos que se le pasan.
          if (/\.click\(\)/.test(script) && args[0]) traza.clicks.push(args[0]);
          resultado = new Function(script).apply(null, args);
        }
        return resultado === undefined ? null : resultado;
      });
    },

    /**
     * Poll con deadline real. Rechaza al expirar, como WebDriver.
     * Los tests pasan timeouts chicos (decenas de ms) para correr en milisegundos.
     */
    async wait(condicion, timeout = 200) {
      traza.esperas += 1;
      const limite = Date.now() + timeout;
      for (;;) {
        const valor = await condicion(driver);
        if (valor) return valor;
        if (Date.now() >= limite) {
          throw new ErrorDeEspera(`La condición no se cumplió en ${timeout}ms`);
        }
        await new Promise((r) => setTimeout(r, 5));
      }
    },

    async findElement(locator) {
      const selector = locator && locator.value ? locator.value : String(locator);
      const el = document.querySelector(selector);
      if (!el) throw new ElementoNoEncontrado(`No se encontró el elemento: ${selector}`);
      return el;
    },

    async findElements(locator) {
      const selector = locator && locator.value ? locator.value : String(locator);
      return Array.from(document.querySelectorAll(selector));
    },

    /** Solo para las pruebas de evidencia: PNG mínimo válido en base64. */
    async takeScreenshot() {
      return PNG_BASE64;
    },
  };

  return driver;
}

/** PNG 1x1 transparente (base64), suficiente para verificar el Data URI. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

module.exports = { crearDriver, crearDom, PNG_BASE64, ErrorDeEspera, ElementoNoEncontrado };
