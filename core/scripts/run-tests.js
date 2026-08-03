#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const config = require('../config');
const paths = require('../utils/paths');
const chromeProfiles = require('../utils/chromeProfiles');
// El reporte HTML de Mochawesome se descontinuó como salida automática: el Panel
// de Control es el visor oficial y consume directamente el JSON + artefactos de
// reports/<RUN_ID>/. El generador (scripts/generate-report.js) sigue disponible
// como bin manual opcional (npm run report:generate), pero ya NO se invoca acá.

function toGlobPath(p) {
  return p.split(path.sep).join('/');
}

/**
 * Resuelve el target de Mocha de forma tolerante a la carpeta desde la que se
 * invoca. npm normaliza el cwd a la raíz del módulo, pero el ARGUMENTO del path
 * se sigue interpretando desde ahí; entonces, parado en `tests/`, uno escribe el
 * nombre del archivo "pelado" y Mocha no lo encuentra. Este helper antepone
 * `tests/` cuando tiene sentido, así `npm test -- foo.test.js` funciona desde
 * cualquier lado, sin romper las formas que ya andaban.
 *
 * Reglas (conservadoras: solo reescribe cuando es claramente correcto):
 *  - ya apunta a `tests/…` o es ruta absoluta -> se deja igual.
 *  - existe tal cual desde la raíz del módulo -> se deja igual.
 *  - `tests/<target>` existe como archivo/carpeta -> se usa esa.
 *  - es un glob (`*?{[`) -> se asume dentro de `tests/`.
 *  - si nada aplica -> se deja igual (que Mocha reporte el error original).
 */
function resolverTarget(target) {
  const primerSeg = target.replace(/\\/g, '/').split('/')[0];
  if (primerSeg === 'tests' || path.isAbsolute(target)) return target;
  if (fs.existsSync(path.join(paths.ROOT_DIR, target))) return target;

  const prefijado = `tests/${target}`;
  if (fs.existsSync(path.join(paths.ROOT_DIR, prefijado))) return prefijado;
  if (/[*?{[]/.test(target)) return prefijado;
  return target;
}

async function runMocha(target) {
  // Se resuelven por nombre/ubicación del core (no por rutas del módulo), así
  // funciona con node_modules hoisteado por workspaces y desde cualquier módulo.
  const mochaEntry = require.resolve('mocha/bin/mocha.js');
  const rootHooksEntry = path.join(__dirname, '..', 'utils', 'mochaRootHooks.js');

  const jsonDirRelative = toGlobPath(path.relative(paths.ROOT_DIR, paths.JSON_DIR));

  const args = [
    mochaEntry,
    target,
    '--timeout', String(config.timeouts.testTimeoutMs),
    '--retries', String(config.retries),
    '--require', rootHooksEntry,
    '--reporter', 'mochawesome',
    '--reporter-options',
    `reportDir=${jsonDirRelative},reportFilename=results,json=true,html=false,overwrite=true,quiet=true`,
  ];

  const logPath = path.join(paths.LOGS_DIR, 'run-stdout.log');
  const logStream = fs.createWriteStream(logPath);

  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: paths.ROOT_DIR,
      shell: false,
      // REPORTS_ROOT garantiza que el proceso hijo (Mocha) escriba en la misma
      // carpeta de reportes del módulo que calculó el proceso padre.
      env: { ...process.env, RUN_ID: paths.RUN_ID, REPORTS_ROOT: paths.ROOT_DIR },
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });
    child.on('close', (code) => resolve(code === null ? 1 : code));
  });

  logStream.end();

  return { exitCode, logPath };
}

/**
 * Cuenta procesos ChromeDriver huérfanos (best-effort, solo Windows). NO los mata:
 * matar procesos como efecto colateral de `npm test` sería sorpresivo y podría
 * interferir con otra corrida; se REPORTA para que el usuario/agente decida.
 * En un flujo normal (serial) `quitDriver` ya cierra cada ChromeDriver, así que lo
 * esperado es 0.
 */
function contarChromedriverHuerfano() {
  if (process.platform !== 'win32') return null; // solo se verifica en Windows
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq chromedriver.exe" /NH', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return (out.match(/chromedriver\.exe/gi) || []).length;
  } catch (e) {
    return null; // no verificable: no interrumpe
  }
}

/**
 * Limpieza automática al terminar la corrida: elimina los perfiles temporales de
 * Chrome que el framework creó (los de cada sesión ya los borró `quitDriver`; esto
 * es la red de seguridad) y muestra un resumen. NUNCA toca reports, screenshots,
 * evidencias, metadata, execution-context ni nada del proyecto. Best-effort: una
 * falla se reporta como advertencia y no interrumpe.
 */
function limpiezaPostEjecucion() {
  try {
    const r = chromeProfiles.limpiarPerfiles();
    const residuales = chromeProfiles.contarPerfiles();
    const drivers = contarChromedriverHuerfano();
    console.log('Limpieza automática post-ejecución:');
    console.log(`  • Perfiles Chrome del framework eliminados: ${r.eliminados} (~${r.mbRecuperados} MB)`);
    console.log(`  • Perfiles residuales: ${residuales} ${residuales === 0 ? '(OK)' : '(⚠ revisar)'}`);
    console.log(
      `  • ChromeDriver huérfanos: ${drivers === null ? 'no verificado' : drivers}${drivers ? ' (⚠ cerrar manualmente)' : ''}`
    );
    r.advertencias.forEach((a) => console.log(`  ⚠ ${a}`));
  } catch (err) {
    console.log(`Limpieza automática post-ejecución: ADVERTENCIA — no completó (${err.message})`);
  }
}

async function main() {
  const targetSolicitado = process.argv[2] || 'tests';
  const target = resolverTarget(targetSolicitado);

  paths.ensureReportDirs();
  console.log(`Ejecución: ${paths.RUN_ID}`);
  console.log(
    target === targetSolicitado
      ? `Target: ${target}`
      : `Target: ${target} (resuelto desde "${targetSolicitado}")`
  );

  const { exitCode, logPath } = await runMocha(target);

  // Limpieza automática post-ejecución (siempre, sin que el usuario la pida).
  limpiezaPostEjecucion();

  // (Se removió la generación automática del reporte HTML; todo el resto de la
  //  ejecución —JSON de resultados, screenshots, evidencias, logs, metadata,
  //  historial y retención— continúa exactamente igual.)
  paths.updateLatest(paths.RUN_ID);

  const deleted = paths.pruneOldRuns(config.reports.keep);
  if (deleted.length) {
    console.log(`Retención (KEEP_REPORTS=${config.reports.keep}): se eliminaron ${deleted.length} ejecución(es) antigua(s): ${deleted.join(', ')}`);
  }

  console.log(`Resultados en reports/${paths.RUN_ID}/ (JSON + screenshots + evidencias + logs) — visibles en el Panel de Control.`);
  console.log(`Log de ejecución: ${path.relative(paths.ROOT_DIR, logPath)}`);

  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error('Error ejecutando la suite:', err);
  process.exitCode = 1;
});
