const fs = require('fs');
const path = require('path');

/**
 * Caché PERSISTENTE de metadata de pantallas.
 *
 * Objetivo: inspeccionar una pantalla UNA sola vez y reutilizar esa información
 * en futuras automatizaciones, sin volver a explorar el sistema. Sirve para
 * CUALQUIER pantalla (no es específico de ningún módulo).
 *
 * Dónde vive: `<proyecto>/metadata/screens/<pantalla>.json`.
 * IMPORTANTE: NO se guarda bajo `reports/` a propósito — esa carpeta se poda
 * según KEEP_REPORTS y la metadata se perdería. Esta caché es permanente y
 * versionable en git.
 *
 * Uso típico:
 *   if (!screenMetadata.existe('requisiciones-detalle')) {
 *     const data = await screenInspector.inspeccionar(driver);
 *     screenMetadata.guardar('requisiciones-detalle', data);
 *   }
 *   const meta = screenMetadata.leer('requisiciones-detalle');
 *
 * AUTOGESTIÓN: cada archivo lleva un SELLO del inspector que lo generó
 * (`inspector: { version, firma }`). Si el inspector cambia, el sello deja de
 * coincidir y la metadata se regenera sola en la próxima corrida que pase por
 * esa pantalla — nunca hay que borrar JSONs a mano. Mientras el sello coincida
 * NO se re-inspecciona nada (el objetivo de la caché se mantiene intacto).
 *
 * Este módulo NO conoce al inspector (sería una dependencia circular): recibe el
 * sello como dato y solo lo compara.
 */

const PROJECT_DIR = process.env.REPORTS_ROOT || process.cwd();
const METADATA_DIR = path.join(PROJECT_DIR, 'metadata', 'screens');

function slug(nombre) {
  return String(nombre)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rutaDe(nombre) {
  return path.join(METADATA_DIR, `${slug(nombre)}.json`);
}

/** True si la pantalla ya fue inspeccionada y cacheada. */
function existe(nombre) {
  return fs.existsSync(rutaDe(nombre));
}

/** Devuelve la metadata cacheada de la pantalla, o null si no existe. */
function leer(nombre) {
  const file = rutaDe(nombre);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Guarda (o actualiza) la metadata de una pantalla. Agrega trazabilidad:
 * cuándo se capturó, contra qué ambiente y con qué versión del inspector.
 *
 * @param {object} [sello] `{ version, firma }` del inspector que generó `data`.
 *        Se persiste para poder detectar después si quedó desactualizada.
 */
function guardar(nombre, data, sello) {
  fs.mkdirSync(METADATA_DIR, { recursive: true });
  const doc = {
    pantalla: nombre,
    capturadoEn: new Date().toISOString(),
    baseUrl: process.env.BASE_URL || null,
    ...(sello ? { inspector: { version: sello.version, firma: sello.firma } } : {}),
    ...data,
  };
  const file = rutaDe(nombre);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
  return file;
}

/**
 * ¿La metadata cacheada sigue siendo válida para el `sello` actual del inspector?
 *
 * Se considera DESACTUALIZADA cuando:
 *  - no existe el archivo;
 *  - está corrupto (JSON ilegible);
 *  - no tiene sello (la generó una versión anterior del framework);
 *  - la versión o la firma del inspector cambiaron.
 *
 * Devuelve también el `motivo`, que se loguea para que quede claro en el reporte
 * por qué se volvió a inspeccionar una pantalla.
 *
 * @returns {{valida:boolean, motivo:string, sello:object|null}}
 */
function esValida(nombre, sello = {}) {
  const file = rutaDe(nombre);
  if (!fs.existsSync(file)) return { valida: false, motivo: 'no-existe', sello: null };

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { valida: false, motivo: 'json-corrupto', sello: null };
  }

  const previo = doc.inspector || null;
  if (!previo) return { valida: false, motivo: 'sin-sello-de-inspector', sello: null };
  if (previo.version !== sello.version) {
    return { valida: false, motivo: `version-distinta (${previo.version} -> ${sello.version})`, sello: previo };
  }
  if (previo.firma !== sello.firma) {
    return { valida: false, motivo: 'firma-distinta (cambió el inspector)', sello: previo };
  }
  return { valida: true, motivo: 'vigente', sello: previo };
}

/** Lista las pantallas ya cacheadas. */
function listar() {
  if (!fs.existsSync(METADATA_DIR)) return [];
  return fs
    .readdirSync(METADATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

module.exports = { METADATA_DIR, rutaDe, slug, existe, esValida, leer, guardar, listar };
