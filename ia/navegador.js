'use strict';

/**
 * Adaptador Selenium del runner de Casos de Uso IA: traduce las acciones del modelo (lista cerrada en
 * `DEFINICIONES`) a comandos del driver. Solo opera sobre la página abierta (y navegación del mismo origen);
 * NO ejecuta JavaScript que venga del modelo, no toca el filesystem ni abre procesos. Vive solo en `ia/`:
 * no es una capa general del framework ni se usa desde los tests.
 */
const { By, Key } = require('selenium-webdriver');
const UiContext = require('@triple/core/utils/UiContext');
const politicas = require('./politicas');

const MAX_ELEMENTOS = 150;

/** Herramientas expuestas al modelo (definición neutra; `clienteOpenAI.js` la traduce a `tools` de OpenAI). */
const DEFINICIONES = [
  {
    name: 'inspeccionar',
    description:
      'Devuelve el estado actual de la página: URL, título, texto visible, diálogos/notificaciones y la lista numerada de elementos interactivos visibles (usa esos `id` en las demás herramientas). Los ids cambian en cada inspección o acción. Recibes una captura solo cuando algo relevante cambió; pide `captura: true` si necesitas verla.',
    input_schema: { type: 'object', properties: { captura: { type: 'boolean' } } },
  },
  {
    name: 'buscar_texto',
    description:
      'Comprueba si un texto aparece en la página visible (sin importar mayúsculas ni acentos) y cuántas veces. Úsala para verificar mensajes, títulos, nombres o la AUSENCIA de algo, sin depender de una captura.',
    input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
  },
  {
    name: 'leer_elemento',
    description: 'Lee el texto, valor, estado (habilitado, marcado) y atributos accesibles del elemento con ese `id`. Úsala para verificar el valor de un campo o el estado de un control.',
    input_schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
  },
  {
    name: 'hacer_click',
    description: 'Hace click (o doble click si `doble` es true) sobre el elemento con ese `id`. Los listados abren el detalle con doble click sobre la fila.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' }, doble: { type: 'boolean' } },
      required: ['id'],
    },
  },
  {
    name: 'escribir',
    description: 'Escribe `texto` en el campo con ese `id` (por defecto borra antes el contenido; `enter` presiona Enter al final).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer' }, texto: { type: 'string' }, borrar: { type: 'boolean' }, enter: { type: 'boolean' } },
      required: ['id', 'texto'],
    },
  },
  {
    name: 'tecla',
    description: `Presiona una tecla sobre el elemento enfocado. Permitidas: ${[...politicas.TECLAS.keys()].join(', ')}.`,
    input_schema: { type: 'object', properties: { tecla: { type: 'string' } }, required: ['tecla'] },
  },
  {
    name: 'seleccionar_opcion',
    description: 'Para un <select> nativo: elige la opción cuyo texto visible coincide. Los combos/listas de la app (DevExtreme) se operan con hacer_click sobre el campo y luego sobre la opción.',
    input_schema: { type: 'object', properties: { id: { type: 'integer' }, texto: { type: 'string' } }, required: ['id', 'texto'] },
  },
  {
    name: 'navegar',
    description: 'Abre una ruta o URL DENTRO de la aplicación bajo prueba (otro origen se rechaza).',
    input_schema: { type: 'object', properties: { destino: { type: 'string' } }, required: ['destino'] },
  },
  {
    name: 'esperar',
    description: 'Espera unos segundos (máx. 10) a que la página termine de actualizarse.',
    input_schema: { type: 'object', properties: { segundos: { type: 'number' } }, required: ['segundos'] },
  },
  {
    name: 'desplazar',
    description: 'Desplaza la página (o el contenedor del elemento `id`) hacia arriba o abajo.',
    input_schema: {
      type: 'object',
      properties: { direccion: { type: 'string', enum: ['arriba', 'abajo'] }, id: { type: 'integer' } },
      required: ['direccion'],
    },
  },
  {
    name: 'finalizar',
    description:
      'Termina la ejecución cuando ya ejecutaste el caso y comprobaste sus condiciones esperadas. Cada condición se verifica con una observación DIRECTA de la aplicación (texto visible, valor de un campo, estado de un control, navegación, presencia/ausencia, mensaje de la app); una captura no es necesaria. `resultado`: PASS si todas las condiciones esperadas quedaron verificadas; FAIL si ejecutaste el caso y alguna no se cumple o la app se comporta mal; BLOCKED solo si de verdad no puedes continuar de forma fundamentada (imposibilidad real o especificación ambigua).',
    input_schema: {
      type: 'object',
      properties: {
        resultado: { type: 'string', enum: ['PASS', 'FAIL', 'BLOCKED'] },
        resumen: { type: 'string' },
        motivo: { type: 'string', description: 'Obligatorio si FAIL o BLOCKED.' },
        verificaciones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              condicion: { type: 'string' },
              estado: { type: 'string', enum: ['cumplida', 'incumplida', 'no_verificada'] },
              metodo: { type: 'string', enum: ['texto_visible', 'valor_campo', 'estado_control', 'navegacion', 'presencia_ausencia', 'mensaje_app', 'captura', 'otro'], description: 'Cómo la comprobaste en el navegador.' },
              evidencia: { type: 'string', description: 'Qué observaste directamente que respalda el estado.' },
              texto_observado: { type: 'string', description: 'Texto/valor exacto que viste en la app (opcional); se contrasta con lo que el navegador realmente mostró.' },
            },
            required: ['condicion', 'estado'],
          },
        },
      },
      required: ['resultado', 'resumen', 'verificaciones'],
    },
  },
];

