const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./logger');

/**
 * Resolución de ARCHIVOS de prueba para cargas (uploads).
 *
 * Misma filosofía que el Execution Context: si el usuario indica un archivo, se
 * usa ese; si no, el framework provee uno por defecto automáticamente. Así los
 * tests nunca hardcodean rutas y, a la vez, el usuario puede dirigir la carga a
 * un archivo real cuando lo necesite (ver Execution Context del caso).
 *
 * El archivo por defecto se GENERA en una carpeta temporal del SO (no se versiona
 * ni ensucia el repo) y es válido para el `accept` de la app
 * (`.jpg,.jpeg,.png,.pdf,.txt,.docx`). Es determinista dentro de una corrida.
 */

const DIR_FIXTURES = path.join(os.tmpdir(), 'triple-fixtures');

// PNG 1x1 transparente (válido) por si se prefiere un archivo de imagen.
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const GENERADORES = {
  txt: {
    ext: 'txt',
    escribir: (ruta) =>
      fs.writeFileSync(
        ruta,
        'Documento de prueba generado por el framework de automatización Triple.\n' +
          'Uso: carga de archivos en pruebas E2E. No contiene datos reales.\n',
        'utf8'
      ),
  },
  png: {
    ext: 'png',
    escribir: (ruta) => fs.writeFileSync(ruta, Buffer.from(PNG_1x1_BASE64, 'base64')),
  },
};

/** Extensiones que el framework sabe generar por defecto. */
function tiposSoportados() {
  return Object.keys(GENERADORES);
}

/** Normaliza un texto para usarlo como nombre de archivo (sin acentos ni símbolos). */
function _slug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Devuelve la ruta ABSOLUTA de un archivo por defecto del tipo indicado,
 * generándolo si aún no existe. Reutilizable por cualquier caso de carga.
 *
 * @param {string} [tipo]  'txt' (por defecto) o 'png'
 * @param {object} [opts]
 * @param {string} [opts.base]  nombre base del archivo (sin extensión). Permite
 *        generar archivos DISTINTOS por caso/clasificación —p. ej. uno por tipo
 *        de documento— para que la validación posterior sea inequívoca.
 */
function archivoPorDefecto(tipo = 'txt', { base = 'documento-qa' } = {}) {
  const gen = GENERADORES[tipo];
  if (!gen) {
    throw new Error(
      `testFiles: tipo de archivo por defecto no soportado: "${tipo}". Soportados: ${tiposSoportados().join(', ')}`
    );
  }
  fs.mkdirSync(DIR_FIXTURES, { recursive: true });
  const ruta = path.join(DIR_FIXTURES, `${_slug(base) || 'documento-qa'}.${gen.ext}`);
  if (!fs.existsSync(ruta)) {
    gen.escribir(ruta);
    logger.info(`testFiles: archivo por defecto generado en ${ruta}`);
  }
  return ruta;
}

/**
 * Resuelve qué archivo usar para una carga.
 *
 *  - Si se indica `ruta` (ej. desde el Execution Context) y el archivo EXISTE,
 *    se usa esa (absoluta).
 *  - Si se indica `ruta` pero NO existe, se FALLA explícito: el usuario pidió un
 *    archivo concreto y no se puede honrar; sustituirlo en silencio sería un
 *    falso verde.
 *  - Si no se indica `ruta`, se usa el archivo por defecto del `tipo`.
 *
 * @param {object} [opts]
 * @param {string} [opts.ruta]  ruta indicada por el usuario (relativa o absoluta)
 * @param {string} [opts.tipo]  tipo del archivo por defecto si no hay `ruta`
 * @param {string} [opts.base]  nombre base del archivo por defecto (ver archivoPorDefecto)
 * @returns {{ruta:string, nombre:string, porDefecto:boolean}}
 */
function resolver({ ruta, tipo = 'txt', base } = {}) {
  if (ruta !== undefined && ruta !== null && String(ruta).trim() !== '') {
    const abs = path.resolve(String(ruta));
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error(
        `testFiles: el archivo indicado no existe: "${abs}" (proveniente de "${ruta}"). ` +
          `Corregí la ruta en el Execution Context o dejala vacía para usar el archivo por defecto.`
      );
    }
    logger.info(`testFiles: usando archivo indicado -> ${abs}`);
    return { ruta: abs, nombre: path.basename(abs), porDefecto: false };
  }
  const abs = archivoPorDefecto(tipo, { base });
  return { ruta: abs, nombre: path.basename(abs), porDefecto: true };
}

module.exports = { resolver, archivoPorDefecto, tiposSoportados, DIR_FIXTURES };
