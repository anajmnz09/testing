const logger = require('./logger');
const screenMetadata = require('./screenMetadata');

/**
 * Inspector GENÉRICO de pantallas. Toma una "radiografía" del DOM de cualquier
 * pantalla del sistema y devuelve un objeto serializable con todo lo que sirve
 * para automatizarla después: controles (por tipo), labels, requeridos, ids,
 * names, data-testid, botones, grids, headers, switches, validaciones visibles.
 *
 * Está pensado para ejecutarse UNA vez por pantalla y persistirse con
 * utils/screenMetadata.js, de modo que futuras automatizaciones lean el JSON en
 * lugar de volver a explorar el sistema.
 *
 * Todo el barrido corre en el browser (executeScript) en una sola llamada: es
 * rápido y evita decenas de round-trips de Selenium.
 */

/* eslint-disable no-undef */
function _snapshotEnBrowser() {
  const txt = (el) => (el && (el.textContent || '').trim()) || '';
  const attr = (el, a) => (el && el.getAttribute ? el.getAttribute(a) : null) || null;

  // Tipos DevExtreme, del más específico al más genérico (un selectbox también
  // contiene un dx-textbox por dentro, por eso el orden importa).
  const TIPOS = [
    ['dx-tagbox', 'tagbox'],
    ['dx-lookup', 'lookup'],
    ['dx-selectbox', 'selectbox'],
    ['dx-datebox', 'datebox'],
    ['dx-numberbox', 'numberbox'],
    ['dx-textarea', 'textarea'],
    ['dx-switch', 'switch'],
    ['dx-checkbox', 'checkbox'],
    ['dx-radiogroup', 'radiogroup'],
    ['dx-textbox', 'textbox'],
  ];

  function tipoDe(cont) {
    for (const [cls, tipo] of TIPOS) {
      if (cont.querySelector('.' + cls) || (cont.className || '').includes(cls)) return tipo;
    }
    return 'desconocido';
  }

  function editorDe(cont) {
    return cont.querySelector('.dx-texteditor-input, input, textarea');
  }

  // --- Controles con label (patrón group-field de la app + dx-form estándar) ---
  const contenedores = document.querySelectorAll(
    '[class*="group-field"], .dx-field, .dx-form-item, .dx-field-item'
  );
  const controles = [];
  contenedores.forEach((cont) => {
    const labelEl = cont.querySelector('label');
    const label = txt(labelEl).replace(/\s*\*\s*$/, '').trim();
    if (!label) return;
    // requerido = asterisco rojo dentro del label (o marca estándar de dx-form)
    const requerido =
      !!cont.querySelector('.dx-field-item-required-mark') ||
      Array.from(cont.querySelectorAll('label span')).some((s) => txt(s) === '*');
    const editor = editorDe(cont);
    const sw = cont.querySelector('.dx-switch');
    const chk = cont.querySelector('.dx-checkbox');
    controles.push({
      label,
      tipo: tipoDe(cont),
      requerido,
      id: attr(editor, 'id'),
      name: attr(editor, 'name'),
      dataTestId: attr(editor, 'data-testid') || attr(cont, 'data-testid'),
      placeholder: attr(editor, 'placeholder'),
      valor: editor ? editor.value || null : null,
      deshabilitado:
        (cont.className || '').includes('dx-state-disabled') ||
        !!(editor && editor.disabled) ||
        !!cont.querySelector('.dx-state-disabled'),
      estadoSwitch: sw ? attr(sw, 'aria-pressed') : null,
      estadoCheckbox: chk ? attr(chk, 'aria-checked') : null,
      claseContenedor: cont.className || null,
    });
  });

  // --- Headers de formulario (ej. "forms-header requisicion-header") ---
  const headers = [];
  document.querySelectorAll('[class*="header"]').forEach((h) => {
    const cls = h.className || '';
    if (typeof cls !== 'string' || !cls.trim()) return;
    // solo headers de formulario/pantalla, no headers internos del grid
    if (cls.includes('dx-datagrid') || cls.includes('dx-header-row')) return;
    const switches = Array.from(h.querySelectorAll('.dx-switch')).map((s) => ({
      ariaPressed: attr(s, 'aria-pressed'),
      clase: s.className || null,
      id: attr(s, 'id'),
    }));
    const labels = Array.from(h.querySelectorAll('label, span')).map((l) => txt(l)).filter(Boolean);
    if (!switches.length && !labels.length) return;
    headers.push({
      clase: cls,
      texto: txt(h).slice(0, 200),
      labels: labels.slice(0, 25),
      switches,
      botones: Array.from(h.querySelectorAll('.dx-button')).map((b) => txt(b)).filter(Boolean),
    });
  });

  // --- Switches y checkboxes en cualquier parte (incluye los que no están en group-field) ---
  const switchesSueltos = Array.from(document.querySelectorAll('.dx-switch')).map((s) => {
    // buscar el label más cercano hacia arriba/al lado
    let cont = s.closest('[class*="group-field"], [class*="header"], .dx-field, div');
    let etiqueta = '';
    for (let i = 0; i < 4 && cont && !etiqueta; i++) {
      const l = cont.querySelector('label');
      etiqueta = txt(l);
      cont = cont.parentElement;
    }
    return {
      etiqueta: etiqueta || null,
      ariaPressed: attr(s, 'aria-pressed'),
      clase: s.className || null,
      contenedor: s.parentElement ? s.parentElement.className || null : null,
    };
  });

  // --- Botones ---
  const botones = Array.from(document.querySelectorAll('.dx-button, button')).map((b) => ({
    texto: txt(b),
    id: attr(b, 'id'),
    dataTestId: attr(b, 'data-testid'),
    deshabilitado: (b.className || '').includes('dx-state-disabled') || !!b.disabled,
    clase: (b.className || '').slice(0, 120),
  })).filter((b) => b.texto || b.id);

  // --- Grids ---
  const grids = Array.from(document.querySelectorAll('.dx-datagrid')).map((g) => {
    const columnas = Array.from(g.querySelectorAll('.dx-header-row td, .dx-header-row th'))
      .map((c) => txt(c))
      .filter(Boolean);
    const filas = g.querySelectorAll('.dx-data-row');
    const primeraFila = filas.length
      ? Array.from(filas[0].querySelectorAll('td')).map((c) => txt(c))
      : [];
    return {
      columnas,
      cantidadFilasVisibles: filas.length,
      ejemploPrimeraFila: primeraFila,
      info: txt(g.querySelector('.dx-info')) || null,
    };
  });

  // --- Elementos con identificadores útiles ---
  const identificadores = Array.from(document.querySelectorAll('[id], [data-testid], [name]'))
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      id: attr(el, 'id'),
      dataTestId: attr(el, 'data-testid'),
      name: attr(el, 'name'),
      texto: txt(el).slice(0, 60),
    }))
    .filter((e) => e.id || e.dataTestId || e.name)
    .slice(0, 120);

  // --- Navegación del módulo (navItemLink / navbar) ---
  const navegacion = Array.from(document.querySelectorAll('[class*="navItemLink"], [class*="NavBar"] a, [id*="avBar"] a'))
    .map((a) => ({ texto: txt(a), clase: a.className || null, id: attr(a, 'id'), href: attr(a, 'href') }))
    .filter((a) => a.texto);

  // --- Validaciones / mensajes visibles en este momento ---
  const invalidos = Array.from(document.querySelectorAll('.dx-invalid')).map((el) => {
    const cont = el.closest('[class*="group-field"], .dx-field');
    return txt(cont && cont.querySelector('label')) || null;
  }).filter(Boolean);
  const notifyEl = document.querySelector('[class*="notify_record"]');

  return {
    url: location.href,
    titulo: document.title,
    controles,
    headers,
    switchesSueltos,
    botones,
    grids,
    identificadores,
    navegacion,
    validaciones: { camposInvalidos: invalidos, notifyVisible: notifyEl ? txt(notifyEl) : null },
  };
}
/* eslint-enable no-undef */