/** Corre en el navegador: numera los elementos interactivos visibles (data-ia-id) y resume la página. */
function instantanea(maxElementos) {
  const visible = (el) => {
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  };
  const recortar = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
  document.querySelectorAll('[data-ia-id]').forEach((e) => e.removeAttribute('data-ia-id'));
  const SEL = [
    'a[href]', 'button', 'input', 'textarea', 'select', '[role=button]', '[role=link]', '[role=tab]', '[role=menuitem]',
    '[role=option]', '[role=checkbox]', '[role=radio]', '[role=combobox]', '[role=switch]', '[role=treeitem]', '.dx-button',
    '.dx-tab', '.dx-list-item', '.dx-treeview-item', '.dx-checkbox', '.dx-switch', '.dx-dropdowneditor-button', '.dx-data-row',
    '[onclick]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const explicitos = Array.from(document.querySelectorAll(SEL)).filter(visible);
  // Menús/ítems hechos con divs sin rol (p. ej. React): clickeables = cursor pointer, el más externo de su cadena.
  const pointer = Array.from(document.querySelectorAll('body *')).filter((e) => {
    if (explicitos.includes(e) || !visible(e) || window.getComputedStyle(e).cursor !== 'pointer') return false;
    const padre = e.parentElement;
    if (padre && window.getComputedStyle(padre).cursor === 'pointer') return false;
    return !explicitos.some((o) => e.contains(o)) && recortar(e.innerText || e.textContent, 5) !== '';
  });
  const candidatos = explicitos.concat(pointer);
  const esCampo = (e) => /^(input|textarea|select)$/i.test(e.tagName);
  // Un contenedor genérico (tabindex/onclick) que ya envuelve otros candidatos se descarta; los controles explícitos
  // (enlaces, botones, campos, filas de grid, ítems de lista, pestañas…) siempre se conservan.
  const EXPLICITOS = 'a[href], button, input, textarea, select, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=checkbox], [role=radio], [role=combobox], [role=switch], [role=treeitem], .dx-button, .dx-tab, .dx-list-item, .dx-data-row, .dx-checkbox, .dx-switch';
  const finales = candidatos.filter((e) => e.matches(EXPLICITOS) || !candidatos.some((o) => o !== e && e.contains(o)));
  const etiquetaDe = (e) => {
    const directa = e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder');
    if (esCampo(e)) {
      const cont = e.closest('.dx-field-item, .group-field, .group-field-2, .dependiente-form-item');
      const lbl = cont && cont.querySelector('label');
      return recortar((lbl && lbl.textContent) || directa || e.getAttribute('name') || '', 60);
    }
    return recortar(e.innerText || e.textContent || directa, 80);
  };
  const elementos = finales.slice(0, maxElementos).map((e, i) => {
    e.setAttribute('data-ia-id', String(i + 1));
    const tipo = esCampo(e) ? (e.tagName.toLowerCase() + (e.type ? `:${e.type}` : '')) : e.getAttribute('role') || e.tagName.toLowerCase();
    const o = { id: i + 1, tipo, etiqueta: etiquetaDe(e) };
    if (esCampo(e) && e.type !== 'password') o.valor = recortar(e.value, 60);
    if (e.disabled || e.getAttribute('aria-disabled') === 'true' || e.classList.contains('dx-state-disabled')) o.deshabilitado = true;
    if (e.checked || e.getAttribute('aria-checked') === 'true' || e.getAttribute('aria-pressed') === 'true') o.marcado = true;
    return o;
  });
  const notificaciones = Array.from(document.querySelectorAll('[class*=notify], [class*=toast], [role=alert]'))
    .filter(visible)
    .map((e) => recortar(e.innerText, 200))
    .filter(Boolean);
  const dialogos = Array.from(document.querySelectorAll('[role=dialog], .dx-popup-wrapper .dx-popup-content, .confirmPopupContent'))
    .filter(visible)
    .map((e) => recortar(e.innerText, 400))
    .filter(Boolean);
  return {
    url: location.href,
    titulo: document.title,
    texto: recortar(document.body.innerText, 1800),
    notificaciones: Array.from(new Set(notificaciones)).slice(0, 5),
    dialogos: Array.from(new Set(dialogos)).slice(0, 3),
    elementos,
    hayMas: finales.length > maxElementos,
  };
}

/** True si NO hay overlay de carga (loader de la app o panel de carga de DevExtreme) visible. */
function sinCargaVisible() {
  const visible = (el) => {
    const s = window.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) !== 0 && r.width > 0 && r.height > 0;
  };
  return !Array.from(document.querySelectorAll('.dx-loadpanel-wrapper, [class*=loader_manager], [class*=loader-manager]')).some(
    (e) => visible(e) && !e.matches('[class*=cursor-events-none]')
  );
}

