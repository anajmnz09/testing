const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Gestión de los PERFILES TEMPORALES de Chrome que crea el framework.
 *
 * Por defecto Selenium/Chrome genera un `scoped_dir*` aleatorio en el TEMP del SO
 * y solo lo borra en un cierre elegante. Cuando el proceso se mata (timeouts,
 * kills del entorno), esos perfiles quedan HUÉRFANOS y llenan el disco (se
 * detectaron 72, ~1.9 GB).
 *
 * Este módulo le da al framework un perfil propio y RASTREABLE (bajo una carpeta
 * conocida) para poder limpiarlo de forma confiable: el de la sesión al cerrar el
 * driver, y los huérfanos viejos de corridas anteriores al arrancar. Es puro
 * (solo fs), sin Selenium: por eso se testea en memoria.
 *
 * Aditivo y neutro: no cambia el comportamiento de las pruebas (Chrome sigue
 * arrancando con un perfil limpio por sesión), solo dónde vive y que se limpie.
 */

const BASE = path.join(os.tmpdir(), 'triple-chrome');
const EDAD_VIEJO_MS = 60 * 60 * 1000; // 1 hora: una corrida activa nunca llega a esto
const PREFIJO = 'profile-';

/** Crea (y devuelve) un directorio de perfil nuevo, único y rastreable. */
function nuevoPerfil() {
  const dir = path.join(BASE, `${PREFIJO}${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Borra un perfil (best-effort: si Windows lo tiene bloqueado, no lanza). */
function borrar(dir) {
  if (!dir) return false;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Borra los perfiles del framework más viejos que `maxEdadMs` (huérfanos de
 * corridas cuyo proceso se mató sin cerrar el driver). Nunca toca un perfil
 * reciente ni entradas ajenas (solo las que empiezan con `profile-`).
 * @returns {number} cantidad de perfiles borrados
 */
function barrerViejos(baseDir = BASE, maxEdadMs = EDAD_VIEJO_MS) {
  let entradas;
  try {
    entradas = fs.readdirSync(baseDir);
  } catch (e) {
    return 0; // la carpeta todavía no existe
  }
  const ahora = Date.now();
  let borrados = 0;
  for (const nombre of entradas) {
    if (!nombre.startsWith(PREFIJO)) continue;
    const dir = path.join(baseDir, nombre);
    try {
      if (ahora - fs.statSync(dir).mtimeMs > maxEdadMs) {
        fs.rmSync(dir, { recursive: true, force: true });
        borrados++;
      }
    } catch (e) {
      /* en uso o ya borrado: se ignora */
    }
  }
  return borrados;
}

/** Cantidad de perfiles del framework presentes ahora (para verificar residuales). */
function contarPerfiles(baseDir = BASE) {
  try {
    return fs.readdirSync(baseDir).filter((n) => n.startsWith(PREFIJO)).length;
  } catch (e) {
    return 0;
  }
}

/** Tamaño aproximado (MB) de un directorio, recorriéndolo (best-effort). */
function _tamanoMb(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const actual = stack.pop();
    let items;
    try {
      items = fs.readdirSync(actual, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const it of items) {
      const p = path.join(actual, it.name);
      try {
        if (it.isDirectory()) stack.push(p);
        else total += fs.statSync(p).size;
      } catch (e) {
        /* archivo volátil: se ignora */
      }
    }
  }
  return total / (1024 * 1024);
}

/**
 * Limpieza POST-CORRIDA: elimina TODOS los perfiles del framework. Al terminar la
 * corrida ninguno está en uso (cada sesión ya lo borró `quitDriver`), así que es
 * seguro barrerlos todos —a diferencia de `barrerViejos`, que es por antigüedad
 * para el arranque—. Devuelve un resumen y NUNCA lanza (best-effort): si algo
 * falla, lo reporta como advertencia.
 *
 * @returns {{eliminados:number, mbRecuperados:number, advertencias:string[]}}
 */
function limpiarPerfiles(baseDir = BASE) {
  const res = { eliminados: 0, mbRecuperados: 0, advertencias: [] };
  let entradas;
  try {
    entradas = fs.readdirSync(baseDir);
  } catch (e) {
    return res; // la carpeta no existe: nada que limpiar
  }
  for (const nombre of entradas) {
    if (!nombre.startsWith(PREFIJO)) continue;
    const dir = path.join(baseDir, nombre);
    try {
      res.mbRecuperados += _tamanoMb(dir);
      fs.rmSync(dir, { recursive: true, force: true });
      res.eliminados += 1;
    } catch (e) {
      res.advertencias.push(`no se pudo eliminar ${nombre}: ${e.message}`);
    }
  }
  res.mbRecuperados = Math.round(res.mbRecuperados);
  return res;
}

/**
 * Windows only, best-effort. Mata ÚNICAMENTE los procesos chromedriver.exe/
 * chrome.exe cuya línea de comando contiene `perfilDir` (el --user-data-dir
 * ÚNICO de esta sesión). NUNCA mata por nombre de imagen (`taskkill /IM`): eso
 * afectaría a cualquier otra sesión de Selenium corriendo en la misma máquina.
 * Cada proceso se identifica por su PID real, verificado contra su propia línea
 * de comando, antes de cerrarlo (`taskkill /PID <pid> /F`).
 *
 * Existe porque `Builder().build()` de selenium-webdriver, si la sesión falla
 * DESPUÉS de arrancar chromedriver/Chrome, no expone ningún handle del proceso
 * al llamador (el `DriverService` se crea y arranca dentro de la promesa interna
 * de `Builder().build()`, sin devolverse en el camino de error — verificado en
 * node_modules/selenium-webdriver: remote/index.js#build() siempre construye un
 * DriverService NUEVO, e index.js#build() no lo retorna si createSession falla).
 * No hay forma soportada de obtener el PID exacto por API; esta es la alternativa
 * segura: escanear por línea de comando y matar solo por PID verificado.
 *
 * @returns {{matados:number, advertencia:?string}}
 */
function matarProcesosPorPerfil(perfilDir) {
  if (process.platform !== 'win32' || !perfilDir) return { matados: 0, advertencia: null };
  try {
    const out = execSync(
      'wmic process where "name=\'chromedriver.exe\' or name=\'chrome.exe\'" get ProcessId,CommandLine /format:list',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const bloques = out.split(/\r?\n\s*\r?\n/);
    let matados = 0;
    for (const bloque of bloques) {
      if (!bloque.includes(perfilDir)) continue; // no es un proceso de ESTA sesión
      const m = bloque.match(/ProcessId=(\d+)/);
      if (!m) continue;
      try {
        execSync(`taskkill /PID ${m[1]} /F`, { stdio: 'ignore' });
        matados++;
      } catch (e) {
        /* el proceso puede haber terminado por su cuenta entre la lectura y el kill */
      }
    }
    return { matados, advertencia: null };
  } catch (e) {
    return { matados: 0, advertencia: `no se pudo verificar/cerrar procesos de esta sesión (${e.message})` };
  }
}

module.exports = {
  BASE,
  EDAD_VIEJO_MS,
  nuevoPerfil,
  borrar,
  barrerViejos,
  contarPerfiles,
  limpiarPerfiles,
  matarProcesosPorPerfil,
};
