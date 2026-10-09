'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const DIR_IA = path.join(RAIZ, 'ia');
const ENTRADAS = path.join(DIR_IA, 'entradas');
const REPORTES = path.join(DIR_IA, 'reports');
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const ID_PDF = /^[0-9]{8}-[0-9]{6}-[A-Za-z0-9_-]{1,60}\.pdf$/;
const ID_CORRIDA = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

/**
 * Casos de Uso IA en el anfitrión: SOLO guarda el PDF subido, resuelve el comando del runner (`ia/run-caso-ia.js`,
 * lanzado por el mismo `lanzador` que los tests) y lee los resultados que el runner dejó en `ia/reports/`.
 * No habla con el modelo ni con Selenium, y NUNCA devuelve la API key (solo si está configurada o no).
 */

function nombreSeguro(nombre) {
  const base = path.basename(String(nombre || 'caso')).replace(/\.pdf$/i, '');
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'caso';
}

function sello(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Guarda el PDF (base64) en ia/entradas/ y devuelve su id. Valida tamaño y firma %PDF-. */
function guardarPdf({ nombre, base64 }) {
  if (typeof base64 !== 'string' || !base64) return { ok: false, motivo: 'pdf-vacio' };
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length) return { ok: false, motivo: 'pdf-vacio' };
  if (buf.length > MAX_PDF_BYTES) return { ok: false, motivo: 'pdf-muy-grande' };
  if (buf.slice(0, 5).toString('latin1') !== '%PDF-') return { ok: false, motivo: 'no-es-pdf' };
  fs.mkdirSync(ENTRADAS, { recursive: true });
  const archivo = `${sello()}-${nombreSeguro(nombre)}.pdf`;
  fs.writeFileSync(path.join(ENTRADAS, archivo), buf);
  return { ok: true, archivo, bytes: buf.length };
}

/** Comando del runner para un PDF ya subido (el id se valida: no hay rutas libres hacia el shell). */
function resolverComando(archivo) {
  if (!ID_PDF.test(String(archivo))) throw new Error('PDF inválido');
  const ruta = path.join(ENTRADAS, archivo);
  if (!fs.existsSync(ruta)) throw new Error('el PDF no existe (súbelo de nuevo)');
  return { cwd: '.', comando: `node ia/run-caso-ia.js "ia/entradas/${archivo}"` };
}

/** ¿Hay API key en el entorno del servidor? (solo el booleano, jamás el valor). Lee el mismo origen que el runner. */
function configurada() {
  if (process.env.OPENAI_API_KEY) return true;
  for (const f of [path.join(DIR_IA, '.env'), path.join(RAIZ, '.env')]) {
    try {
      if (/^\s*OPENAI_API_KEY\s*=\s*\S+/m.test(fs.readFileSync(f, 'utf8'))) return true;
    } catch (e) {
      /* sin archivo */
    }
  }
  return false;
}

function leerJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

/** Corridas de IA, la más nueva primero. */
function corridas() {
  let ids = [];
  try {
    ids = fs.readdirSync(REPORTES, { withFileTypes: true }).filter((d) => d.isDirectory() && ID_CORRIDA.test(d.name)).map((d) => d.name);
  } catch (e) {
    /* aún no hay corridas */
  }
  return ids
    .sort()
    .reverse()
    .map((runId) => {
      const r = leerJson(path.join(REPORTES, runId, 'resultado.json'));
      return { runId, estado: r ? r.estado : 'RUNNING', pdf: r && r.pdf ? r.pdf.nombre : null, fecha: runId.replace(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/, '$3/$2/$1 $4:$5:$6') };
    });
}

/** Resultado de una corrida + URLs de su evidencia (se sirven por /artefacto/ia/<runId>/…). */
function detalle(runId) {
  if (!ID_CORRIDA.test(String(runId))) return null;
  const dir = path.join(REPORTES, runId);
  if (!fs.existsSync(dir)) return null;
  const url = (rel) => `/artefacto/ia/${encodeURIComponent(runId)}/${rel}`;
  const resultado = leerJson(path.join(dir, 'resultado.json'));
  const acciones = leerJson(path.join(dir, 'acciones.json')) || [];
  if (!resultado) return { runId, estado: 'RUNNING', capturas: [], accionesLista: [] };
  return {
    ...resultado,
    capturas: (resultado.capturas || []).map((c) => ({ label: c.etiqueta, url: url(`screenshots/${c.archivo}`), esFallo: false })),
    accionesLista: acciones,
    pdfUrl: url('entrada.pdf'),
    logUrl: fs.existsSync(path.join(dir, 'logs', 'execution.log')) ? url('logs/execution.log') : null,
  };
}

module.exports = { guardarPdf, resolverComando, configurada, corridas, detalle, MAX_PDF_BYTES };