/** Corre en el navegador: ¿aparece `texto` en el texto visible de la página? (sin mayúsculas ni acentos) */
function buscarTexto(texto) {
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const cuerpo = norm(document.body.innerText);
  const buscado = norm(texto);
  let n = 0;
  let i = cuerpo.indexOf(buscado);
  const contextos = [];
  while (i >= 0 && n < 50) {
    n++;
    if (contextos.length < 3) contextos.push(cuerpo.slice(Math.max(0, i - 40), i + buscado.length + 40));
    i = cuerpo.indexOf(buscado, i + buscado.length);
  }
  return n ? `El texto aparece ${n} vez/veces en la página visible. Contexto: ${JSON.stringify(contextos)}` : 'El texto NO aparece en la página visible.';
}

/** Corre en el navegador: ¿el elemento (o su control contenedor) está deshabilitado? */
function estaDeshabilitado(el) {
  const c = el.closest('[aria-disabled="true"], .dx-state-disabled, [disabled]');
  return !!(c || el.disabled);
}

/** Corre en el navegador: textos (celdas/segmentos) del elemento sobre el que se va a actuar. Solo lectura. */
function segmentosDe(el) {
  return String(el.innerText || el.textContent || '')
    .split(/[\t\r\n]+/)
    .map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 8);
}

/** Corre en el navegador: lectura de un elemento (valor, texto y estado). */
function leerElemento(el) {
  const recortar = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const info = {
    tipo: el.tagName.toLowerCase() + (el.type ? `:${el.type}` : ''),
    texto: recortar(el.innerText || el.textContent, 400),
    deshabilitado: !!(el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('dx-state-disabled')),
  };
  if ('value' in el && el.type !== 'password') info.valor = recortar(el.value, 300);
  if (el.checked !== undefined && el.type) info.marcado = !!el.checked;
  for (const a of ['aria-label', 'aria-checked', 'aria-pressed', 'aria-expanded', 'aria-selected', 'title', 'placeholder']) {
    if (el.getAttribute(a)) info[a] = recortar(el.getAttribute(a), 120);
  }
  return JSON.stringify(info);
}

