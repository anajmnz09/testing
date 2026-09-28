'use strict';

const { spawn, execSync } = require('child_process');
const path = require('path');
const comando = require('./comando');

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * Lanzador: PASARELA TRANSPARENTE de comandos. No sabe qué es un test; hace
 * `spawn` del MISMO comando que la consola (resuelto por comando.js) y transmite
 * su salida en vivo. Un solo run activo a la vez (Mocha corre serial; el
 * framework asume un único driver).
 *
 * La salida se difunde por SSE a los suscriptores. Se guarda el búfer de líneas
 * para poder reconstruir (replay) si un cliente se (re)conecta a mitad.
 */
let activa = null; // { run, proceso, lineas:[], suscriptores:Set, fin:number|null }

function estaCorriendo() {
  return !!activa && activa.fin === null;
}

function ejecutar(run) {
  if (estaCorriendo()) return { ok: false, motivo: 'ya-hay-una-corrida' };

  let resuelto;
  try {
    resuelto = comando.resolver(run);
  } catch (e) {
    return { ok: false, motivo: String(e.message || e) };
  }

  const proc = spawn(resuelto.comando, {
    cwd: path.join(RAIZ, resuelto.cwd),
    shell: true, // ejecuta el string tal cual, multiplataforma
  });
  activa = { run, proceso: proc, lineas: [], suscriptores: new Set(), fin: null };

  const onData = (buf) => {
    String(buf)
      .split(/\r?\n/)
      .forEach((l) => {
        if (l === '') return;
        activa.lineas.push(l);
        emitir('linea', { texto: l });
      });
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  proc.on('error', (err) => {
    activa.lineas.push(`No se pudo iniciar: ${err.message}`);
    emitir('linea', { texto: `No se pudo iniciar: ${err.message}` });
  });
  proc.on('close', (codigo) => {
    activa.fin = codigo === null ? -1 : codigo;
    emitir('fin', { codigo: activa.fin });
  });

  return { ok: true };
}

function emitir(evento, data) {
  if (!activa) return;
  for (const res of activa.suscriptores) escribirSse(res, evento, data);
}

function escribirSse(res, evento, data) {
  try {
    res.write(`event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (e) {
    /* cliente cerrado */
  }
}

/** Suscribe una respuesta SSE: replay del búfer + stream hasta el fin. */
function suscribir(res) {
  if (!activa) {
    escribirSse(res, 'inactiva', {});
    return;
  }
  for (const l of activa.lineas) escribirSse(res, 'linea', { texto: l });
  if (activa.fin !== null) {
    escribirSse(res, 'fin', { codigo: activa.fin });
    return;
  }
  activa.suscriptores.add(res);
  res.on('close', () => {
    if (activa) activa.suscriptores.delete(res);
  });
}

/**
 * Mata el proceso lanzado y TODOS sus descendientes (npm > node > mocha >
 * chromedriver > chrome). `proceso.kill()` NO alcanza acá: `ejecutar()` usa
 * `spawn(..., { shell: true })`, así que en Windows el PID real es el de
 * `cmd.exe` — matarlo no mata a sus hijos (confirmado con evidencia real:
 * tras `proceso.kill()`, chromedriver.exe/chrome.exe seguían vivos y el test
 * seguía avanzando varios pasos más, login incluido). `taskkill /T` mata el
 * árbol completo desde el PID dado; en plataformas no-Windows (sin ese
 * problema, sin shell de por medio en la práctica) se usa `proceso.kill()`
 * normal.
 */
function _matarArbol(proceso) {
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${proceso.pid} /T /F`, { stdio: 'ignore' });
      return;
    } catch (e) {
      /* el proceso puede haber terminado por su cuenta */
    }
  }
  try {
    proceso.kill();
  } catch (e) {
    /* noop */
  }
}

function cancelar() {
  if (estaCorriendo()) {
    _matarArbol(activa.proceso);
    return { ok: true };
  }
  return { ok: false };
}

module.exports = { ejecutar, suscribir, cancelar, estaCorriendo };
