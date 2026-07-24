'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * Lectura del sistema de reportes que el framework YA genera. El panel es un
 * viewer: nunca escribe acá. Los nombres de carpeta son el CONTRATO público del
 * framework (una única fuente de verdad local); no se duplica lógica, se lee.
 */
const D = {
  reports: 'reports',
  latest: 'latest',
  html: 'html',
  json: 'json',
  results: 'results.json',
  screenshots: 'screenshots',
  evidence: 'evidence',
  logs: 'logs',
  log: 'execution.log',
};

function repDir(modulo) {
  return path.join(RAIZ, modulo, D.reports);
}

/** RUN_IDs de un módulo, más nuevo primero (el timestamp ordena solo). */
function corridas(modulo) {
  const dir = repDir(modulo);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== D.latest)
    .map((e) => e.name)
    .sort()
    .reverse();
}

function leerResultados(modulo, runId) {
  const p = path.join(repDir(modulo), runId, D.json, D.results);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

/** Aplana los tests de un reporte Mochawesome (suites anidadas). */
function walkTests(rj) {
  const out = [];
  const rec = (s) => {
    (s.tests || []).forEach((t) => out.push(t));
    (s.suites || []).forEach(rec);
  };
  ((rj && rj.results) || []).forEach(rec);
  return out;
}

function estadoDe(t) {
  return t.state || (t.pass ? 'passed' : t.fail ? 'failed' : 'pending');
}

/** Deriva el nombre de caso desde el título del test (it(`${CASO}: …`)). */
function casoDeTest(t) {
  const m = (t.title || '').match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\s*:/);
  if (m) return m[1];
  const m2 = (t.fullTitle || '').match(/([a-z0-9]+(?:-[a-z0-9]+)+)/);
  return m2 ? m2[1] : null;
}

/** Mapa caso → último estado conocido, recorriendo corridas nuevo→viejo. */
function estadosPorCaso(modulo) {
  const map = {};
  for (const runId of corridas(modulo)) {
    const rj = leerResultados(modulo, runId);
    if (!rj) continue;
    for (const t of walkTests(rj)) {
      const caso = casoDeTest(t);
      if (!caso || map[caso]) continue;
      map[caso] = { estado: estadoDe(t), runId, duracion: t.duration || 0 };
    }
  }
  return map;
}

/** Última ejecución de un caso: la corrida más reciente que lo contenga. */
function ultimaDeCaso(modulo, caso) {
  for (const runId of corridas(modulo)) {
    const rj = leerResultados(modulo, runId);
    if (!rj) continue;
    const t = walkTests(rj).find((x) => casoDeTest(x) === caso || (x.title || '').includes(caso));
    if (t) return detalleTest(modulo, runId, caso, t);
  }
  return null;
}

function detalleTest(modulo, runId, caso, t) {
  return {
    runId,
    fecha: fechaLegible(runId),
    estado: estadoDe(t),
    duracion: t.duration || 0,
    error: t.err && t.err.message ? { mensaje: t.err.message, stack: t.err.estack || '' } : null,
    screenshots: artefactosCaso(modulo, runId, caso, D.screenshots, ['.png', '.jpg', '.jpeg']),
    evidencias: evidenciasCaso(modulo, runId, caso),
    log: fs.existsSync(path.join(repDir(modulo), runId, D.logs, D.log))
      ? { url: urlArtefacto(modulo, runId, `${D.logs}/${D.log}`) }
      : null,
  };
}

function listarDir(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

function artefactosCaso(modulo, runId, caso, sub, exts) {
  const base = path.join(repDir(modulo), runId, sub);
  const out = [];
  for (const folder of listarDir(base)) {
    if (!folder.isDirectory() || !folder.name.includes(caso)) continue;
    for (const f of listarDir(path.join(base, folder.name))) {
      if (f.isFile() && exts.some((x) => f.name.toLowerCase().endsWith(x))) {
        out.push({
          url: urlArtefacto(modulo, runId, `${sub}/${folder.name}/${f.name}`),
          label: etiqueta(f.name),
          esFallo: /bloqueo|fail|fallo/i.test(f.name),
          nombre: f.name,
        });
      }
    }
  }
  return out;
}

function evidenciasCaso(modulo, runId, caso) {
  const base = path.join(repDir(modulo), runId, D.evidence);
  const out = [];
  for (const tipoDir of listarDir(base)) {
    if (!tipoDir.isDirectory()) continue;
    for (const folder of listarDir(path.join(base, tipoDir.name))) {
      if (!folder.isDirectory() || !folder.name.includes(caso)) continue;
      for (const f of listarDir(path.join(base, tipoDir.name, folder.name))) {
        if (f.isFile()) {
          out.push({
            tipo: tipoDir.name,
            nombre: f.name,
            url: urlArtefacto(modulo, runId, `${D.evidence}/${tipoDir.name}/${folder.name}/${f.name}`),
          });
        }
      }
    }
  }
  return out;
}

function resumen(modulo, runId) {
  const rj = leerResultados(modulo, runId);
  const st = (rj && rj.stats) || {};
  const total = st.tests || 0;
  return {
    runId,
    fecha: fechaLegible(runId),
    total,
    pasaron: st.passes || 0,
    fallaron: st.failures || 0,
    estado: st.failures > 0 ? 'failed' : total > 0 ? 'passed' : 'sin-ejecutar',
  };
}

function historial(modulo) {
  return {
    corridas: corridas(modulo).map((r) => resumen(modulo, r)),
  };
}

function detalleCorrida(modulo, runId) {
  const rj = leerResultados(modulo, runId);
  const tests = walkTests(rj || {}).map((t) => ({
    caso: casoDeTest(t),
    titulo: t.title,
    estado: estadoDe(t),
    duracion: t.duration || 0,
  }));
  return {
    ...resumen(modulo, runId),
    log: fs.existsSync(path.join(repDir(modulo), runId, D.logs, D.log))
      ? { url: urlArtefacto(modulo, runId, `${D.logs}/${D.log}`) }
      : null,
    tests,
  };
}

/** Resuelve un path de /artefacto a un archivo real, con guardia anti-traversal. */
function rutaArtefacto(modulo, runId, rel) {
  const base = path.resolve(repDir(modulo), runId);
  const p = path.resolve(base, rel);
  if (p !== base && !p.startsWith(base + path.sep)) return null;
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null;
}

function etiqueta(nombre) {
  return nombre.replace(/__\d.*$/, '').replace(/[_-]+/g, ' ').trim() || nombre;
}
function urlArtefacto(modulo, runId, rel) {
  return `/artefacto/${encodeURIComponent(modulo)}/${encodeURIComponent(runId)}/${rel}`;
}
function fechaLegible(runId) {
  const m = runId.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}` : runId;
}

module.exports = {
  corridas,
  estadosPorCaso,
  ultimaDeCaso,
  historial,
  detalleCorrida,
  rutaArtefacto,
};