function crearNavegador(driver, { baseUrl }) {
  const ui = new UiContext(driver);

  async function elemento(id) {
    const els = await driver.findElements(By.css(`[data-ia-id="${Number(id)}"]`));
    if (!els.length) throw new Error(`No existe el elemento ${id} en la última inspección (los ids cambian: usa inspeccionar).`);
    return els[0];
  }

  /** Espera a que el DOM deje de mutar `quietoMs` seguidos (máx. `maxMs`): cubre el retraso con que la app muestra su loader. */
  async function esperarQuietud(quietoMs = 400, maxMs = 5000) {
    await driver
      .executeAsyncScript(
        `const done = arguments[arguments.length - 1], quieto = arguments[0], max = arguments[1];
         let t = setTimeout(fin, quieto); const tope = setTimeout(fin, max);
         const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(fin, quieto); });
         obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
         function fin() { obs.disconnect(); clearTimeout(t); clearTimeout(tope); done(true); }`,
        quietoMs,
        maxMs
      )
      .catch(() => {});
  }

  async function esperarEstable(ms = 10000) {
    await esperarQuietud();
    await ui.esperarSinLoader(ms).catch(() => {});
    await driver.wait(() => driver.executeScript(sinCargaVisible), ms).catch(() => {});
    await esperarQuietud(250, 2000);
  }

  return {
    async estado() {
      await esperarEstable();
      return driver.executeScript(instantanea, MAX_ELEMENTOS);
    },
    async captura() {
      return driver.takeScreenshot(); // base64 PNG
    },
    /** Textos del elemento `id` (solo lectura, no actúa): sirve para registrar QUÉ se seleccionó realmente. */
    async segmentosDe(id) {
      const el = await elemento(id);
      return driver.executeScript(segmentosDe, el);
    },
    /** Ejecuta UNA acción ya validada. Devuelve un texto breve con lo ocurrido (o lanza). */
    async ejecutar(nombre, a) {
      switch (nombre) {
        case 'inspeccionar':
          return 'Estado actualizado.';
        case 'buscar_texto':
          return driver.executeScript(buscarTexto, a.texto);
        case 'leer_elemento': {
          const el = await elemento(a.id);
          return driver.executeScript(leerElemento, el);
        }
        case 'hacer_click': {
          const el = await elemento(a.id);
          if (await driver.executeScript(estaDeshabilitado, el)) {
            throw new Error(`El elemento ${a.id} está DESHABILITADO en la aplicación: no se puede accionar (esto es un hecho observable que puede ser relevante para el caso).`);
          }
          await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el);
          if (a.doble) await driver.actions().doubleClick(el).perform();
          else await el.click();
          return `${a.doble ? 'Doble click' : 'Click'} en ${a.id}.`;
        }
        case 'escribir': {
          const el = await elemento(a.id);
          await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el);
          await el.click();
          if (a.borrar) await el.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE);
          await el.sendKeys(a.texto);
          if (a.enter) await el.sendKeys(Key.ENTER);
          return `Escrito en ${a.id}.`;
        }
        case 'tecla': {
          await driver.actions().sendKeys(Key[politicas.teclaPermitida(a.tecla)]).perform();
          return `Tecla ${a.tecla}.`;
        }
        case 'seleccionar_opcion': {
          const el = await elemento(a.id);
          const opciones = await el.findElements(By.css('option'));
          for (const o of opciones) {
            if ((await o.getText()).trim().toLowerCase() === a.texto.trim().toLowerCase()) {
              await o.click();
              return `Opción "${a.texto}" elegida.`;
            }
          }
          throw new Error(`No hay una opción "${a.texto}" en el elemento ${a.id} (¿es un select nativo?).`);
        }
        case 'navegar': {
          const url = politicas.urlPermitida(a.destino, baseUrl);
          await driver.get(url);
          return `Navegó a ${url}.`;
        }
        case 'esperar':
          await new Promise((r) => setTimeout(r, a.segundos * 1000));
          return `Esperó ${a.segundos}s.`;
        case 'desplazar': {
          const el = a.id === null ? null : await elemento(a.id);
          const dy = a.direccion === 'abajo' ? 600 : -600;
          await driver.executeScript('(arguments[0] || window).scrollBy(0, arguments[1])', el, dy);
          return `Desplazó ${a.direccion}.`;
        }
        default:
          throw new Error(`herramienta desconocida: ${nombre}`);
      }
    },
  };
}

module.exports = { crearNavegador, DEFINICIONES, instantanea, sinCargaVisible };