/**
 * Toma la radiografía de la pantalla actual.
 * @returns {Promise<object>} metadata serializable
 */
async function inspeccionar(driver) {
  return driver.executeScript(_snapshotEnBrowser);
}

/**
 * Inspecciona la pantalla actual y la persiste en la caché de metadata.
 * Si ya existe y no se fuerza, NO vuelve a inspeccionar (ese es el punto: no
 * re-explorar pantallas ya conocidas).
 * @returns {Promise<{nombre:string, ruta:string|null, data:object, desdeCache:boolean}>}
 */
async function inspeccionarYGuardar(driver, nombre, { forzar = false, extra = {} } = {}) {
  if (!forzar && screenMetadata.existe(nombre)) {
    logger.info(`screenInspector: "${nombre}" ya estaba en caché, no se re-inspecciona`);
    return { nombre, ruta: screenMetadata.rutaDe(nombre), data: screenMetadata.leer(nombre), desdeCache: true };
  }
  logger.info(`screenInspector: inspeccionando pantalla "${nombre}"`);
  const data = await inspeccionar(driver);
  const ruta = screenMetadata.guardar(nombre, { ...data, ...extra });
  logger.info(`screenInspector: metadata de "${nombre}" guardada en ${ruta}`);
  return { nombre, ruta, data, desdeCache: false };
}

module.exports = { inspeccionar, inspeccionarYGuardar };
