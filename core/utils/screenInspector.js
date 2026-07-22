const crypto = require('crypto');
const logger = require('./logger');
const screenMetadata = require('./screenMetadata');

/**
 * VERSIÓN del inspector. Se sube a mano cuando cambia el SIGNIFICADO de la
 * metadata (campos nuevos que los tests van a consultar, criterios distintos…).
 * Sirve como etiqueta legible en el JSON y para invalidar caches a propósito.
 */
const VERSION = 2;

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

  // Nombre ACCESIBLE de un control: lo que describe la acción cuando no hay
  // texto visible (botones solo ícono). Nunca incluye el `src` base64.
  const nombreAccesible = (b) => {
    const img = b.querySelector ? b.querySelector('img') : null;
    return (
      [attr(b, 'title'), attr(b, 'aria-label'), attr(b, 'alt'),
        img ? attr(img, 'title') : null, img ? attr(img, 'alt') : null,
        img ? attr(img, 'aria-label') : null]
        .filter(Boolean)
        .join(' | ') || null
    );
  };

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
      // `botones` (arriba) solo lista los que tienen TEXTO — se mantiene tal cual
      // por compatibilidad. `acciones` agrega los solo-ícono con su nombre
      // accesible, que son los que hacen falta para automatizar el header.
      acciones: Array.from(h.querySelectorAll('.dx-button, button, [role="button"]')).map((b) => ({
        nombre: txt(b) || nombreAccesible(b),
        soloIcono: !txt(b) && !!(b.querySelector && b.querySelector('img, svg, i')),
        deshabilitado: (b.className || '').includes('dx-state-disabled') || !!b.disabled,
      })),
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
  // Se capturan también los botones SOLO ÍCONO (sin texto ni id): son muy
  // comunes en los headers de la app (Pausar, Editar…) y antes se descartaban,
  // de modo que la metadata cacheada no servía para localizarlos. Se guarda su
  // NOMBRE ACCESIBLE (title/aria-label/alt del ícono) — nunca el `src` base64,
  // que es enorme y no describe la acción; de él solo se registra si existe.
  const botones = Array.from(document.querySelectorAll('.dx-button, button, [role="button"]')).map((b) => {
    const img = b.querySelector('img');
    return {
      texto: txt(b),
      id: attr(b, 'id'),
      dataTestId: attr(b, 'data-testid'),
      nombreAccesible: nombreAccesible(b),
      soloIcono: !txt(b) && !!b.querySelector('img, svg, i'),
      iconoEmbebido: !!(img && /^data:image\//.test(img.getAttribute('src') || '')),
      deshabilitado: (b.className || '').includes('dx-state-disabled') || !!b.disabled,
      clase: (b.className || '').slice(0, 120),
    };
  }).filter((b) => b.texto || b.id || b.nombreAccesible || b.soloIcono);

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
 * FIRMA automática del inspector: hash del código que corre en el browser.
 *
 * Es el mecanismo que hace la metadata AUTOGESTIONADA: cualquier cambio en
 * `_snapshotEnBrowser` (aunque sea un campo nuevo y nadie se acuerde de subir
 * `VERSION`) produce una firma distinta, y la caché se regenera sola la próxima
 * vez que un test pase por esa pantalla. Si nada cambió, la firma es idéntica y
 * NO se re-inspecciona nada.
 */
function firma() {
  return crypto
    .createHash('sha1')
    .update(_snapshotEnBrowser.toString())
    .digest('hex')
    .slice(0, 12);
}

/** Sello que identifica al inspector actual (se persiste en cada JSON). */
function sello() {
  return { version: VERSION, firma: firma() };
}

/**
 * Toma la radiografía de la pantalla actual.
 * @returns {Promise<object>} metadata serializable
 */
async function inspeccionar(driver) {
  return driver.executeScript(_snapshotEnBrowser);
}

/**
 * Inspecciona la pantalla actual y la persiste en la caché de metadata.
 *
 * METADATA AUTOGESTIONADA: si ya existe una caché GENERADA POR ESTE MISMO
 * inspector (mismo sello), no se re-inspecciona nada. Si la caché quedó
 * desactualizada respecto del inspector actual —o falta, o está corrupta— se
 * regenera sola y se loguea el motivo. Nunca hace falta borrar JSONs a mano.
 *
 * @param {boolean} [opts.forzar] re-inspecciona aunque la caché esté vigente.
 * @returns {Promise<{nombre:string, ruta:string|null, data:object, desdeCache:boolean, motivo:string}>}
 */
async function inspeccionarYGuardar(driver, nombre, { forzar = false, extra = {} } = {}) {
  const selloActual = sello();
  const estado = screenMetadata.esValida(nombre, selloActual);

  if (!forzar && estado.valida) {
    logger.info(`screenInspector: "${nombre}" ya estaba en caché y sigue vigente, no se re-inspecciona`);
    return {
      nombre,
      ruta: screenMetadata.rutaDe(nombre),
      data: screenMetadata.leer(nombre),
      desdeCache: true,
      motivo: estado.motivo,
    };
  }

  const motivo = forzar ? 'forzado' : estado.motivo;
  logger.info(`screenInspector: inspeccionando pantalla "${nombre}" (motivo: ${motivo})`);
  const data = await inspeccionar(driver);
  const ruta = screenMetadata.guardar(nombre, { ...data, ...extra }, selloActual);
  logger.info(
    `screenInspector: metadata de "${nombre}" guardada en ${ruta} (inspector v${selloActual.version}/${selloActual.firma})`
  );
  return { nombre, ruta, data, desdeCache: false, motivo };
}

module.exports = { VERSION, firma, sello, inspeccionar, inspeccionarYGuardar };
