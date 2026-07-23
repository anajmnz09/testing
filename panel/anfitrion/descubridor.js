'use strict';

const fs = require('fs');
const path = require('path');
const reportes = require('./reportes');

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * Descubrimiento automático. Ninguna lista manual de tests: se escanea el
 * filesystem siguiendo la convención del framework:
 *   - módulo = workspace del package.json raíz que tenga tests/ con *.test.js
 *   - caso   = cada archivo *.test.js (su nombre = nombre descriptivo del caso)
 * Si mañana aparece un archivo nuevo en tests/, aparece solo (se re-escanea en
 * cada pedido del árbol).
 */
function workspaces() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).workspaces || [];
  } catch (e) {
    return [];
  }
}

function archivosTest(modulo) {
  const base = path.join(RAIZ, modulo, 'tests');
  const out = [];
  const walk = (d) => {
    for (const e of listar(d)) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.test.js')) {
        out.push(path.relative(path.join(RAIZ, modulo), p).split(path.sep).join('/'));
      }
    }
  };
  walk(base);
  return out.sort();
}

function listar(d) {
  try {
    return fs.readdirSync(d, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

function modulos() {
  return workspaces()
    .map((w) => w.replace(/\/+$/, ''))
    .filter((w) => fs.existsSync(path.join(RAIZ, w, 'tests')) && archivosTest(w).length > 0);
}

/** Árbol Módulo → (Suite) → Caso, con el descriptor `run` de cada nodo. */
function arbol() {
  return { modulos: modulos().map(nodoModulo) };
}

function nodoModulo(modulo) {
  const estados = reportes.estadosPorCaso(modulo);
  const casos = archivosTest(modulo).map((rel) => {
    const nombre = path.basename(rel).replace(/\.test\.js$/, '');
    return {
      id: nombre,
      nombre,
      tipo: 'caso',
      modulo,
      ruta: `${modulo}/${rel}`,
      run: { tipo: 'caso', modulo, target: rel },
      estado: (estados[nombre] || {}).estado || 'sin-ejecutar',
    };
  });

  // Agrupación DERIVADA por primer segmento del nombre (solo comodidad visual):
  // si ≥2 casos comparten prefijo, se agrupan en una "suite"; los demás quedan
  // sueltos. No es registro manual: se deriva del nombre.
  const grupos = {};
  for (const c of casos) {
    const seg = c.nombre.split('-')[0];
    (grupos[seg] = grupos[seg] || []).push(c);
  }
  const hijos = [];
  for (const c of casos) {
    const seg = c.nombre.split('-')[0];
    if (grupos[seg].length >= 2) continue; // va dentro de su suite
    hijos.push(c);
  }
  for (const seg of Object.keys(grupos)) {
    if (grupos[seg].length < 2) continue;
    hijos.push({
      id: `${modulo}/${seg}`,
      nombre: seg,
      tipo: 'suite',
      modulo,
      run: { tipo: 'carpeta', modulo, target: `tests/${seg}-*.test.js` },
      hijos: grupos[seg],
    });
  }
  hijos.sort((a, b) => (a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === 'suite' ? -1 : 1));

  return {
    id: modulo,
    nombre: modulo.charAt(0).toUpperCase() + modulo.slice(1),
    tipo: 'modulo',
    modulo,
    run: { tipo: 'modulo', modulo },
    hijos,
  };
}

module.exports = { arbol, modulos, archivosTest, RAIZ };
