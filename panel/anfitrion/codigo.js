'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * Lectura del código fuente de un test (para "ver el código", solo lectura).
 * Guardas: solo archivos *.test.js dentro de una carpeta tests/ del repo, sin
 * traversal fuera de la raíz.
 */
function leer(rutaRel) {
  if (!rutaRel) return null;
  const p = path.resolve(RAIZ, rutaRel);
  if (p !== RAIZ && !p.startsWith(RAIZ + path.sep)) return null;
  if (!/\.test\.js$/.test(p) || !p.split(path.sep).includes('tests')) return null;
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
  return fs.readFileSync(p, 'utf8');
}

module.exports = { leer };
