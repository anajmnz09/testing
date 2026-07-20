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
 * cuándo se capturó y contra qué ambiente.
 */
function guardar(nombre, data) {
  fs.mkdirSync(METADATA_DIR, { recursive: true });
  const doc = {
    pantalla: nombre,
    capturadoEn: new Date().toISOString(),
    baseUrl: process.env.BASE_URL || null,
    ...data,
  };
  const file = rutaDe(nombre);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
  return file;
}

/** Lista las pantallas ya cacheadas. */
function listar() {
  if (!fs.existsSync(METADATA_DIR)) return [];
  return fs
    .readdirSync(METADATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

module.exports = { METADATA_DIR, rutaDe, slug, existe, leer, guardar, listar };
