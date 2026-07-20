const addContext = require('mochawesome/addContext');
const evidence = require('./evidence');
const logger = require('./logger');

/**
 * Registro estructurado de bloqueos/errores durante una prueba. El objetivo es
 * que un fallo quede documentado con SUFICIENTE información para reproducirlo
 * después, no solo con la excepción. Aplica a cualquier pantalla del sistema.
 *
 * Se captura: caso, pantalla, acción, campo, valor, mensaje de la app, URL,
 * timestamp y stack trace de Selenium. Se adjunta como evidencia (JSON +
 * screenshot) y al reporte de Mochawesome.
 */

async function _safe(fn, def) {
  try { return await fn(); } catch (e) { return def; }
}

/** Arma el registro estructurado leyendo el estado actual de la app. */
async function construirRegistro(driver, { caso, accion, campo, valor, error } = {}) {
  const url = driver ? await _safe(() => driver.getCurrentUrl(), 'N/D') : 'N/D';

  const mensajeApp = driver
    ? await _safe(
        () =>
          driver.executeScript(() => {
            const n = document.querySelector('[class*="notify_record"]');
            return n ? (n.textContent || '').trim() : '';
          }),
        ''
      )
    : '';

  const pantalla = driver
    ? await _safe(
        () =>
          driver.executeScript(() => {
            const el = document.querySelector('[class*="breadcrumb" i], .dx-toolbar-label, h1, .navItemLink.active');
            const t = el ? el.textContent.trim() : document.title || '';
            return t.slice(0, 120);
          }),
        'N/D'
      )
    : 'N/D';

  return {
    caso: caso || 'N/D',
    pantalla: pantalla || 'N/D',
    accion: accion || 'N/D',
    campo: campo != null ? campo : null,
    valor: valor != null ? valor : null,
    mensajeApp: mensajeApp || null,
    url,
    timestamp: new Date().toISOString(),
    stackSelenium: error ? String((error && (error.stack || error.message)) || error) : null,
  };
}

/**
 * Construye el registro, lo loguea, y lo adjunta como evidencia (screenshot +
 * JSON) y al reporte. `context` es el `this` de Mocha (del hook o del it()).
 */
async function registrarBloqueo(context, driver, info = {}) {
  const reg = await construirRegistro(driver, info);

  logger.error(
    `BLOQUEO [${reg.caso}] pantalla="${reg.pantalla}" acción="${reg.accion}" ` +
      `campo="${reg.campo}" valor="${reg.valor}" mensajeApp="${reg.mensajeApp}" url=${reg.url}`
  );

  if (driver) {
    try { await evidence.attachScreenshot(driver, context, { label: `Bloqueo: ${reg.accion}` }); } catch (e) { /* la app puede estar rota */ }
  }
  try { await evidence.saveEvidenceBuffer('json', context, JSON.stringify(reg, null, 2), { label: 'bloqueo', encoding: 'utf8' }); } catch (e) { /* ignore */ }
  try { addContext(context, { title: 'Registro de bloqueo (para reproducir)', value: JSON.stringify(reg, null, 2) }); } catch (e) { /* ignore */ }

  return reg;
}

module.exports = { construirRegistro, registrarBloqueo };
