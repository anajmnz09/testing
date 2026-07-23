'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * Execution Context: se REUTILIZA el mismo `data/execution-context.json` del
 * framework, mismo formato. El panel solo lee la sección del caso y (al guardar)
 * hace un merge NO destructivo, igual criterio que `registrarCaso` — no pisa
 * otras secciones ni claves ajenas.
 *
 * Nota de alcance (según docs/panel-de-control-web-arquitectura.md §10): mientras
 * el Input Model formal no exista como código en el framework, el panel renderiza
 * las CLAVES YA PRESENTES en la sección del caso (las que sembró `registrarCaso`),
 * infiriendo el control. Nunca inventa campos.
 */
function archivo(modulo) {
  return path.join(RAIZ, modulo, 'data', 'execution-context.json');
}

function leerTodo(modulo) {
  const p = archivo(modulo);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

function inferirTipo(clave, valor) {
  if (/archivo|file/i.test(clave)) return 'file';
  if (typeof valor === 'boolean') return 'switch';
  if (Array.isArray(valor)) return 'lista';
  return 'texto';
}

/** Sección del caso como Input Model degradado (nombre real + tipo inferido). */
function seccion(modulo, caso) {
  const todo = leerTodo(modulo);
  const s = todo[caso] || {};
  return {
    caso,
    tieneSeccion: caso in todo,
    claves: Object.keys(s).map((k) => ({ nombre: k, valor: s[k], tipo: inferirTipo(k, s[k]) })),
  };
}

/** Merge no destructivo de valores en la sección del caso. */
function guardar(modulo, caso, valores) {
  const p = archivo(modulo);
  const todo = leerTodo(modulo);
  todo[caso] = { ...(todo[caso] || {}), ...(valores || {}) };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(todo, null, 2), 'utf8');
  return seccion(modulo, caso);
}

module.exports = { seccion, guardar };
